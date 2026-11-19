package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.AcessoNegadoException;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.*;
import com.vibedance.repository.*;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Workspace do Professor: linha do tempo do dia, chamada digital de 1 clique,
 * diário de classe, avaliações técnicas e gestão de reposições.
 */
@Service
public class ProfessorWorkspaceService {

    public static final double FREQUENCIA_MINIMA = 75.0;
    private static final Set<String> STATUS_PRESENCA = Set.of("PRESENTE", "FALTA", "JUSTIFICADO");

    private final TurmaRepository turmaRepository;
    private final MatriculaRepository matriculaRepository;
    private final PresencaRepository presencaRepository;
    private final CheckinRepository checkinRepository;
    private final ReposicaoRepository reposicaoRepository;
    private final DiarioClasseRepository diarioRepository;
    private final AvaliacaoTecnicaRepository avaliacaoRepository;
    private final ComunicadoRepository comunicadoRepository;
    private final UsuarioRepository usuarioRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;

    public ProfessorWorkspaceService(TurmaRepository turmaRepository, MatriculaRepository matriculaRepository,
                                     PresencaRepository presencaRepository, CheckinRepository checkinRepository,
                                     ReposicaoRepository reposicaoRepository, DiarioClasseRepository diarioRepository,
                                     AvaliacaoTecnicaRepository avaliacaoRepository,
                                     ComunicadoRepository comunicadoRepository, UsuarioRepository usuarioRepository,
                                     CatalogoService catalogo, AuditoriaService auditoria,
                                     NotificacaoService notificacoes) {
        this.turmaRepository = turmaRepository;
        this.matriculaRepository = matriculaRepository;
        this.presencaRepository = presencaRepository;
        this.checkinRepository = checkinRepository;
        this.reposicaoRepository = reposicaoRepository;
        this.diarioRepository = diarioRepository;
        this.avaliacaoRepository = avaliacaoRepository;
        this.comunicadoRepository = comunicadoRepository;
        this.usuarioRepository = usuarioRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
    }

    // ============================================================ acesso

    private boolean isAdmin(Usuario u) {
        return "ADMINISTRADOR".equals(u.getPerfil());
    }

    private List<Turma> minhasTurmas(Usuario u) {
        return isAdmin(u) ? turmaRepository.findByAtivoTrueOrderByHorarioAsc()
            : turmaRepository.findByProfessorIdAndAtivoTrue(u.getId());
    }

    private Turma turmaAutorizada(Integer turmaId, Usuario u) {
        Turma t = catalogo.turma(turmaId);
        if (!isAdmin(u) && !u.getId().equals(t.getProfessorId())) {
            throw new AcessoNegadoException("Esta turma não está sob sua responsabilidade.");
        }
        return t;
    }

    // ============================================================ hoje

    @Transactional(readOnly = true)
    public HojeProfessor hoje(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        LocalDate hoje = AgendaUtil.hoje();
        LocalTime agora = AgendaUtil.agora();
        List<Turma> turmas = minhasTurmas(u);

        List<AulaDoDia> aulasHoje = turmas.stream()
            .filter(t -> AgendaUtil.ocorreEm(t, hoje))
            .map(t -> aulaDoDia(t, hoje, agora, ctx, true))
            .sorted(Comparator.comparing(AulaDoDia::inicio, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        List<DiaAgenda> semana = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            LocalDate d = hoje.plusDays(i);
            List<AulaDoDia> aulas = turmas.stream().filter(t -> AgendaUtil.ocorreEm(t, d))
                .map(t -> aulaDoDia(t, d, agora, ctx, false))
                .sorted(Comparator.comparing(AulaDoDia::inicio, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
            if (!aulas.isEmpty()) semana.add(new DiaAgenda(d, aulas));
        }

        AulaDoDia proxima = aulasHoje.stream()
            .filter(a -> !"ENCERRADA".equals(a.situacao())).findFirst()
            .orElse(semana.isEmpty() ? null : semana.get(0).aulas().get(0));

        List<Integer> ids = turmas.stream().map(Turma::getId).toList();
        long pendentes = ids.isEmpty() ? 0 : reposicaoRepository.findByIdTurmaDestinoInOrderByDataAulaDestinoAsc(ids)
            .stream().filter(r -> "SOLICITADA".equals(r.getStatus())).count();
        long alunos = ids.isEmpty() ? 0 : matriculaRepository.findByIdTurmaInAndStatus(ids, "ATIVA").stream()
            .map(Matricula::getIdAluno).distinct().count();

        List<Presenca> ultimas = ids.isEmpty() ? List.of() : presencaRepository.findByTurmaIdIn(ids).stream()
            .filter(p -> !p.getDataAula().isBefore(hoje.minusDays(30))).toList();
        long pres = ultimas.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        long consideradas = ultimas.stream().filter(p -> !"JUSTIFICADO".equals(p.getStatus())).count();

        return new HojeProfessor(hoje, aulasHoje, proxima, semana, pendentes, alunos, turmas.size(),
            CatalogoService.percentual(pres, consideradas));
    }

    private AulaDoDia aulaDoDia(Turma t, LocalDate data, LocalTime agora, CatalogoService.Contexto ctx, boolean detalhar) {
        long confirmados = checkinRepository.findByIdTurmaAndDataAula(t.getId(), data).size();
        long reposicoes = reposicaoRepository.findByIdTurmaDestinoAndDataAulaDestinoAndStatus(t.getId(), data, "APROVADA").size();
        long ativos = ctx.ocupadas().getOrDefault(t.getId(), 0);
        boolean chamada = false;
        long presentes = 0;
        if (detalhar) {
            List<Presenca> registros = presencaRepository.findByTurmaIdAndDataAula(t.getId(), data);
            chamada = !registros.isEmpty();
            presentes = registros.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        }
        String situacao = "PROXIMA";
        if (data.equals(AgendaUtil.hoje()) && t.getHorario() != null) {
            LocalTime fim = t.getHorarioFim() != null ? t.getHorarioFim() : t.getHorario().plusHours(1);
            if (agora.isAfter(fim)) situacao = "ENCERRADA";
            else if (!agora.isBefore(t.getHorario())) situacao = "EM_ANDAMENTO";
        }
        return new AulaDoDia(catalogo.turma(t, ctx), data, CatalogoService.hora(t.getHorario()),
            CatalogoService.hora(t.getHorarioFim()), confirmados, reposicoes, ativos, chamada, presentes, situacao);
    }

    // ============================================================ turmas

    @Transactional(readOnly = true)
    public List<TurmaResumo> turmas(Usuario u) {
        return catalogo.turmas(minhasTurmas(u), catalogo.contexto());
    }

    @Transactional(readOnly = true)
    public TurmaProfessorDetalhe turma(Integer turmaId, Usuario u) {
        Turma t = turmaAutorizada(turmaId, u);
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Presenca> presencas = presencaRepository.findByTurmaIdIn(List.of(turmaId));
        Map<Integer, List<Presenca>> porAluno = presencas.stream()
            .collect(Collectors.groupingBy(p -> p.getAluno().getId()));
        List<AvaliacaoTecnica> avaliacoes = avaliacaoRepository.findByIdTurmaOrderByDataAvaliacaoDesc(turmaId);

        List<AlunoDaTurma> alunos = matriculaRepository.findByIdTurmaAndStatus(turmaId, "ATIVA").stream()
            .map(m -> ctx.usuarios().get(m.getIdAluno()))
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(Usuario::getNome))
            .map(a -> {
                List<Presenca> ps = porAluno.getOrDefault(a.getId(), List.of());
                long faltas = ps.stream().filter(p -> "FALTA".equals(p.getStatus())).count();
                AvaliacaoTecnica ultima = avaliacoes.stream().filter(av -> av.getIdAluno().equals(a.getId()))
                    .findFirst().orElse(null);
                return new AlunoDaTurma(a.getId(), a.getNome(), a.getEmail(), a.getAvatarUrl(), frequencia(ps), faltas,
                    ultima == null ? null : CatalogoService.media(ultima), ultima == null ? null : ultima.getDataAvaliacao());
            }).toList();

        List<String> proximas = AgendaUtil.ocorrencias(t, AgendaUtil.hoje(), AgendaUtil.hoje().plusDays(21)).stream()
            .limit(6).map(LocalDate::toString).toList();
        return new TurmaProfessorDetalhe(catalogo.turma(t, ctx), alunos, frequencia(presencas), proximas);
    }

    static double frequencia(Collection<Presenca> ps) {
        long presentes = ps.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        long consideradas = ps.stream().filter(p -> !"JUSTIFICADO".equals(p.getStatus())).count();
        return consideradas == 0 ? 100.0 : CatalogoService.percentual(presentes, consideradas);
    }

    // ============================================================ chamada

    @Transactional(readOnly = true)
    public ChamadaResponse chamada(Integer turmaId, LocalDate data, Usuario u) {
        Turma t = turmaAutorizada(turmaId, u);
        LocalDate dia = data == null ? AgendaUtil.hoje() : data;
        CatalogoService.Contexto ctx = catalogo.contexto();

        Map<Integer, Presenca> registros = presencaRepository.findByTurmaIdAndDataAula(turmaId, dia).stream()
            .collect(Collectors.toMap(p -> p.getAluno().getId(), p -> p, (a, b) -> a));
        Set<Integer> checkins = checkinRepository.findByIdTurmaAndDataAula(turmaId, dia).stream()
            .map(Checkin::getIdAluno).collect(Collectors.toSet());
        Map<Integer, List<Presenca>> historico = presencaRepository.findByTurmaIdIn(List.of(turmaId)).stream()
            .collect(Collectors.groupingBy(p -> p.getAluno().getId()));

        LinkedHashMap<Integer, String> roster = new LinkedHashMap<>();
        matriculaRepository.findByIdTurmaAndStatus(turmaId, "ATIVA").forEach(m -> roster.put(m.getIdAluno(), "MATRICULADO"));
        reposicaoRepository.findByIdTurmaDestinoAndDataAulaDestinoAndStatus(turmaId, dia, "APROVADA")
            .forEach(r -> roster.putIfAbsent(r.getIdAluno(), r.getTipo()));
        registros.keySet().forEach(id -> roster.putIfAbsent(id, "HISTORICO"));

        List<ChamadaAluno> alunos = roster.entrySet().stream()
            .map(e -> {
                Usuario a = ctx.usuarios().get(e.getKey());
                Presenca p = registros.get(e.getKey());
                return new ChamadaAluno(e.getKey(), a == null ? "—" : a.getNome(), a == null ? null : a.getEmail(),
                    a == null ? null : a.getAvatarUrl(), e.getValue(), p == null ? null : p.getStatus(),
                    p == null ? null : p.getJustificativa(), checkins.contains(e.getKey()),
                    frequencia(historico.getOrDefault(e.getKey(), List.of())));
            })
            .sorted(Comparator.comparing(ChamadaAluno::nome))
            .toList();

        long presentes = alunos.stream().filter(a -> "PRESENTE".equals(a.status())).count();
        long faltas = alunos.stream().filter(a -> "FALTA".equals(a.status())).count();
        long justificados = alunos.stream().filter(a -> "JUSTIFICADO".equals(a.status())).count();
        long pendentes = alunos.stream().filter(a -> a.status() == null).count();
        return new ChamadaResponse(catalogo.turma(t, ctx), dia, AgendaUtil.ocorreEm(t, dia), alunos, presentes, faltas,
            justificados, pendentes, CatalogoService.percentual(presentes, presentes + faltas));
    }

    @Transactional
    public ChamadaResponse marcar(Integer turmaId, Integer alunoId, MarcacaoRequest req, Usuario u) {
        Turma t = turmaAutorizada(turmaId, u);
        LocalDate dia = req.data() == null ? AgendaUtil.hoje() : req.data();
        registrar(t, alunoId, dia, req.status(), req.justificativa());
        return chamada(turmaId, dia, u);
    }

    @Transactional
    public ChamadaResponse lote(Integer turmaId, ChamadaLoteRequest req, Usuario u) {
        Turma t = turmaAutorizada(turmaId, u);
        LocalDate dia = req.data() == null ? AgendaUtil.hoje() : req.data();
        if (req.registros() == null || req.registros().isEmpty()) throw new RegraNegocioException("Nenhum registro enviado.");
        for (Marcacao m : req.registros()) {
            registrar(t, m.alunoId(), dia, m.status(), m.justificativa());
        }
        ChamadaResponse r = chamada(turmaId, dia, u);
        auditoria.registrar(u, "CHAMADA", "TURMA", turmaId, "Chamada de " + t.getNomeTurma() + " em " + dia
            + ": " + r.presentes() + " presentes, " + r.faltas() + " faltas, " + r.justificados() + " justificados");
        return r;
    }

    private void registrar(Turma t, Integer alunoId, LocalDate dia, String status, String justificativa) {
        String st = status == null ? "" : status.toUpperCase();
        if (!STATUS_PRESENCA.contains(st)) throw new RegraNegocioException("Status de presença inválido.");
        if (dia.isAfter(AgendaUtil.hoje())) throw new RegraNegocioException("Não é possível registrar chamada de uma data futura.");
        boolean matriculado = matriculaRepository.findByIdAlunoAndIdTurma(alunoId, t.getId())
            .map(m -> "ATIVA".equals(m.getStatus())).orElse(false);
        boolean reposicao = !reposicaoRepository.findByIdTurmaDestinoAndDataAulaDestinoAndStatus(t.getId(), dia, "APROVADA")
            .stream().filter(r -> r.getIdAluno().equals(alunoId)).toList().isEmpty();
        Optional<Presenca> existente = presencaRepository.findByTurmaIdAndAlunoIdAndDataAula(t.getId(), alunoId, dia);
        if (!matriculado && !reposicao && existente.isEmpty()) {
            throw new RegraNegocioException("Aluno não pertence à lista desta aula.");
        }
        double antes = frequencia(presencaRepository.findByAlunoIdAndTurmaIdOrderByDataAulaDesc(alunoId, t.getId()));

        Presenca p = existente.orElseGet(Presenca::new);
        if (p.getId() == null) {
            p.setTurma(t);
            p.setAluno(usuarioRepository.findById(alunoId).orElseThrow(() -> new RecursoNaoEncontradoException("Aluno")));
            p.setDataAula(dia);
        }
        p.setJustificativa("JUSTIFICADO".equals(st) ? (justificativa == null || justificativa.isBlank()
            ? "Justificado pelo professor" : justificativa.trim()) : null);
        p.setStatus(st);
        presencaRepository.save(p);

        if ("FALTA".equals(st) && matriculado) {
            presencaRepository.flush();
            double depois = frequencia(presencaRepository.findByAlunoIdAndTurmaIdOrderByDataAulaDesc(alunoId, t.getId()));
            if (antes >= FREQUENCIA_MINIMA && depois < FREQUENCIA_MINIMA) {
                notificacoes.notificar(alunoId, "Alerta de frequência",
                    "Sua frequência em " + t.getNomeTurma() + " caiu para " + depois + "% (mínimo "
                        + (int) FREQUENCIA_MINIMA + "%). Que tal agendar uma reposição?", "ALERTA", "#/agenda");
            }
        }
    }

    // ============================================================ diário

    @Transactional(readOnly = true)
    public List<DiarioItem> diario(Integer turmaId, Usuario u) {
        turmaAutorizada(turmaId, u);
        CatalogoService.Contexto ctx = catalogo.contexto();
        return diarioRepository.findByIdTurmaOrderByDataAulaDesc(turmaId).stream().map(d -> catalogo.diario(d, ctx)).toList();
    }

    @Transactional
    public DiarioItem salvarDiario(Integer turmaId, DiarioForm form, Usuario u) {
        Turma t = turmaAutorizada(turmaId, u);
        if (form.conteudo() == null || form.conteudo().isBlank()) throw new RegraNegocioException("Descreva o conteúdo trabalhado.");
        LocalDate dia = form.data() == null ? AgendaUtil.hoje() : form.data();
        DiarioClasse d = diarioRepository.findByIdTurmaAndDataAula(turmaId, dia).orElseGet(DiarioClasse::new);
        boolean novo = d.getId() == null;
        d.setIdTurma(turmaId);
        d.setIdProfessor(isAdmin(u) ? t.getProfessorId() : u.getId());
        d.setDataAula(dia);
        d.setConteudo(form.conteudo().trim());
        d.setCoreografia(form.coreografia() == null || form.coreografia().isBlank() ? null : form.coreografia().trim());
        d.setLinksReferencia(form.links() == null ? null : form.links().stream().map(String::trim)
            .filter(s -> s.startsWith("http")).collect(Collectors.joining("\n")));
        d.setObservacoes(form.observacoes());
        d.setAtualizadoEm(LocalDateTime.now(AgendaUtil.FUSO));
        DiarioClasse salvo = diarioRepository.save(d);
        if (novo && salvo.getCoreografia() != null) {
            List<Integer> alunos = matriculaRepository.findByIdTurmaAndStatus(turmaId, "ATIVA").stream()
                .map(Matricula::getIdAluno).toList();
            notificacoes.notificar(alunos, "Nova coreografia no repertório",
                t.getNomeTurma() + ": \"" + salvo.getCoreografia() + "\" foi registrada no diário.", "INFO", "#/evolucao");
        }
        return catalogo.diario(salvo, catalogo.contexto());
    }

    @Transactional
    public void excluirDiario(Integer diarioId, Usuario u) {
        DiarioClasse d = diarioRepository.findById(diarioId).orElseThrow(() -> new RecursoNaoEncontradoException("Registro do diário"));
        turmaAutorizada(d.getIdTurma(), u);
        diarioRepository.delete(d);
        auditoria.registrar(u, "EXCLUIR", "DIARIO", diarioId, "Diário de " + d.getDataAula() + " removido");
    }

    // ============================================================ avaliações

    @Transactional(readOnly = true)
    public List<AvaliacaoItem> avaliacoes(Integer turmaId, Usuario u) {
        turmaAutorizada(turmaId, u);
        CatalogoService.Contexto ctx = catalogo.contexto();
        return avaliacaoRepository.findByIdTurmaOrderByDataAvaliacaoDesc(turmaId).stream()
            .map(a -> catalogo.avaliacao(a, ctx)).toList();
    }

    @Transactional
    public AvaliacaoItem avaliar(AvaliacaoForm form, Usuario u) {
        Turma t = turmaAutorizada(form.turmaId(), u);
        boolean matriculado = matriculaRepository.findByIdAlunoAndIdTurma(form.alunoId(), t.getId())
            .map(m -> "ATIVA".equals(m.getStatus())).orElse(false);
        if (!matriculado) throw new RegraNegocioException("O aluno não está matriculado nesta turma.");
        if (form.coreografiaFoco() == null || form.coreografiaFoco().isBlank()) throw new RegraNegocioException("Informe a coreografia avaliada.");
        if (form.feedbackTexto() == null || form.feedbackTexto().trim().length() < 10) {
            throw new RegraNegocioException("Escreva um feedback com pelo menos 10 caracteres.");
        }
        AvaliacaoTecnica a = new AvaliacaoTecnica();
        a.setIdTurma(t.getId());
        a.setIdAluno(form.alunoId());
        a.setIdProfessor(isAdmin(u) ? t.getProfessorId() : u.getId());
        a.setCoreografiaFoco(form.coreografiaFoco().trim());
        a.setNotaRitmo(nota(form.notaRitmo(), "ritmo"));
        a.setNotaTecnica(nota(form.notaTecnica(), "técnica"));
        a.setNotaExpressao(nota(form.notaExpressao(), "expressão"));
        a.setNotaCoreografia(nota(form.notaCoreografia(), "coreografia"));
        a.setFeedbackTexto(form.feedbackTexto().trim());
        a.setLinkReferencia(form.linkReferencia() == null || form.linkReferencia().isBlank() ? null : form.linkReferencia().trim());
        AvaliacaoTecnica salva = avaliacaoRepository.save(a);
        notificacoes.notificar(form.alunoId(), "Nova avaliação técnica",
            "Você recebeu feedback em \"" + salva.getCoreografiaFoco() + "\" · média " + CatalogoService.media(salva) + ".",
            "SUCESSO", "#/evolucao");
        return catalogo.avaliacao(salva, catalogo.contexto());
    }

    private static BigDecimal nota(BigDecimal n, String rotulo) {
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0 || n.compareTo(BigDecimal.TEN) > 0) {
            throw new RegraNegocioException("A nota de " + rotulo + " deve estar entre 0 e 10.");
        }
        return n.setScale(1, java.math.RoundingMode.HALF_UP);
    }

    // ============================================================ reposições

    @Transactional(readOnly = true)
    public List<ReposicaoItem> reposicoes(Usuario u) {
        List<Integer> ids = minhasTurmas(u).stream().map(Turma::getId).toList();
        if (ids.isEmpty()) return List.of();
        CatalogoService.Contexto ctx = catalogo.contexto();
        LocalDate corte = AgendaUtil.hoje().minusDays(14);
        return reposicaoRepository.findByIdTurmaDestinoInOrderByDataAulaDestinoAsc(ids).stream()
            .filter(r -> "SOLICITADA".equals(r.getStatus()) || !r.getDataAulaDestino().isBefore(corte))
            .map(r -> catalogo.reposicao(r, ctx)).toList();
    }

    @Transactional
    public ReposicaoItem decidirReposicao(Integer id, boolean aprovar, DecisaoRequest req, Usuario u) {
        Reposicao r = reposicaoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Reposição"));
        Turma destino = turmaAutorizada(r.getIdTurmaDestino(), u);
        if (!"SOLICITADA".equals(r.getStatus())) throw new ConflitoException("JA_AVALIADA", "Esta solicitação já foi " + r.getStatus().toLowerCase() + ".");
        if (aprovar) {
            if (r.getDataAulaDestino().isBefore(AgendaUtil.hoje())) throw new RegraNegocioException("A data desta aula já passou.");
            long ativos = matriculaRepository.countByIdTurmaAndStatus(destino.getId(), "ATIVA");
            long aprovadas = reposicaoRepository.findByIdTurmaDestinoAndDataAulaDestinoAndStatus(destino.getId(),
                r.getDataAulaDestino(), "APROVADA").size();
            if (ativos + aprovadas >= destino.getLimiteVagas()) {
                throw new ConflitoException("SEM_VAGAS", "A turma não tem vagas para esta data (" + (ativos + aprovadas)
                    + "/" + destino.getLimiteVagas() + ").");
            }
        } else if (req == null || req.resposta() == null || req.resposta().isBlank()) {
            throw new RegraNegocioException("Informe o motivo da recusa para o aluno.");
        }
        r.setStatus(aprovar ? "APROVADA" : "RECUSADA");
        r.setResposta(req == null ? null : req.resposta());
        r.setAvaliadoPor(u.getId());
        r.setAvaliadoEm(LocalDateTime.now(AgendaUtil.FUSO));
        reposicaoRepository.save(r);

        String rotulo = "EXPERIMENTAL".equals(r.getTipo()) ? "Aula experimental" : "Reposição";
        auditoria.registrar(u, aprovar ? "APROVAR" : "RECUSAR", "REPOSICAO", r.getId(),
            rotulo + " de " + catalogo.usuario(r.getIdAluno()).getNome() + " em " + destino.getNomeTurma() + " (" + r.getDataAulaDestino() + ")");
        notificacoes.notificar(r.getIdAluno(), rotulo + (aprovar ? " aprovada ✓" : " recusada"),
            destino.getNomeTurma() + " · " + r.getDataAulaDestino().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM"))
                + " às " + CatalogoService.hora(destino.getHorario())
                + (r.getResposta() == null || r.getResposta().isBlank() ? "" : " — " + r.getResposta()),
            aprovar ? "AGENDA" : "ALERTA", "#/agenda");
        return catalogo.reposicao(r, catalogo.contexto());
    }

    // ============================================================ comunicados

    @Transactional(readOnly = true)
    public List<ComunicadoItem> comunicados(Usuario u) {
        if (isAdmin(u)) {
            return comunicadoRepository.findAllByOrderByDataPostagemDesc().stream().map(catalogo::comunicado).toList();
        }
        List<Integer> ids = minhasTurmas(u).stream().map(Turma::getId).toList();
        List<Comunicado> lista = new ArrayList<>(ids.isEmpty() ? List.of() : comunicadoRepository.findByTurmaIdInOrderByDataPostagemDesc(ids));
        lista.addAll(comunicadoRepository.findByTurmaIsNullOrderByDataPostagemDesc());
        lista.sort(Comparator.comparing(Comunicado::getDataPostagem, Comparator.nullsFirst(Comparator.<LocalDateTime>naturalOrder())).reversed());
        return lista.stream().map(catalogo::comunicado).toList();
    }

    @Transactional
    public ComunicadoItem publicar(ComunicadoForm form, Usuario u) {
        if (form.titulo() == null || form.titulo().isBlank()) throw new RegraNegocioException("Informe o título do comunicado.");
        if (form.conteudo() == null || form.conteudo().isBlank()) throw new RegraNegocioException("Escreva o conteúdo do comunicado.");
        Turma turma = null;
        if (form.turmaId() != null) {
            turma = turmaAutorizada(form.turmaId(), u);
        } else if (!isAdmin(u)) {
            throw new RegraNegocioException("Selecione a turma destinatária.");
        }
        Comunicado c = new Comunicado();
        c.setTurma(turma);
        c.setProfessor(u);
        c.setTitulo(form.titulo().trim());
        c.setConteudo(form.conteudo().trim());
        c.setLinkAnexo(form.linkAnexo() == null || form.linkAnexo().isBlank() ? null : form.linkAnexo().trim());
        c.setUrgente(Boolean.TRUE.equals(form.urgente()));
        c.setDataPostagem(LocalDateTime.now(AgendaUtil.FUSO));
        Comunicado salvo = comunicadoRepository.save(c);

        List<Integer> destinos = turma == null
            ? usuarioRepository.findAll().stream().filter(x -> Boolean.TRUE.equals(x.getAtivo()) && !x.getId().equals(u.getId()))
                .map(Usuario::getId).toList()
            : matriculaRepository.findByIdTurmaAndStatus(turma.getId(), "ATIVA").stream().map(Matricula::getIdAluno).toList();
        notificacoes.notificar(destinos, (Boolean.TRUE.equals(c.getUrgente()) ? "⚠ " : "") + c.getTitulo(),
            (turma == null ? "Comunicado oficial do estúdio" : turma.getNomeTurma()) + " · " + u.getNome(),
            Boolean.TRUE.equals(c.getUrgente()) ? "ALERTA" : "INFO", "#/avisos");
        auditoria.registrar(u, "PUBLICAR", "COMUNICADO", salvo.getId(), "\"" + salvo.getTitulo() + "\" para "
            + (turma == null ? "todo o estúdio" : turma.getNomeTurma()));
        return catalogo.comunicado(salvo);
    }
}
