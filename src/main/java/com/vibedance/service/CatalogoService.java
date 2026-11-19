package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.model.*;
import com.vibedance.repository.*;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Leitura consolidada e mapeamento entidade → DTO. Carrega usuários, turmas e salas
 * em um {@link Contexto} por requisição para evitar N+1 nas telas densas.
 */
@Service
@Transactional(readOnly = true)
public class CatalogoService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final UsuarioRepository usuarioRepository;
    private final TurmaRepository turmaRepository;
    private final SalaRepository salaRepository;
    private final MatriculaRepository matriculaRepository;

    public CatalogoService(UsuarioRepository usuarioRepository, TurmaRepository turmaRepository,
                           SalaRepository salaRepository, MatriculaRepository matriculaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.turmaRepository = turmaRepository;
        this.salaRepository = salaRepository;
        this.matriculaRepository = matriculaRepository;
    }

    /** Snapshot de lookup usado durante uma única requisição. */
    public final class Contexto {
        private Map<Integer, Usuario> usuarios;
        private Map<Integer, Turma> turmas;
        private Map<Integer, Sala> salas;
        private Map<Integer, Integer> ocupadas;

        public Map<Integer, Usuario> usuarios() {
            if (usuarios == null) {
                usuarios = usuarioRepository.findAll().stream()
                    .collect(Collectors.toMap(Usuario::getId, Function.identity()));
            }
            return usuarios;
        }

        public Map<Integer, Turma> turmas() {
            if (turmas == null) {
                turmas = turmaRepository.findAll().stream()
                    .collect(Collectors.toMap(Turma::getId, Function.identity()));
            }
            return turmas;
        }

        public Map<Integer, Sala> salas() {
            if (salas == null) {
                salas = salaRepository.findAll().stream()
                    .collect(Collectors.toMap(Sala::getId, Function.identity()));
            }
            return salas;
        }

        public Map<Integer, Integer> ocupadas() {
            if (ocupadas == null) {
                ocupadas = new HashMap<>();
                for (Object[] linha : matriculaRepository.contarAtivasPorTurma()) {
                    ocupadas.put((Integer) linha[0], ((Number) linha[1]).intValue());
                }
            }
            return ocupadas;
        }

        public String nomeUsuario(Integer id) {
            Usuario u = id == null ? null : usuarios().get(id);
            return u == null ? "—" : u.getNome();
        }

        public String nomeTurma(Integer id) {
            Turma t = id == null ? null : turmas().get(id);
            return t == null ? "—" : t.getNomeTurma();
        }
    }

    public Contexto contexto() {
        return new Contexto();
    }

    // ------------------------------------------------------------------ busca

    public Turma turma(Integer id) {
        if (id == null) {
            throw new RecursoNaoEncontradoException("Turma");
        }
        return turmaRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Turma"));
    }

    public Usuario usuario(Integer id) {
        if (id == null) {
            throw new RecursoNaoEncontradoException("Usuário");
        }
        return usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário"));
    }

    // -------------------------------------------------------------- mapeadores

    public static String hora(LocalTime t) {
        return t == null ? null : t.format(HH_MM);
    }

    public UsuarioResumo usuario(Usuario u) {
        if (u == null) {
            return null;
        }
        return new UsuarioResumo(u.getId(), u.getNome(), u.getEmail(), u.getPerfil(), u.getTelefone(), u.getCpf(),
            u.getAtivo(), u.getAvatarUrl(), u.getDataCadastro());
    }

    public TurmaResumo turma(Turma t, Contexto ctx) {
        if (t == null) {
            return null;
        }
        Modalidade m = t.getModalidade();
        Sala sala = t.getSalaId() == null ? null : ctx.salas().get(t.getSalaId());
        return new TurmaResumo(
            t.getId(), t.getNomeTurma(),
            m == null ? null : m.getId(), m == null ? null : m.getNome(),
            m == null ? "fa-music" : m.getIcone(), m == null ? null : m.getCategoria(),
            t.getProfessorId(), ctx.nomeUsuario(t.getProfessorId()),
            t.getSalaId(), sala == null ? "Sem sala" : sala.getNome(), sala == null ? null : sala.getCapacidade(),
            t.getDiasSemana(), AgendaUtil.diasComoNumeros(t.getDiasSemana()),
            hora(t.getHorario()), hora(t.getHorarioFim()), t.getNivel(), t.getLimiteVagas(),
            ctx.ocupadas().getOrDefault(t.getId(), 0), Boolean.TRUE.equals(t.getAtivo()) || t.getAtivo() == null);
    }

    public List<TurmaResumo> turmas(Collection<Turma> turmas, Contexto ctx) {
        return turmas.stream()
            .sorted(Comparator.comparing(Turma::getHorario, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(t -> turma(t, ctx))
            .toList();
    }

    public SalaItem sala(Sala s) {
        return new SalaItem(s.getId(), s.getNome(), s.getCapacidade(), s.getRecursos(),
            s.getAtivo() == null || s.getAtivo());
    }

    public FaturaItem fatura(Fatura f, Contexto ctx) {
        long atraso = 0;
        if (f.getDataVencimento() != null && !"CONFIRMADO".equals(f.getStatus()) && !"CANCELADO".equals(f.getStatus())) {
            atraso = Math.max(0, ChronoUnit.DAYS.between(f.getDataVencimento(), AgendaUtil.hoje()));
        }
        return new FaturaItem(f.getId(), f.getIdAluno(), ctx.nomeUsuario(f.getIdAluno()), f.getIdTurma(),
            f.getIdTurma() == null ? null : ctx.nomeTurma(f.getIdTurma()), f.getTitulo(), f.getMesReferencia(),
            f.getValor(), f.getDataVencimento(), f.getStatus(), atraso, f.getPixCopiaCola(), f.getCriadoEm(),
            f.getValorOriginal() == null ? f.getValor() : f.getValorOriginal(), f.getDesconto(), f.getMotivoDesconto(),
            f.getObservacao(), f.getOrigem());
    }

    public PagamentoItem pagamento(Pagamento p, Map<Integer, Fatura> faturas, Contexto ctx) {
        Fatura f = faturas.get(p.getIdFatura());
        return new PagamentoItem(p.getId(), p.getIdFatura(), f == null ? "Fatura #" + p.getIdFatura() : f.getTitulo(),
            p.getIdAluno(), ctx.nomeUsuario(p.getIdAluno()), p.getFormaPagamento(), p.getValorPago(), p.getStatus(),
            p.getComprovanteNome(), p.getComprovanteUrl() != null && !p.getComprovanteUrl().isBlank(),
            p.getDataConfirmacao(), p.getCriadoEm(), p.getObservacao());
    }

    public ComunicadoItem comunicado(Comunicado c) {
        Usuario autor = c.getProfessor();
        Turma turma = c.getTurma();
        return new ComunicadoItem(c.getId(), c.getTitulo(), c.getConteudo(), c.getLinkAnexo(),
            Boolean.TRUE.equals(c.getUrgente()), c.getDataPostagem(),
            turma == null ? null : turma.getId(), turma == null ? "Todo o estúdio" : turma.getNomeTurma(),
            autor == null ? "Estúdio" : autor.getNome(), autor == null ? null : autor.getPerfil(),
            turma == null || (autor != null && "ADMINISTRADOR".equals(autor.getPerfil())));
    }

    public static BigDecimal media(AvaliacaoTecnica a) {
        return a.getNotaRitmo().add(a.getNotaTecnica()).add(a.getNotaExpressao()).add(a.getNotaCoreografia())
            .divide(BigDecimal.valueOf(4), 1, RoundingMode.HALF_UP);
    }

    public AvaliacaoItem avaliacao(AvaliacaoTecnica a, Contexto ctx) {
        return new AvaliacaoItem(a.getId(), a.getIdTurma(), ctx.nomeTurma(a.getIdTurma()), a.getIdAluno(),
            ctx.nomeUsuario(a.getIdAluno()), ctx.nomeUsuario(a.getIdProfessor()), a.getCoreografiaFoco(),
            a.getNotaRitmo(), a.getNotaTecnica(), a.getNotaExpressao(), a.getNotaCoreografia(), media(a),
            a.getFeedbackTexto(), a.getLinkReferencia(), a.getDataAvaliacao());
    }

    public DiarioItem diario(DiarioClasse d, Contexto ctx) {
        List<String> links = d.getLinksReferencia() == null || d.getLinksReferencia().isBlank()
            ? List.of()
            : Arrays.stream(d.getLinksReferencia().split("\\R")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return new DiarioItem(d.getId(), d.getIdTurma(), ctx.nomeTurma(d.getIdTurma()), d.getDataAula(),
            d.getConteudo(), d.getCoreografia(), links, d.getObservacoes(), ctx.nomeUsuario(d.getIdProfessor()),
            d.getAtualizadoEm());
    }

    public ReposicaoItem reposicao(Reposicao r, Contexto ctx) {
        Turma destino = ctx.turmas().get(r.getIdTurmaDestino());
        String horario = destino == null ? null : hora(destino.getHorario()) + "–" + hora(destino.getHorarioFim());
        return new ReposicaoItem(r.getId(), r.getIdAluno(), ctx.nomeUsuario(r.getIdAluno()), r.getIdTurmaOrigem(),
            r.getIdTurmaOrigem() == null ? null : ctx.nomeTurma(r.getIdTurmaOrigem()), r.getIdTurmaDestino(),
            ctx.nomeTurma(r.getIdTurmaDestino()), r.getDataFalta(), r.getDataAulaDestino(), horario, r.getTipo(),
            r.getStatus(), r.getMotivo(), r.getResposta(), r.getSolicitadoEm(), r.getAvaliadoEm());
    }

    public AuditoriaItem auditoria(AuditoriaGeral a) {
        return new AuditoriaItem(a.getId(), a.getDataHora(), a.getUsuarioNome(), a.getPerfil(), a.getAcao(),
            a.getEntidade(), a.getIdEntidade(), a.getDescricao(), a.getIpOrigem(), "SISTEMA");
    }

    public AuditoriaItem auditoria(AuditoriaPagamento a, Contexto ctx) {
        Usuario u = ctx.usuarios().get(a.getIdUsuarioOperador());
        String desc = (a.getStatusAnterior() == null ? "" : a.getStatusAnterior() + " → ")
            + (a.getStatusNovo() == null ? "" : a.getStatusNovo())
            + (a.getMotivoObservacao() == null ? "" : " · " + a.getMotivoObservacao());
        return new AuditoriaItem(a.getId(), a.getDataHora(), u == null ? "—" : u.getNome(),
            u == null ? null : u.getPerfil(), a.getAcao(), "PAGAMENTO", a.getIdPagamento(), desc,
            a.getIpOrigem(), "FINANCEIRO");
    }

    public static double percentual(long parte, long total) {
        if (total <= 0) {
            return 0d;
        }
        return Math.round(parte * 1000.0 / total) / 10.0;
    }
}
