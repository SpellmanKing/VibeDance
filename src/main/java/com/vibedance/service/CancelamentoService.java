package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.*;
import com.vibedance.repository.FaturaRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.SolicitacaoCancelamentoRepository;
import com.vibedance.util.AgendaUtil;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Fluxo de cancelamento de matrícula: o aluno solicita (com resumo de turmas e situação
 * financeira), o ADM aprova — liberando as vagas — ou recusa com parecer obrigatório.
 * Uma solicitação em análise por aluno (regra no serviço e índice único no banco).
 */
@Service
public class CancelamentoService {

    public static final Map<String, String> MOTIVOS = Map.of(
        "FINANCEIRO", "Motivos financeiros",
        "HORARIO", "Incompatibilidade de horário",
        "MUDANCA", "Mudança de cidade",
        "SAUDE", "Saúde ou lesão",
        "INSATISFACAO", "Insatisfação com as aulas",
        "OUTRO", "Outro motivo");

    private final SolicitacaoCancelamentoRepository repository;
    private final MatriculaRepository matriculaRepository;
    private final FaturaRepository faturaRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;

    public CancelamentoService(SolicitacaoCancelamentoRepository repository, MatriculaRepository matriculaRepository,
                               FaturaRepository faturaRepository, CatalogoService catalogo, AuditoriaService auditoria,
                               NotificacaoService notificacoes) {
        this.repository = repository;
        this.matriculaRepository = matriculaRepository;
        this.faturaRepository = faturaRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
    }

    // ================================================================ leitura

    @Transactional(readOnly = true)
    public CancelamentoAluno doAluno(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<SolicitacaoCancelamentoItem> historico = repository.findByIdAlunoOrderBySolicitadoEmDesc(u.getId()).stream()
            .map(s -> item(s, ctx, null)).toList();
        SolicitacaoCancelamentoItem pendente = historico.stream()
            .filter(s -> "SOLICITADA".equals(s.status())).findFirst().orElse(null);
        return new CancelamentoAluno(catalogo.turmas(turmasAtivas(u.getId(), ctx), ctx), diagnostico(u.getId(), ctx),
            pendente, historico);
    }

    @Transactional(readOnly = true)
    public List<SolicitacaoCancelamentoItem> listar(String status) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        return repository.findAllByOrderBySolicitadoEmDesc().stream()
            .filter(s -> status == null || status.isBlank() || status.equalsIgnoreCase(s.getStatus()))
            .map(s -> item(s, ctx, diagnostico(s.getIdAluno(), ctx)))
            .toList();
    }

    @Transactional(readOnly = true)
    public SolicitacaoCancelamentoItem detalhe(Integer id) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        SolicitacaoCancelamento s = buscar(id);
        return item(s, ctx, diagnostico(s.getIdAluno(), ctx));
    }

    // ================================================================ aluno

    @Transactional
    public CancelamentoAluno solicitar(Usuario u, CancelamentoForm form) {
        if (repository.existsByIdAlunoAndStatus(u.getId(), "SOLICITADA")) {
            throw new ConflitoException("CANCELAMENTO_PENDENTE",
                "Você já tem uma solicitação de cancelamento em análise. Aguarde a resposta da administração.");
        }
        CatalogoService.Contexto ctx = catalogo.contexto();
        Set<Integer> ativas = new HashSet<>(turmasAtivas(u.getId(), ctx).stream().map(Turma::getId).toList());
        if (ativas.isEmpty()) throw new RegraNegocioException("Você não tem turmas ativas para cancelar.");

        List<Integer> escolhidas = form == null || form.turmas() == null ? List.of() : form.turmas().stream()
            .filter(Objects::nonNull).distinct().toList();
        if (escolhidas.isEmpty()) throw new RegraNegocioException("Selecione ao menos uma turma.");
        if (!ativas.containsAll(escolhidas)) throw new RegraNegocioException("Só é possível cancelar turmas em que você está matriculado(a).");

        String motivo = form.motivo() == null ? "" : form.motivo().trim().toUpperCase();
        if (!MOTIVOS.containsKey(motivo)) throw new RegraNegocioException("Selecione o motivo do cancelamento.");
        String justificativa = form.justificativa() == null ? "" : form.justificativa().trim();
        if (justificativa.length() < 10) {
            throw new RegraNegocioException("Conte um pouco mais sobre o motivo (mínimo de 10 caracteres).");
        }
        if (justificativa.length() > 1000) throw new RegraNegocioException("A justificativa deve ter até 1000 caracteres.");

        SolicitacaoCancelamento s = new SolicitacaoCancelamento();
        s.setIdAluno(u.getId());
        s.setIdsTurmas(escolhidas);
        s.setMotivo(motivo);
        s.setJustificativa(justificativa);
        s.setStatus("SOLICITADA");
        try {
            repository.saveAndFlush(s);
        } catch (DataIntegrityViolationException e) {
            throw new ConflitoException("CANCELAMENTO_PENDENTE", "Você já tem uma solicitação de cancelamento em análise.");
        }

        String turmas = nomesTurmas(escolhidas, ctx);
        auditoria.registrar(u, "SOLICITAR", "CANCELAMENTO", s.getId(), "Cancelamento solicitado: " + turmas);
        notificacoes.notificarAdmins("Nova solicitação de cancelamento",
            u.getNome() + " pediu cancelamento em " + turmas + ".", "ALERTA", "#/cancelamentos?id=" + s.getId());
        return doAluno(u);
    }

    // ================================================================ ADM

    @Transactional
    public SolicitacaoCancelamentoItem aprovar(Integer id, DecisaoRequest req, Usuario operador) {
        SolicitacaoCancelamento s = buscarPendente(id);
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<String> canceladas = new ArrayList<>();
        for (Integer idTurma : s.getIdsTurmas()) {
            matriculaRepository.findByIdAlunoAndIdTurma(s.getIdAluno(), idTurma)
                .filter(m -> "ATIVA".equals(m.getStatus()))
                .ifPresent(m -> {
                    m.setStatus("CANCELADA");
                    matriculaRepository.save(m);
                    Turma t = ctx.turmas().get(idTurma);
                    canceladas.add(t == null ? "turma #" + idTurma : t.getNomeTurma());
                    if (t != null && t.getProfessorId() != null) {
                        notificacoes.notificar(t.getProfessorId(), "Aluno saiu da turma",
                            ctx.nomeUsuario(s.getIdAluno()) + " teve a matrícula em " + t.getNomeTurma() + " cancelada.",
                            "INFO", "#/turmas");
                    }
                });
        }
        String resposta = req == null || req.resposta() == null || req.resposta().isBlank() ? null : req.resposta().trim();
        s.setStatus("APROVADA");
        s.setResposta(resposta);
        s.setAvaliadoPor(operador.getId());
        s.setAvaliadoEm(LocalDateTime.now(AgendaUtil.FUSO));
        repository.save(s);

        String lista = canceladas.isEmpty() ? "nenhuma turma ativa restante" : String.join(", ", canceladas);
        auditoria.registrar(operador, "APROVAR", "CANCELAMENTO", s.getId(),
            "Cancelamento aprovado para " + ctx.nomeUsuario(s.getIdAluno()) + ": " + lista);
        notificacoes.notificar(s.getIdAluno(), "Cancelamento aprovado",
            "Sua matrícula em " + lista + " foi cancelada." + (resposta == null ? "" : " " + resposta), "INFO", "#/matricula");
        return item(s, catalogo.contexto(), diagnostico(s.getIdAluno(), catalogo.contexto()));
    }

    @Transactional
    public SolicitacaoCancelamentoItem recusar(Integer id, DecisaoRequest req, Usuario operador) {
        String resposta = req == null || req.resposta() == null ? "" : req.resposta().trim();
        if (resposta.length() < 5) throw new RegraNegocioException("Escreva o parecer que será exibido ao aluno.");
        SolicitacaoCancelamento s = buscarPendente(id);
        CatalogoService.Contexto ctx = catalogo.contexto();
        s.setStatus("RECUSADA");
        s.setResposta(resposta);
        s.setAvaliadoPor(operador.getId());
        s.setAvaliadoEm(LocalDateTime.now(AgendaUtil.FUSO));
        repository.save(s);
        auditoria.registrar(operador, "RECUSAR", "CANCELAMENTO", s.getId(),
            "Cancelamento recusado para " + ctx.nomeUsuario(s.getIdAluno()) + " · " + resposta);
        notificacoes.notificar(s.getIdAluno(), "Solicitação de cancelamento respondida",
            "Sua matrícula foi mantida. Parecer: " + resposta, "ALERTA", "#/matricula");
        return item(s, ctx, diagnostico(s.getIdAluno(), ctx));
    }

    @Transactional(readOnly = true)
    public long pendentes() {
        return repository.countByStatus("SOLICITADA");
    }

    // ================================================================ helpers

    private SolicitacaoCancelamento buscar(Integer id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Solicitação de cancelamento"));
    }

    private SolicitacaoCancelamento buscarPendente(Integer id) {
        SolicitacaoCancelamento s = buscar(id);
        if (!"SOLICITADA".equals(s.getStatus())) {
            throw new ConflitoException("JA_AVALIADA", "Esta solicitação já foi avaliada.");
        }
        return s;
    }

    private List<Turma> turmasAtivas(Integer alunoId, CatalogoService.Contexto ctx) {
        return matriculaRepository.findByIdAlunoAndStatus(alunoId, "ATIVA").stream()
            .map(m -> ctx.turmas().get(m.getIdTurma()))
            .filter(t -> t != null && !Boolean.FALSE.equals(t.getAtivo()))
            .toList();
    }

    private static String nomesTurmas(List<Integer> ids, CatalogoService.Contexto ctx) {
        return String.join(", ", ids.stream().map(ctx::nomeTurma).toList());
    }

    DiagnosticoFinanceiro diagnostico(Integer alunoId, CatalogoService.Contexto ctx) {
        List<Fatura> abertas = faturaRepository.findByIdAlunoOrderByDataVencimentoDesc(alunoId).stream()
            .filter(f -> Set.of("PENDENTE", "VENCIDO", "EM_ANALISE").contains(f.getStatus()))
            .sorted(Comparator.comparing(Fatura::getDataVencimento))
            .toList();
        BigDecimal total = abertas.stream().map(Fatura::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal atrasado = abertas.stream().filter(f -> "VENCIDO".equals(f.getStatus()))
            .map(Fatura::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
        long nAtrasadas = abertas.stream().filter(f -> "VENCIDO".equals(f.getStatus())).count();
        long nPendentes = abertas.stream().filter(f -> "PENDENTE".equals(f.getStatus())).count();
        long nAnalise = abertas.stream().filter(f -> "EM_ANALISE".equals(f.getStatus())).count();
        return new DiagnosticoFinanceiro(nAtrasadas == 0, total, atrasado, nAtrasadas, nPendentes, nAnalise,
            abertas.stream().map(f -> catalogo.fatura(f, ctx)).toList());
    }

    private SolicitacaoCancelamentoItem item(SolicitacaoCancelamento s, CatalogoService.Contexto ctx,
                                             DiagnosticoFinanceiro diagnostico) {
        Usuario aluno = ctx.usuarios().get(s.getIdAluno());
        List<TurmaResumo> turmas = s.getIdsTurmas().stream().map(id -> ctx.turmas().get(id))
            .filter(Objects::nonNull).map(t -> catalogo.turma(t, ctx)).toList();
        return new SolicitacaoCancelamentoItem(s.getId(), s.getIdAluno(), aluno == null ? "—" : aluno.getNome(),
            aluno == null ? null : aluno.getEmail(), String.format("VD-%06d", s.getIdAluno()), turmas, s.getMotivo(),
            s.getJustificativa(), s.getStatus(), s.getResposta(),
            s.getAvaliadoPor() == null ? null : ctx.nomeUsuario(s.getAvaliadoPor()), s.getSolicitadoEm(),
            s.getAvaliadoEm(), diagnostico);
    }
}
