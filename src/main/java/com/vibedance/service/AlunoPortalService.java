package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.*;
import com.vibedance.repository.*;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Portal do Aluno: passaporte digital, agenda com check-in antecipado, reposições,
 * hub de evolução, avisos e financeiro — tudo lido do banco em tempo real.
 */
@Service
public class AlunoPortalService {

    private static final int JANELA_AGENDA_DIAS = 14;
    private static final int JANELA_CHECKIN_DIAS = 7;
    private static final DateTimeFormatter DD_MM = DateTimeFormatter.ofPattern("dd/MM");

    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;
    private final PresencaRepository presencaRepository;
    private final CheckinRepository checkinRepository;
    private final ReposicaoRepository reposicaoRepository;
    private final FaturaRepository faturaRepository;
    private final PagamentoRepository pagamentoRepository;
    private final AvaliacaoTecnicaRepository avaliacaoRepository;
    private final DiarioClasseRepository diarioRepository;
    private final ComunicadoRepository comunicadoRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;

    public AlunoPortalService(MatriculaRepository matriculaRepository, TurmaRepository turmaRepository,
                              PresencaRepository presencaRepository, CheckinRepository checkinRepository,
                              ReposicaoRepository reposicaoRepository, FaturaRepository faturaRepository,
                              PagamentoRepository pagamentoRepository, AvaliacaoTecnicaRepository avaliacaoRepository,
                              DiarioClasseRepository diarioRepository, ComunicadoRepository comunicadoRepository,
                              CatalogoService catalogo, AuditoriaService auditoria, NotificacaoService notificacoes) {
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
        this.presencaRepository = presencaRepository;
        this.checkinRepository = checkinRepository;
        this.reposicaoRepository = reposicaoRepository;
        this.faturaRepository = faturaRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.avaliacaoRepository = avaliacaoRepository;
        this.diarioRepository = diarioRepository;
        this.comunicadoRepository = comunicadoRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
    }

    private List<Turma> turmasAtivas(Integer alunoId, CatalogoService.Contexto ctx) {
        return matriculaRepository.findByIdAlunoAndStatus(alunoId, "ATIVA").stream()
            .map(m -> ctx.turmas().get(m.getIdTurma()))
            .filter(t -> t != null && !Boolean.FALSE.equals(t.getAtivo()))
            .toList();
    }

    // ============================================================ passaporte

    @Transactional(readOnly = true)
    public Passaporte passaporte(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Matricula> matriculas = matriculaRepository.findByIdAluno(u.getId());
        List<Turma> turmas = turmasAtivas(u.getId(), ctx);

        String statusMatricula = turmas.isEmpty()
            ? (matriculas.stream().anyMatch(m -> "TRANCADA".equals(m.getStatus())) ? "TRANCADA" : "SEM_MATRICULA")
            : "ATIVA";

        // Financeiro
        List<Fatura> faturas = faturaRepository.findByIdAlunoOrderByDataVencimentoDesc(u.getId());
        List<Fatura> abertas = faturas.stream()
            .filter(f -> Set.of("PENDENTE", "VENCIDO", "EM_ANALISE").contains(f.getStatus())).toList();
        BigDecimal emAberto = abertas.stream().map(Fatura::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
        String situacao = abertas.stream().anyMatch(f -> "VENCIDO".equals(f.getStatus())) ? "ATRASADO"
            : abertas.stream().anyMatch(f -> "PENDENTE".equals(f.getStatus())) ? "PENDENTE"
            : abertas.isEmpty() ? "EM_DIA" : "EM_ANALISE";
        Fatura proximaFatura = abertas.stream().min(Comparator.comparing(Fatura::getDataVencimento)).orElse(null);

        // Frequência por turma
        Map<Integer, List<Presenca>> porTurma = presencaRepository.findByAlunoIdOrderByDataAulaDesc(u.getId()).stream()
            .collect(Collectors.groupingBy(p -> p.getTurma().getId()));
        List<FrequenciaTurma> frequencias = turmas.stream().map(t -> frequenciaTurma(t, porTurma.getOrDefault(t.getId(), List.of())))
            .toList();
        List<Presenca> todas = turmas.stream().flatMap(t -> porTurma.getOrDefault(t.getId(), List.of()).stream()).toList();
        double geral = ProfessorWorkspaceService.frequencia(todas);

        String alerta = null;
        Optional<FrequenciaTurma> critica = frequencias.stream().filter(f -> "CRITICO".equals(f.alerta())).findFirst();
        if (critica.isPresent()) {
            alerta = "Sua frequência em " + critica.get().turmaNome() + " está em " + critica.get().percentual()
                + "% — abaixo do mínimo de 75%. Agende uma reposição.";
        } else if ("ATRASADO".equals(situacao)) {
            alerta = "Há mensalidades em atraso. Regularize para manter sua matrícula ativa.";
        } else if (frequencias.stream().anyMatch(f -> "ATENCAO".equals(f.alerta()))) {
            alerta = "Atenção: você está se aproximando do limite de faltas em uma das suas turmas.";
        }

        List<AvaliacaoTecnica> avaliacoes = avaliacaoRepository.findByIdAlunoOrderByDataAvaliacaoDesc(u.getId());
        BigDecimal media = mediaGeral(avaliacoes);

        AulaAgenda proxima = agenda(u, ctx).stream()
            .filter(a -> !"ENCERRADA".equals(situacaoAula(a))).findFirst().orElse(null);

        return new Passaporte(catalogo.usuario(u), String.format("VD-%06d", u.getId()), statusMatricula, turmas.size(),
            situacao, emAberto, proximaFatura == null ? null : catalogo.fatura(proximaFatura, ctx), proxima, geral,
            frequencias, alerta, media, avaliacoes.size());
    }

    private FrequenciaTurma frequenciaTurma(Turma t, List<Presenca> ps) {
        long presentes = ps.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        long faltas = ps.stream().filter(p -> "FALTA".equals(p.getStatus())).count();
        long justificadas = ps.stream().filter(p -> "JUSTIFICADO".equals(p.getStatus())).count();
        double pct = ProfessorWorkspaceService.frequencia(ps);
        String alerta = pct >= 85 ? "OK" : pct >= ProfessorWorkspaceService.FREQUENCIA_MINIMA ? "ATENCAO" : "CRITICO";
        return new FrequenciaTurma(t.getId(), t.getNomeTurma(), presentes, faltas, justificadas, ps.size(), pct, alerta);
    }

    private static BigDecimal mediaGeral(List<AvaliacaoTecnica> avaliacoes) {
        if (avaliacoes.isEmpty()) return null;
        return avaliacoes.stream().map(CatalogoService::media).reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(avaliacoes.size()), 1, RoundingMode.HALF_UP);
    }

    // ============================================================ agenda

    @Transactional(readOnly = true)
    public List<AulaAgenda> agenda(Usuario u) {
        return agenda(u, catalogo.contexto());
    }

    private List<AulaAgenda> agenda(Usuario u, CatalogoService.Contexto ctx) {
        LocalDate hoje = AgendaUtil.hoje();
        LocalDate fim = hoje.plusDays(JANELA_AGENDA_DIAS);
        Set<String> checkins = checkinRepository.findByIdAlunoAndDataAulaGreaterThanEqual(u.getId(), hoje).stream()
            .map(c -> c.getIdTurma() + "|" + c.getDataAula()).collect(Collectors.toSet());
        Map<String, String> presencas = presencaRepository.findByAlunoIdOrderByDataAulaDesc(u.getId()).stream()
            .filter(p -> !p.getDataAula().isBefore(hoje))
            .collect(Collectors.toMap(p -> p.getTurma().getId() + "|" + p.getDataAula(), Presenca::getStatus, (a, b) -> a));

        List<AulaAgenda> aulas = new ArrayList<>();
        for (Turma t : turmasAtivas(u.getId(), ctx)) {
            TurmaResumo resumo = catalogo.turma(t, ctx);
            for (LocalDate d : AgendaUtil.ocorrencias(t, hoje, fim)) {
                aulas.add(montarAula(resumo, t, d, "REGULAR", null, checkins, presencas));
            }
        }
        for (Reposicao r : reposicaoRepository.findByIdAlunoAndStatusAndDataAulaDestinoGreaterThanEqual(u.getId(), "APROVADA", hoje)) {
            Turma t = ctx.turmas().get(r.getIdTurmaDestino());
            if (t == null) continue;
            aulas.add(montarAula(catalogo.turma(t, ctx), t, r.getDataAulaDestino(), r.getTipo(), r.getId(), checkins, presencas));
        }
        aulas.sort(Comparator.comparing(AulaAgenda::data)
            .thenComparing(a -> a.turma().horarioInicio(), Comparator.nullsLast(Comparator.naturalOrder())));
        return aulas;
    }

    private AulaAgenda montarAula(TurmaResumo resumo, Turma t, LocalDate d, String tipo, Integer reposicaoId,
                                  Set<String> checkins, Map<String, String> presencas) {
        String chave = t.getId() + "|" + d;
        String presenca = presencas.get(chave);
        boolean pode = presenca == null && !aulaEncerrada(t, d)
            && !d.isAfter(AgendaUtil.hoje().plusDays(JANELA_CHECKIN_DIAS));
        return new AulaAgenda(resumo, d, tipo, checkins.contains(chave), pode, presenca, reposicaoId);
    }

    private static boolean aulaEncerrada(Turma t, LocalDate d) {
        LocalDate hoje = AgendaUtil.hoje();
        if (d.isBefore(hoje)) return true;
        if (d.isAfter(hoje) || t.getHorario() == null) return false;
        LocalTime fim = t.getHorarioFim() != null ? t.getHorarioFim() : t.getHorario().plusHours(1);
        return AgendaUtil.agora().isAfter(fim);
    }

    private static String situacaoAula(AulaAgenda a) {
        if (!a.data().equals(AgendaUtil.hoje()) || a.turma().horarioFim() == null) return "PROXIMA";
        return AgendaUtil.agora().isAfter(LocalTime.parse(a.turma().horarioFim())) ? "ENCERRADA" : "PROXIMA";
    }

    @Transactional
    public List<AulaAgenda> checkin(Usuario u, CheckinRequest req) {
        if (req.turmaId() == null || req.data() == null) throw new RegraNegocioException("Informe a aula para o check-in.");
        CatalogoService.Contexto ctx = catalogo.contexto();
        AulaAgenda aula = agenda(u, ctx).stream()
            .filter(a -> a.turma().id().equals(req.turmaId()) && a.data().equals(req.data()))
            .findFirst()
            .orElseThrow(() -> new RegraNegocioException("Esta aula não está na sua agenda."));
        if (!aula.podeCheckin()) throw new RegraNegocioException("O check-in desta aula não está disponível.");
        if (aula.checkin()) return agenda(u, ctx);
        Checkin c = new Checkin();
        c.setIdTurma(req.turmaId());
        c.setIdAluno(u.getId());
        c.setDataAula(req.data());
        checkinRepository.save(c);
        return agenda(u, catalogo.contexto());
    }

    @Transactional
    public List<AulaAgenda> desfazerCheckin(Usuario u, CheckinRequest req) {
        checkinRepository.findByIdTurmaAndIdAlunoAndDataAula(req.turmaId(), u.getId(), req.data())
            .ifPresent(checkinRepository::delete);
        return agenda(u, catalogo.contexto());
    }

    // ============================================================ turmas / matrícula

    @Transactional(readOnly = true)
    public List<TurmaResumo> minhasTurmas(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        return catalogo.turmas(turmasAtivas(u.getId(), ctx), ctx);
    }

    @Transactional(readOnly = true)
    public List<TurmaResumo> catalogoTurmas(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        return catalogo.turmas(ctx.turmas().values().stream().filter(t -> !Boolean.FALSE.equals(t.getAtivo())).toList(), ctx);
    }

    @Transactional
    public List<TurmaResumo> matricular(Usuario u, MatriculaRequest req) {
        if (req.idTurma() == null) throw new RegraNegocioException("Selecione a turma.");
        Turma turma = turmaRepository.buscarPorIdComBloqueio(req.idTurma())
            .orElseThrow(() -> new RecursoNaoEncontradoException("Turma"));
        if (Boolean.FALSE.equals(turma.getAtivo())) throw new RegraNegocioException("Turma encerrada.");
        Optional<Matricula> existente = matriculaRepository.findByIdAlunoAndIdTurma(u.getId(), turma.getId());
        if (existente.isPresent() && "ATIVA".equals(existente.get().getStatus())) {
            throw new ConflitoException("JA_MATRICULADO", "Você já está matriculado(a) nesta turma.");
        }
        long ocupadas = matriculaRepository.countByIdTurmaAndStatus(turma.getId(), "ATIVA");
        if (ocupadas >= turma.getLimiteVagas()) throw new ConflitoException("TURMA_LOTADA", "Turma lotada. Tente outro horário.");
        Matricula m = existente.orElseGet(Matricula::new);
        m.setIdAluno(u.getId());
        m.setIdTurma(turma.getId());
        m.setStatus("ATIVA");
        matriculaRepository.save(m);
        auditoria.registrar(u, "MATRICULAR", "USUARIO", u.getId(), u.getNome() + " se matriculou em " + turma.getNomeTurma());
        notificacoes.notificar(turma.getProfessorId(), "Novo aluno na turma",
            u.getNome() + " entrou em " + turma.getNomeTurma() + ".", "INFO", "#/turmas");
        notificacoes.notificarAdmins("Nova matrícula", u.getNome() + " → " + turma.getNomeTurma(), "INFO", "#/usuarios");
        return minhasTurmas(u);
    }

    // ============================================================ reposições

    @Transactional(readOnly = true)
    public List<ReposicaoItem> reposicoes(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        return reposicaoRepository.findByIdAlunoOrderBySolicitadoEmDesc(u.getId()).stream()
            .map(r -> catalogo.reposicao(r, ctx)).toList();
    }

    @Transactional(readOnly = true)
    public List<OpcaoReposicao> opcoes(Usuario u, String tipo, Integer turmaOrigemId) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Set<Integer> matriculadas = turmasAtivas(u.getId(), ctx).stream().map(Turma::getId).collect(Collectors.toSet());
        boolean experimental = "EXPERIMENTAL".equalsIgnoreCase(tipo);
        Turma origem = turmaOrigemId == null ? null : ctx.turmas().get(turmaOrigemId);
        if (!experimental && (origem == null || !matriculadas.contains(origem.getId()))) {
            throw new RegraNegocioException("Selecione uma turma em que você está matriculado(a).");
        }
        LocalDate hoje = AgendaUtil.hoje();
        List<OpcaoReposicao> opcoes = new ArrayList<>();
        for (Turma t : ctx.turmas().values()) {
            if (Boolean.FALSE.equals(t.getAtivo()) || matriculadas.contains(t.getId())) continue;
            // Reposição: a mesma modalidade vem primeiro; se o estúdio não tiver outra turma dela,
            // as demais turmas com vaga também servem (o professor aprova ou recusa).
            boolean mesmaModalidade = !experimental && t.getModalidade() != null && origem.getModalidade() != null
                && t.getModalidade().getId().equals(origem.getModalidade().getId());
            int ocupadas = ctx.ocupadas().getOrDefault(t.getId(), 0);
            List<LocalDate> datas = AgendaUtil.ocorrencias(t, hoje, hoje.plusDays(JANELA_AGENDA_DIAS)).stream()
                .filter(d -> !aulaEncerrada(t, d))
                .filter(d -> ocupadas + reposicaoRepository.findByIdTurmaDestinoAndDataAulaDestinoAndStatus(t.getId(), d, "APROVADA").size()
                    < t.getLimiteVagas())
                .toList();
            if (!datas.isEmpty()) {
                opcoes.add(new OpcaoReposicao(catalogo.turma(t, ctx), datas, Math.max(0, t.getLimiteVagas() - ocupadas), mesmaModalidade));
            }
        }
        opcoes.sort(Comparator.comparing((OpcaoReposicao o) -> !o.mesmaModalidade()).thenComparing(o -> o.datas().get(0)));
        return opcoes;
    }

    @Transactional
    public ReposicaoItem solicitar(Usuario u, ReposicaoForm form) {
        String tipo = form.tipo() == null ? "REPOSICAO" : form.tipo().toUpperCase();
        if (!Set.of("REPOSICAO", "EXPERIMENTAL").contains(tipo)) throw new RegraNegocioException("Tipo de solicitação inválido.");
        CatalogoService.Contexto ctx = catalogo.contexto();
        Set<Integer> matriculadas = turmasAtivas(u.getId(), ctx).stream().map(Turma::getId).collect(Collectors.toSet());

        Turma destino = catalogo.turma(form.turmaDestinoId());
        LocalDate data = form.dataAulaDestino();
        if (data == null || data.isBefore(AgendaUtil.hoje()) || data.isAfter(AgendaUtil.hoje().plusDays(30))) {
            throw new RegraNegocioException("Escolha uma data entre hoje e os próximos 30 dias.");
        }
        if (!AgendaUtil.ocorreEm(destino, data) || aulaEncerrada(destino, data)) {
            throw new RegraNegocioException("A turma escolhida não tem aula disponível nesta data.");
        }
        if (matriculadas.contains(destino.getId())) throw new RegraNegocioException("Você já é aluno(a) desta turma.");
        if ("REPOSICAO".equals(tipo) && (form.turmaOrigemId() == null || !matriculadas.contains(form.turmaOrigemId()))) {
            throw new RegraNegocioException("Informe a turma de origem da reposição.");
        }
        if (reposicaoRepository.existsByIdAlunoAndIdTurmaDestinoAndDataAulaDestinoAndStatusIn(u.getId(), destino.getId(),
            data, List.of("SOLICITADA", "APROVADA"))) {
            throw new ConflitoException("DUPLICADA", "Você já possui uma solicitação para esta aula.");
        }
        Reposicao r = new Reposicao();
        r.setIdAluno(u.getId());
        r.setIdTurmaOrigem("REPOSICAO".equals(tipo) ? form.turmaOrigemId() : null);
        r.setIdTurmaDestino(destino.getId());
        r.setDataFalta(form.dataFalta());
        r.setDataAulaDestino(data);
        r.setTipo(tipo);
        r.setStatus("SOLICITADA");
        r.setMotivo(form.motivo());
        Reposicao salva = reposicaoRepository.save(r);

        String rotulo = "EXPERIMENTAL".equals(tipo) ? "aula experimental" : "reposição";
        notificacoes.notificar(destino.getProfessorId(), "Nova solicitação de " + rotulo,
            u.getNome() + " → " + destino.getNomeTurma() + " em " + data.format(DD_MM) + ".", "AGENDA", "#/reposicoes");
        auditoria.registrar(u, "SOLICITAR", "REPOSICAO", salva.getId(), "Solicitação de " + rotulo + " em "
            + destino.getNomeTurma() + " (" + data + ")");
        return catalogo.reposicao(salva, catalogo.contexto());
    }

    @Transactional
    public ReposicaoItem cancelarReposicao(Usuario u, Integer id) {
        Reposicao r = reposicaoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Solicitação"));
        if (!r.getIdAluno().equals(u.getId())) throw new RecursoNaoEncontradoException("Solicitação");
        if (!Set.of("SOLICITADA", "APROVADA").contains(r.getStatus()) || r.getDataAulaDestino().isBefore(AgendaUtil.hoje())) {
            throw new RegraNegocioException("Esta solicitação não pode mais ser cancelada.");
        }
        boolean eraAprovada = "APROVADA".equals(r.getStatus());
        r.setStatus("CANCELADA");
        reposicaoRepository.save(r);
        checkinRepository.findByIdTurmaAndIdAlunoAndDataAula(r.getIdTurmaDestino(), u.getId(), r.getDataAulaDestino())
            .ifPresent(checkinRepository::delete);
        if (eraAprovada) {
            Turma destino = catalogo.turma(r.getIdTurmaDestino());
            notificacoes.notificar(destino.getProfessorId(), "Reposição cancelada pelo aluno",
                u.getNome() + " não irá em " + destino.getNomeTurma() + " (" + r.getDataAulaDestino().format(DD_MM) + ").",
                "AGENDA", "#/reposicoes");
        }
        return catalogo.reposicao(r, catalogo.contexto());
    }

    // ============================================================ agenda completa e frequência

    private static ResumoFrequencia resumo(Collection<Presenca> ps) {
        long presentes = ps.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        long faltas = ps.stream().filter(p -> "FALTA".equals(p.getStatus())).count();
        long justificadas = ps.stream().filter(p -> "JUSTIFICADO".equals(p.getStatus())).count();
        long total = presentes + faltas + justificadas;
        // Regra oficial: faltas justificadas pelo professor não entram no cálculo de frequência
        long consideradas = presentes + faltas;
        return new ResumoFrequencia(total, presentes, faltas, justificadas,
            consideradas == 0 ? 100.0 : CatalogoService.percentual(presentes, consideradas),
            consideradas == 0 ? 0.0 : CatalogoService.percentual(faltas, consideradas),
            CatalogoService.percentual(presentes, total), CatalogoService.percentual(faltas, total),
            CatalogoService.percentual(justificadas, total));
    }

    /**
     * Calendário do mês (aulas passadas com presença, falta ou justificativa; futuras agendadas)
     * e o consolidado de frequência — geral, do mês e por turma.
     */
    @Transactional(readOnly = true)
    public FrequenciaAluno frequencia(Usuario u, String mesTexto) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        LocalDate hoje = AgendaUtil.hoje();
        java.time.YearMonth mes;
        try {
            mes = mesTexto == null || mesTexto.isBlank() ? java.time.YearMonth.from(hoje) : java.time.YearMonth.parse(mesTexto);
        } catch (java.time.format.DateTimeParseException e) {
            throw new RegraNegocioException("Mês inválido. Use o formato AAAA-MM.");
        }
        LocalDate ini = mes.atDay(1);
        LocalDate fim = mes.atEndOfMonth();

        List<Presenca> todas = presencaRepository.findByAlunoIdOrderByDataAulaDesc(u.getId());
        Map<String, Presenca> porChave = todas.stream()
            .collect(Collectors.toMap(p -> p.getTurma().getId() + "|" + p.getDataAula(), Function.identity(), (a, b) -> a));
        Set<String> checkins = checkinRepository.findByIdAlunoAndDataAulaGreaterThanEqual(u.getId(), ini).stream()
            .map(c -> c.getIdTurma() + "|" + c.getDataAula()).collect(Collectors.toSet());

        Map<LocalDate, List<AulaCalendario>> dias = new TreeMap<>();
        Set<String> incluidas = new HashSet<>();
        java.util.function.BiConsumer<LocalDate, AulaCalendario> add = (d, a) -> dias.computeIfAbsent(d, k -> new ArrayList<>()).add(a);

        // 1. Aulas regulares das matrículas ativas (a partir da data de matrícula)
        for (Matricula m : matriculaRepository.findByIdAlunoAndStatus(u.getId(), "ATIVA")) {
            Turma t = ctx.turmas().get(m.getIdTurma());
            if (t == null || Boolean.FALSE.equals(t.getAtivo())) continue;
            LocalDate desde = m.getDataMatricula() == null ? ini : m.getDataMatricula().toLocalDate();
            LocalDate de = desde.isAfter(ini) ? desde : ini;
            TurmaResumo r = catalogo.turma(t, ctx);
            for (LocalDate d : AgendaUtil.ocorrencias(t, de, fim)) {
                String chave = t.getId() + "|" + d;
                incluidas.add(chave);
                add.accept(d, aulaCalendario(r, d, "REGULAR", porChave.get(chave), checkins.contains(chave), t));
            }
        }
        // 2. Reposições e aulas experimentais aprovadas
        for (Reposicao rp : reposicaoRepository.findByIdAlunoOrderBySolicitadoEmDesc(u.getId())) {
            if (!"APROVADA".equals(rp.getStatus()) && !"REALIZADA".equals(rp.getStatus())) continue;
            LocalDate d = rp.getDataAulaDestino();
            Turma t = ctx.turmas().get(rp.getIdTurmaDestino());
            if (t == null || d == null || d.isBefore(ini) || d.isAfter(fim)) continue;
            String chave = t.getId() + "|" + d;
            if (!incluidas.add(chave)) continue;
            add.accept(d, aulaCalendario(catalogo.turma(t, ctx), d, rp.getTipo(), porChave.get(chave), checkins.contains(chave), t));
        }
        // 3. Registros de chamada de turmas que não estão mais ativas (histórico)
        for (Presenca p : todas) {
            LocalDate d = p.getDataAula();
            if (d.isBefore(ini) || d.isAfter(fim)) continue;
            String chave = p.getTurma().getId() + "|" + d;
            if (!incluidas.add(chave)) continue;
            add.accept(d, aulaCalendario(catalogo.turma(p.getTurma(), ctx), d, "REGULAR", p, false, p.getTurma()));
        }
        dias.values().forEach(l -> l.sort(Comparator.comparing(AulaCalendario::horarioInicio, Comparator.nullsLast(Comparator.naturalOrder()))));

        List<Presenca> doMes = todas.stream().filter(p -> !p.getDataAula().isBefore(ini) && !p.getDataAula().isAfter(fim)).toList();

        // Sequência atual de presenças (justificadas não quebram a sequência)
        int sequencia = 0;
        for (Presenca p : todas) {
            if ("PRESENTE".equals(p.getStatus())) sequencia++;
            else if ("FALTA".equals(p.getStatus())) break;
        }

        Map<Integer, List<Presenca>> porTurma = todas.stream().collect(Collectors.groupingBy(p -> p.getTurma().getId()));
        List<FrequenciaTurma> turmas = turmasAtivas(u.getId(), ctx).stream()
            .map(t -> frequenciaTurma(t, porTurma.getOrDefault(t.getId(), List.of()))).toList();

        List<OcorrenciaFrequencia> ausencias = todas.stream().filter(p -> !"PRESENTE".equals(p.getStatus())).limit(60)
            .map(p -> new OcorrenciaFrequencia(p.getDataAula(), p.getTurma().getId(), p.getTurma().getNomeTurma(),
                ctx.nomeUsuario(p.getTurma().getProfessorId()), p.getStatus(), p.getJustificativa()))
            .toList();

        return new FrequenciaAluno(mes.toString(), mes.minusMonths(1).toString(), mes.plusMonths(1).toString(),
            resumo(todas), resumo(doMes), sequencia, turmas,
            dias.entrySet().stream().map(e -> new DiaCalendario(e.getKey(), e.getValue())).toList(), ausencias);
    }

    private AulaCalendario aulaCalendario(TurmaResumo r, LocalDate d, String tipo, Presenca p, boolean checkin, Turma t) {
        String status;
        if (p != null) status = p.getStatus();
        else if (d.isAfter(AgendaUtil.hoje()) || (d.equals(AgendaUtil.hoje()) && !aulaEncerrada(t, d))) status = "AGENDADA";
        else status = "SEM_REGISTRO"; // aula já passou e o professor ainda não fez a chamada
        return new AulaCalendario(r.id(), r.nome(), r.modalidadeIcone(), r.horarioInicio(), r.horarioFim(), r.salaNome(),
            r.professorNome(), tipo, status, p == null ? null : p.getJustificativa(), checkin);
    }

    // ============================================================ evolução

    @Transactional(readOnly = true)
    public EvolucaoAluno evolucao(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<AvaliacaoTecnica> avaliacoes = avaliacaoRepository.findByIdAlunoOrderByDataAvaliacaoDesc(u.getId());
        Set<Integer> turmas = matriculaRepository.findByIdAluno(u.getId()).stream()
            .filter(m -> !"CANCELADA".equals(m.getStatus())).map(Matricula::getIdTurma).collect(Collectors.toSet());
        List<DiarioItem> repertorio = turmas.isEmpty() ? List.of() : diarioRepository.findByIdTurmaInOrderByDataAulaDesc(turmas)
            .stream().limit(40).map(d -> catalogo.diario(d, ctx)).toList();
        List<PresencaItem> presencas = presencaRepository.findByAlunoIdOrderByDataAulaDesc(u.getId()).stream().limit(80)
            .map(p -> new PresencaItem(p.getId(), p.getTurma().getId(), p.getTurma().getNomeTurma(), p.getDataAula(),
                p.getStatus(), p.getJustificativa())).toList();
        List<AvaliacaoTecnica> cronologica = new ArrayList<>(avaliacoes);
        Collections.reverse(cronologica);
        List<SeriePonto> serie = cronologica.stream().map(a -> new SeriePonto(
            a.getDataAvaliacao() == null ? "—" : a.getDataAvaliacao().format(DD_MM), CatalogoService.media(a), null)).toList();
        return new EvolucaoAluno(avaliacoes.stream().map(a -> catalogo.avaliacao(a, ctx)).toList(), repertorio, presencas,
            mediaGeral(avaliacoes), serie);
    }

    // ============================================================ avisos

    @Transactional(readOnly = true)
    public List<ComunicadoItem> avisos(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Integer> ids = turmasAtivas(u.getId(), ctx).stream().map(Turma::getId).toList();
        List<Comunicado> lista = new ArrayList<>(ids.isEmpty() ? List.of() : comunicadoRepository.findByTurmaIdInOrderByDataPostagemDesc(ids));
        lista.addAll(comunicadoRepository.findByTurmaIsNullOrderByDataPostagemDesc());
        lista.sort(Comparator.comparing(Comunicado::getDataPostagem, Comparator.nullsFirst(Comparator.<LocalDateTime>naturalOrder())).reversed());
        return lista.stream().map(catalogo::comunicado).toList();
    }

    // ============================================================ financeiro

    @Transactional(readOnly = true)
    public FinanceiroAluno financeiro(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Fatura> faturas = faturaRepository.findByIdAlunoOrderByDataVencimentoDesc(u.getId());
        Map<Integer, Fatura> mapa = faturas.stream().collect(Collectors.toMap(Fatura::getId, Function.identity()));
        List<PagamentoItem> pagamentos = pagamentoRepository.findByIdAlunoOrderByCriadoEmDesc(u.getId()).stream()
            .map(p -> catalogo.pagamento(p, mapa, ctx)).toList();
        String ano = String.valueOf(AgendaUtil.hoje().getYear());
        BigDecimal emAberto = faturas.stream().filter(f -> Set.of("PENDENTE", "VENCIDO").contains(f.getStatus()))
            .map(Fatura::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pagoAno = faturas.stream().filter(f -> "CONFIRMADO".equals(f.getStatus())
                && f.getMesReferencia() != null && f.getMesReferencia().startsWith(ano))
            .map(Fatura::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
        long atrasadas = faturas.stream().filter(f -> "VENCIDO".equals(f.getStatus())).count();
        long emAnalise = faturas.stream().filter(f -> "EM_ANALISE".equals(f.getStatus())).count();
        return new FinanceiroAluno(new ResumoFinanceiroAluno(emAberto, pagoAno, atrasadas, emAnalise),
            faturas.stream().map(f -> catalogo.fatura(f, ctx)).toList(), pagamentos);
    }
}
