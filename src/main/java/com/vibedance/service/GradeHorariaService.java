package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Modalidade;
import com.vibedance.model.Sala;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.ModalidadeRepository;
import com.vibedance.repository.SalaRepository;
import com.vibedance.repository.TurmaRepository;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Grade horária (timetable), CRUD de turmas/salas/modalidades e detecção automática
 * de conflitos de sala e de professor.
 */
@Service
public class GradeHorariaService {

    private static final Set<String> NIVEIS = Set.of("INICIANTE", "INTERMEDIARIO", "AVANCADO", "TODOS_OS_NIVEIS");

    private final TurmaRepository turmaRepository;
    private final SalaRepository salaRepository;
    private final ModalidadeRepository modalidadeRepository;
    private final MatriculaRepository matriculaRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;

    public GradeHorariaService(TurmaRepository turmaRepository, SalaRepository salaRepository,
                               ModalidadeRepository modalidadeRepository, MatriculaRepository matriculaRepository,
                               CatalogoService catalogo, AuditoriaService auditoria, NotificacaoService notificacoes) {
        this.turmaRepository = turmaRepository;
        this.salaRepository = salaRepository;
        this.modalidadeRepository = modalidadeRepository;
        this.matriculaRepository = matriculaRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
    }

    // ================================================================ leitura

    @Transactional(readOnly = true)
    public GradeHoraria grade() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Turma> ativas = ctx.turmas().values().stream().filter(t -> !Boolean.FALSE.equals(t.getAtivo())).toList();
        List<SalaItem> salas = ctx.salas().values().stream()
            .sorted(Comparator.comparing(Sala::getNome)).map(catalogo::sala).toList();
        return new GradeHoraria(catalogo.turmas(ativas, ctx), salas, conflitosExistentes(ativas, ctx));
    }

    @Transactional(readOnly = true)
    public List<TurmaResumo> listarTurmas(boolean incluirInativas) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Turma> turmas = ctx.turmas().values().stream()
            .filter(t -> incluirInativas || !Boolean.FALSE.equals(t.getAtivo())).toList();
        return catalogo.turmas(turmas, ctx);
    }

    @Transactional(readOnly = true)
    public List<SalaItem> salas() {
        return salaRepository.findAllByOrderByNomeAsc().stream().map(catalogo::sala).toList();
    }

    @Transactional(readOnly = true)
    public List<ModalidadeItem> modalidades() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Map<Integer, long[]> stats = new HashMap<>();
        for (Turma t : ctx.turmas().values()) {
            if (t.getModalidade() == null || Boolean.FALSE.equals(t.getAtivo())) continue;
            long[] s = stats.computeIfAbsent(t.getModalidade().getId(), k -> new long[2]);
            s[0]++;
            s[1] += ctx.ocupadas().getOrDefault(t.getId(), 0);
        }
        return modalidadeRepository.findAllByOrderByNomeAsc().stream().map(m -> {
            long[] s = stats.getOrDefault(m.getId(), new long[2]);
            return new ModalidadeItem(m.getId(), m.getNome(), m.getCategoria(), m.getDescricao(), m.getIcone(),
                m.getStatus() == null || m.getStatus(), s[0], s[1]);
        }).toList();
    }

    // ============================================================== conflitos

    /** Verifica conflitos de uma turma candidata (sem salvar) contra a grade ativa. */
    @Transactional(readOnly = true)
    public List<Conflito> validar(TurmaForm form, Integer ignorarId) {
        Set<DayOfWeek> dias = diasDoForm(form);
        LocalTime inicio = parseHora(form.horarioInicio(), "início");
        LocalTime fim = parseHora(form.horarioFim(), "término");
        return conflitos(dias, inicio, fim, form.salaId(), form.professorId(), ignorarId, catalogo.contexto());
    }

    private List<Conflito> conflitos(Set<DayOfWeek> dias, LocalTime inicio, LocalTime fim, Integer salaId,
                                     Integer professorId, Integer ignorarId, CatalogoService.Contexto ctx) {
        List<Conflito> lista = new ArrayList<>();
        for (Turma outra : ctx.turmas().values()) {
            if (Boolean.FALSE.equals(outra.getAtivo()) || Objects.equals(outra.getId(), ignorarId)) continue;
            Set<DayOfWeek> comum = EnumSet.noneOf(DayOfWeek.class);
            comum.addAll(dias);
            comum.retainAll(AgendaUtil.parseDias(outra.getDiasSemana()));
            if (comum.isEmpty()) continue;
            if (!AgendaUtil.horariosSobrepoem(inicio, fim, outra.getHorario(), outra.getHorarioFim())) continue;

            String horario = CatalogoService.hora(outra.getHorario()) + "–" + CatalogoService.hora(outra.getHorarioFim());
            if (salaId != null && salaId.equals(outra.getSalaId())) {
                Sala s = ctx.salas().get(salaId);
                lista.add(new Conflito("SALA", outra.getId(), outra.getNomeTurma(), outra.getDiasSemana(), horario,
                    "Sala " + (s == null ? "" : s.getNome()) + " já ocupada por \"" + outra.getNomeTurma()
                        + "\" (" + outra.getDiasSemana() + ", " + horario + ")."));
            }
            if (professorId != null && professorId.equals(outra.getProfessorId())) {
                lista.add(new Conflito("PROFESSOR", outra.getId(), outra.getNomeTurma(), outra.getDiasSemana(), horario,
                    ctx.nomeUsuario(professorId) + " já leciona \"" + outra.getNomeTurma() + "\" neste horário ("
                        + outra.getDiasSemana() + ", " + horario + ")."));
            }
        }
        return lista;
    }

    private List<Conflito> conflitosExistentes(List<Turma> ativas, CatalogoService.Contexto ctx) {
        List<Conflito> todos = new ArrayList<>();
        for (Turma t : ativas) {
            for (Conflito c : conflitos(AgendaUtil.parseDias(t.getDiasSemana()), t.getHorario(), t.getHorarioFim(),
                t.getSalaId(), t.getProfessorId(), t.getId(), ctx)) {
                if (t.getId() < c.turmaId()) {
                    todos.add(new Conflito(c.tipo(), t.getId(), t.getNomeTurma() + " × " + c.turmaNome(),
                        c.diasSemana(), c.horario(), c.mensagem()));
                }
            }
        }
        return todos;
    }

    // ================================================================= turmas

    @Transactional
    public TurmaResumo salvarTurma(Integer id, TurmaForm form, Usuario operador) {
        Turma turma = id == null ? new Turma() : catalogo.turma(id);
        boolean nova = id == null;

        if (form.nome() == null || form.nome().isBlank()) throw new RegraNegocioException("Informe o nome da turma.");
        Modalidade modalidade = modalidadeRepository.findById(Objects.requireNonNullElse(form.modalidadeId(), -1))
            .orElseThrow(() -> new RecursoNaoEncontradoException("Modalidade"));
        Usuario professor = catalogo.usuario(form.professorId());
        if (!"PROFESSOR".equals(professor.getPerfil()) || !Boolean.TRUE.equals(professor.getAtivo())) {
            throw new RegraNegocioException("O responsável precisa ser um professor ativo.");
        }
        Sala sala = null;
        if (form.salaId() != null) {
            sala = salaRepository.findById(form.salaId()).orElseThrow(() -> new RecursoNaoEncontradoException("Sala"));
        }
        Set<DayOfWeek> dias = diasDoForm(form);
        LocalTime inicio = parseHora(form.horarioInicio(), "início");
        LocalTime fim = parseHora(form.horarioFim(), "término");
        if (!fim.isAfter(inicio)) throw new RegraNegocioException("O horário de término deve ser após o início.");
        if (form.limiteVagas() == null || form.limiteVagas() < 1) throw new RegraNegocioException("Informe o limite de vagas.");
        if (sala != null && form.limiteVagas() > sala.getCapacidade()) {
            throw new RegraNegocioException("LOTACAO_SALA", "O limite de vagas (" + form.limiteVagas()
                + ") excede a capacidade da sala " + sala.getNome() + " (" + sala.getCapacidade() + ").");
        }
        if (!nova) {
            long ocupadas = matriculaRepository.countByIdTurmaAndStatus(turma.getId(), "ATIVA");
            if (form.limiteVagas() < ocupadas) {
                throw new RegraNegocioException("A turma já possui " + ocupadas + " alunos ativos; o limite não pode ser menor.");
            }
        }
        String nivel = form.nivel() == null ? "TODOS_OS_NIVEIS" : form.nivel().toUpperCase();
        if (!NIVEIS.contains(nivel)) throw new RegraNegocioException("Nível inválido.");

        boolean ativa = form.ativo() == null || form.ativo();
        if (ativa) {
            List<Conflito> conflitos = conflitos(dias, inicio, fim, form.salaId(), form.professorId(), id, catalogo.contexto());
            if (!conflitos.isEmpty()) {
                throw new ConflitoException("CONFLITO_GRADE",
                    "Conflito de horário detectado: " + conflitos.get(0).mensagem(), conflitos);
            }
        }

        Integer professorAnterior = turma.getProfessorId();
        String horarioAnterior = turma.getDiasSemana() + " " + CatalogoService.hora(turma.getHorario());

        turma.setNomeTurma(form.nome().trim());
        turma.setModalidade(modalidade);
        turma.setProfessorId(professor.getId());
        turma.setSalaId(sala == null ? null : sala.getId());
        turma.setDiasSemana(AgendaUtil.formatarDias(form.dias()));
        turma.setHorario(inicio);
        turma.setHorarioFim(fim);
        turma.setNivel(nivel);
        turma.setLimiteVagas(form.limiteVagas());
        turma.setAtivo(ativa);
        Turma salva = turmaRepository.save(turma);

        auditoria.registrar(operador, nova ? "CRIAR" : "EDITAR", "TURMA", salva.getId(),
            (nova ? "Turma criada: " : "Turma atualizada: ") + salva.getNomeTurma() + " · " + salva.getDiasSemana()
                + " " + CatalogoService.hora(inicio) + "–" + CatalogoService.hora(fim));

        if (nova) {
            notificacoes.notificar(professor.getId(), "Nova turma atribuída",
                "Você foi alocado(a) em \"" + salva.getNomeTurma() + "\" · " + salva.getDiasSemana() + " às "
                    + CatalogoService.hora(inicio) + ".", "AGENDA", "#/hoje");
        } else {
            String horarioNovo = salva.getDiasSemana() + " " + CatalogoService.hora(salva.getHorario());
            List<Integer> impactados = new ArrayList<>(matriculaRepository.findByIdTurmaAndStatus(salva.getId(), "ATIVA")
                .stream().map(m -> m.getIdAluno()).toList());
            impactados.add(salva.getProfessorId());
            if (!Objects.equals(professorAnterior, salva.getProfessorId())) impactados.add(professorAnterior);
            if (!horarioNovo.equals(horarioAnterior) || !Objects.equals(professorAnterior, salva.getProfessorId())) {
                notificacoes.notificar(impactados, "Turma atualizada: " + salva.getNomeTurma(),
                    "Novo horário: " + horarioNovo + " · Prof. " + professor.getNome() + ".", "AGENDA", "#/agenda");
            }
        }
        CatalogoService.Contexto ctx = catalogo.contexto();
        return catalogo.turma(salva, ctx);
    }

    @Transactional
    public void encerrarTurma(Integer id, Usuario operador) {
        Turma turma = catalogo.turma(id);
        turma.setAtivo(false);
        turmaRepository.save(turma);
        List<Integer> alunos = matriculaRepository.findByIdTurmaAndStatus(id, "ATIVA").stream()
            .map(m -> m.getIdAluno()).toList();
        auditoria.registrar(operador, "ENCERRAR", "TURMA", id, "Turma encerrada: " + turma.getNomeTurma());
        List<Integer> destinos = new ArrayList<>(alunos);
        destinos.add(turma.getProfessorId());
        notificacoes.notificar(destinos, "Turma encerrada", "A turma \"" + turma.getNomeTurma()
            + "\" foi encerrada pela administração.", "ALERTA", null);
    }

    // ================================================================== salas

    @Transactional
    public SalaItem salvarSala(Integer id, SalaForm form, Usuario operador) {
        if (form.nome() == null || form.nome().isBlank()) throw new RegraNegocioException("Informe o nome da sala.");
        if (form.capacidade() == null || form.capacidade() < 1) throw new RegraNegocioException("Capacidade inválida.");
        Sala sala = id == null ? new Sala()
            : salaRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Sala"));
        if (id != null) {
            Integer maiorTurma = turmaRepository.findAll().stream()
                .filter(t -> id.equals(t.getSalaId()) && !Boolean.FALSE.equals(t.getAtivo()))
                .map(Turma::getLimiteVagas).max(Integer::compare).orElse(0);
            if (form.capacidade() < maiorTurma) {
                throw new RegraNegocioException("Há turmas nesta sala com limite de " + maiorTurma + " vagas.");
            }
        }
        sala.setNome(form.nome().trim());
        sala.setCapacidade(form.capacidade());
        sala.setRecursos(form.recursos());
        sala.setAtivo(form.ativo() == null || form.ativo());
        Sala salva = salaRepository.save(sala);
        auditoria.registrar(operador, id == null ? "CRIAR" : "EDITAR", "SALA", salva.getId(), "Sala " + salva.getNome());
        return catalogo.sala(salva);
    }

    // ============================================================ modalidades

    @Transactional
    public ModalidadeItem salvarModalidade(Integer id, ModalidadeForm form, Usuario operador) {
        if (form.nome() == null || form.nome().isBlank()) throw new RegraNegocioException("Informe o nome da modalidade.");
        Modalidade m = id == null ? new Modalidade()
            : modalidadeRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Modalidade"));
        m.setNome(form.nome().trim());
        m.setCategoria(form.categoria());
        m.setDescricao(form.descricao());
        m.setIcone(form.icone() == null || form.icone().isBlank() ? "fa-music" : form.icone());
        m.setStatus(form.ativo() == null || form.ativo());
        Modalidade salva = modalidadeRepository.save(m);
        auditoria.registrar(operador, id == null ? "CRIAR" : "EDITAR", "MODALIDADE", salva.getId(), "Modalidade " + salva.getNome());
        return new ModalidadeItem(salva.getId(), salva.getNome(), salva.getCategoria(), salva.getDescricao(),
            salva.getIcone(), salva.getStatus(), 0, 0);
    }

    // ================================================================ helpers

    private Set<DayOfWeek> diasDoForm(TurmaForm form) {
        if (form.dias() == null || form.dias().isEmpty()) {
            throw new RegraNegocioException("Selecione ao menos um dia da semana.");
        }
        Set<DayOfWeek> dias = EnumSet.noneOf(DayOfWeek.class);
        for (Integer d : form.dias()) {
            if (d == null || d < 1 || d > 7) throw new RegraNegocioException("Dia da semana inválido.");
            dias.add(DayOfWeek.of(d));
        }
        return dias;
    }

    private LocalTime parseHora(String valor, String rotulo) {
        if (valor == null || valor.isBlank()) throw new RegraNegocioException("Informe o horário de " + rotulo + ".");
        try {
            return LocalTime.parse(valor.length() == 5 ? valor : valor.substring(0, 5));
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            throw new RegraNegocioException("Horário de " + rotulo + " inválido (use HH:mm).");
        }
    }
}
