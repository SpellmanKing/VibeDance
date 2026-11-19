package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Fatura;
import com.vibedance.model.Matricula;
import com.vibedance.model.Pagamento;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.FaturaRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.PagamentoRepository;
import com.vibedance.util.AgendaUtil;
import com.vibedance.util.RequestUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Gestão financeira do ADM: mensalidades (Pago/Pendente/Atrasado), lançamentos em
 * lote, baixa rápida, conferência de comprovantes e histórico de transações.
 * Toda mudança reflete instantaneamente no portal do aluno (SSE pós-commit).
 */
@Service
public class FinanceiroAdminService {

    private static final Logger log = LoggerFactory.getLogger(FinanceiroAdminService.class);
    private static final Set<String> FORMAS = Set.of("PIX", "CARTAO_CREDITO", "BOLETO", "COMPROVANTE_MANUAL");
    private static final String[] MESES = {"Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
        "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"};

    private final FaturaRepository faturaRepository;
    private final PagamentoRepository pagamentoRepository;
    private final MatriculaRepository matriculaRepository;
    private final AuditoriaPagamentoService auditoriaPagamento;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;
    private final CatalogoService catalogo;

    public FinanceiroAdminService(FaturaRepository faturaRepository, PagamentoRepository pagamentoRepository,
                                  MatriculaRepository matriculaRepository, AuditoriaPagamentoService auditoriaPagamento,
                                  AuditoriaService auditoria, NotificacaoService notificacoes, CatalogoService catalogo) {
        this.faturaRepository = faturaRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.matriculaRepository = matriculaRepository;
        this.auditoriaPagamento = auditoriaPagamento;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
        this.catalogo = catalogo;
    }

    // ================================================================ leitura

    @Transactional(readOnly = true)
    public FinanceiroAdmin painel(String status, String mes, String busca) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Fatura> todas = faturaRepository.findAllByOrderByDataVencimentoDesc();
        String termo = busca == null ? "" : busca.trim().toLowerCase();

        List<FaturaItem> filtradas = todas.stream()
            .filter(f -> status == null || status.isBlank() || status.equalsIgnoreCase(f.getStatus()))
            .filter(f -> mes == null || mes.isBlank() || mes.equals(f.getMesReferencia()))
            .map(f -> catalogo.fatura(f, ctx))
            .filter(f -> termo.isEmpty() || f.alunoNome().toLowerCase().contains(termo)
                || f.titulo().toLowerCase().contains(termo))
            .toList();

        String mesAtual = YearMonth.now(AgendaUtil.FUSO).toString();
        BigDecimal recebidoMes = BigDecimal.ZERO, emAberto = BigDecimal.ZERO, vencido = BigDecimal.ZERO;
        long pagas = 0, pendentes = 0, atrasadas = 0, emAnalise = 0;
        for (Fatura f : todas) {
            switch (f.getStatus()) {
                case "CONFIRMADO" -> {
                    pagas++;
                    if (mesAtual.equals(f.getMesReferencia())) recebidoMes = recebidoMes.add(f.getValor());
                }
                case "PENDENTE" -> {
                    pendentes++;
                    emAberto = emAberto.add(f.getValor());
                }
                case "VENCIDO" -> {
                    atrasadas++;
                    vencido = vencido.add(f.getValor());
                    emAberto = emAberto.add(f.getValor());
                }
                case "EM_ANALISE" -> {
                    emAnalise++;
                    emAberto = emAberto.add(f.getValor());
                }
                default -> { }
            }
        }
        return new FinanceiroAdmin(new ResumoFinanceiro(recebidoMes, emAberto, vencido, pagas, pendentes, atrasadas,
            emAnalise), filtradas);
    }

    @Transactional(readOnly = true)
    public List<PagamentoItem> transacoes(String status) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Map<Integer, Fatura> faturas = faturaRepository.findAll().stream()
            .collect(Collectors.toMap(Fatura::getId, Function.identity()));
        List<Pagamento> pagamentos = status == null || status.isBlank()
            ? pagamentoRepository.findAllByOrderByCriadoEmDesc()
            : pagamentoRepository.findByStatusOrderByCriadoEmDesc(status.toUpperCase());
        return pagamentos.stream().map(p -> catalogo.pagamento(p, faturas, ctx)).toList();
    }

    @Transactional(readOnly = true)
    public List<PagamentoItem> pagamentosDaFatura(Integer faturaId) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Fatura f = buscar(faturaId);
        Map<Integer, Fatura> mapa = Map.of(f.getId(), f);
        return pagamentoRepository.findByIdFaturaOrderByCriadoEmDesc(faturaId).stream()
            .map(p -> catalogo.pagamento(p, mapa, ctx)).toList();
    }

    // ============================================================ lançamentos

    @Transactional
    public LoteResultado gerarLote(LoteFaturasRequest req, Usuario operador) {
        YearMonth mes;
        try {
            mes = YearMonth.parse(req.mesReferencia());
        } catch (DateTimeParseException | NullPointerException e) {
            throw new RegraNegocioException("Mês de referência inválido (use AAAA-MM).");
        }
        if (req.valor() == null || req.valor().signum() <= 0) throw new RegraNegocioException("Informe um valor positivo.");
        if (req.dataVencimento() == null) throw new RegraNegocioException("Informe a data de vencimento.");

        Set<Integer> filtroAlunos = req.alunos() == null ? Set.of() : new HashSet<>(req.alunos());
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Matricula> ativas = matriculaRepository.findByStatus("ATIVA");

        int criadas = 0, ignoradas = 0;
        List<String> avisos = new ArrayList<>();
        Map<Integer, Integer> criadasPorAluno = new HashMap<>();

        for (Matricula m : ativas) {
            if (!filtroAlunos.isEmpty() && !filtroAlunos.contains(m.getIdAluno())) continue;
            Usuario aluno = ctx.usuarios().get(m.getIdAluno());
            Turma turma = ctx.turmas().get(m.getIdTurma());
            if (aluno == null || turma == null || !Boolean.TRUE.equals(aluno.getAtivo())) {
                ignoradas++;
                continue;
            }
            if (faturaRepository.existsByIdAlunoAndIdTurmaAndMesReferenciaAndStatusNot(
                aluno.getId(), turma.getId(), mes.toString(), "CANCELADO")) {
                ignoradas++;
                continue;
            }
            Fatura f = new Fatura();
            f.setIdAluno(aluno.getId());
            f.setIdTurma(turma.getId());
            f.setIdPacote(req.idPacote());
            f.setTitulo(tituloMensalidade(mes, turma.getNomeTurma()));
            f.setMesReferencia(mes.toString());
            f.setValor(req.valor());
            f.setDataVencimento(req.dataVencimento());
            f.setStatus(req.dataVencimento().isBefore(AgendaUtil.hoje()) ? "VENCIDO" : "PENDENTE");
            f.setPixCopiaCola(gerarPixCopiaCola(aluno.getId(), turma.getId(), mes, req.valor()));
            faturaRepository.save(f);
            criadas++;
            criadasPorAluno.merge(aluno.getId(), 1, Integer::sum);
        }
        if (criadas == 0) {
            avisos.add("Nenhuma fatura nova: todos os alunos selecionados já possuem cobrança neste mês.");
        }
        for (Map.Entry<Integer, Integer> e : criadasPorAluno.entrySet()) {
            notificacoes.notificar(e.getKey(), "Nova mensalidade disponível",
                e.getValue() + " cobrança(s) de " + mesExtenso(mes) + " com vencimento em "
                    + req.dataVencimento().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM")) + ".",
                "FINANCEIRO", "#/financeiro");
        }
        auditoria.registrar(operador, "LOTE", "FATURA", null, "Lote " + mes + ": " + criadas + " fatura(s) criadas, "
            + ignoradas + " ignoradas · R$ " + req.valor());
        return new LoteResultado(criadas, ignoradas, criadas + ignoradas, avisos);
    }

    // ============================================================ cobrança individual

    /** Motivos aceitos para desconto (exibidos no portal do aluno e no comprovante). */
    public static final Map<String, String> MOTIVOS_DESCONTO = Map.of(
        "BOLSA", "Bolsa de estudos",
        "IRMAOS", "Desconto família",
        "PRO_RATA", "Proporcional (entrada no mês)",
        "CONVENIO", "Convênio / parceria",
        "PONTUALIDADE", "Pagamento antecipado",
        "NEGOCIACAO", "Negociação",
        "PROMOCIONAL", "Promoção",
        "CORTESIA", "Cortesia",
        "OUTRO", "Condição especial");

    /** Alunos ativos com suas turmas e os meses já cobrados (para o formulário de cobrança individual). */
    @Transactional(readOnly = true)
    public List<AlunoCobranca> alunosParaCobranca() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Map<Integer, List<Matricula>> porAluno = matriculaRepository.findByStatus("ATIVA").stream()
            .collect(Collectors.groupingBy(Matricula::getIdAluno));
        Map<String, List<String>> cobrados = new HashMap<>();
        for (Fatura f : faturaRepository.findAll()) {
            if ("CANCELADO".equals(f.getStatus())) continue;
            cobrados.computeIfAbsent(f.getIdAluno() + ":" + f.getIdTurma(), k -> new ArrayList<>()).add(f.getMesReferencia());
        }
        return ctx.usuarios().values().stream()
            .filter(u -> "ALUNO".equals(u.getPerfil()) && Boolean.TRUE.equals(u.getAtivo()))
            .sorted(Comparator.comparing(Usuario::getNome, String.CASE_INSENSITIVE_ORDER))
            .map(u -> new AlunoCobranca(u.getId(), u.getNome(), u.getEmail(), u.getAvatarUrl(),
                porAluno.getOrDefault(u.getId(), List.of()).stream()
                    .filter(m -> ctx.turmas().containsKey(m.getIdTurma()))
                    .map(m -> new TurmaCobranca(m.getIdTurma(), ctx.nomeTurma(m.getIdTurma()),
                        m.getDataMatricula() == null ? null : m.getDataMatricula().toLocalDate(),
                        cobrados.getOrDefault(u.getId() + ":" + m.getIdTurma(), List.of()).stream().sorted().toList()))
                    .toList()))
            .toList();
    }

    @Transactional
    public FaturaItem criarIndividual(NovaFaturaRequest req, Usuario operador) {
        if (req == null || req.alunoId() == null) throw new RegraNegocioException("Escolha o aluno.");
        CatalogoService.Contexto ctx = catalogo.contexto();
        Usuario aluno = ctx.usuarios().get(req.alunoId());
        if (aluno == null || !"ALUNO".equals(aluno.getPerfil())) throw new RegraNegocioException("Aluno não encontrado.");
        if (!Boolean.TRUE.equals(aluno.getAtivo())) throw new RegraNegocioException("A conta deste aluno está inativa.");
        YearMonth mes;
        try {
            mes = YearMonth.parse(req.mesReferencia());
        } catch (DateTimeParseException | NullPointerException e) {
            throw new RegraNegocioException("Mês de referência inválido (use AAAA-MM).");
        }
        if (req.dataVencimento() == null) throw new RegraNegocioException("Informe a data de vencimento.");
        BigDecimal original = dinheiro(req.valorOriginal());
        if (original == null || original.signum() <= 0) throw new RegraNegocioException("Informe o valor cheio da cobrança.");

        Turma turma = null;
        if (req.turmaId() != null) {
            turma = ctx.turmas().get(req.turmaId());
            if (turma == null) throw new RegraNegocioException("Turma não encontrada.");
            boolean matriculado = matriculaRepository.findByIdAlunoAndStatus(aluno.getId(), "ATIVA").stream()
                .anyMatch(m -> m.getIdTurma().equals(req.turmaId()));
            if (!matriculado) throw new RegraNegocioException("O aluno não tem matrícula ativa nesta turma.");
            if (faturaRepository.existsByIdAlunoAndIdTurmaAndMesReferenciaAndStatusNot(aluno.getId(), turma.getId(), mes.toString(), "CANCELADO")) {
                throw new ConflitoException("FATURA_DUPLICADA", "Este aluno já tem cobrança desta turma em " + mesExtenso(mes)
                    + ". Para mudar o valor, aplique um desconto na cobrança existente.");
            }
        }
        String titulo = req.titulo() == null || req.titulo().isBlank()
            ? (turma == null ? null : tituloMensalidade(mes, turma.getNomeTurma()))
            : req.titulo().trim();
        if (titulo == null) throw new RegraNegocioException("Dê um título para a cobrança avulsa (ex.: Taxa de matrícula).");
        if (titulo.length() > 150) titulo = titulo.substring(0, 150);

        BigDecimal desconto = calcularDesconto(original, req.tipoDesconto(), req.desconto());
        String motivo = validarMotivo(desconto, req.motivoDesconto());

        Fatura f = new Fatura();
        f.setIdAluno(aluno.getId());
        f.setIdTurma(turma == null ? null : turma.getId());
        f.setTitulo(titulo);
        f.setMesReferencia(mes.toString());
        f.setValorOriginal(original);
        f.setDesconto(desconto);
        f.setValor(original.subtract(desconto));
        f.setMotivoDesconto(motivo);
        f.setObservacao(limpar(req.observacao()));
        f.setOrigem("INDIVIDUAL");
        f.setDataVencimento(req.dataVencimento());
        f.setStatus(req.dataVencimento().isBefore(AgendaUtil.hoje()) ? "VENCIDO" : "PENDENTE");
        f.setPixCopiaCola(gerarPixCopiaCola(aluno.getId(), turma == null ? 0 : turma.getId(), mes, f.getValor()));
        Fatura salva = faturaRepository.save(f);

        String data = req.dataVencimento().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM"));
        notificacoes.notificar(aluno.getId(), "Nova cobrança disponível",
            "\"" + titulo + "\" · R$ " + f.getValor().toPlainString().replace('.', ',') + " com vencimento em " + data
                + (desconto.signum() > 0 ? " (já com " + MOTIVOS_DESCONTO.get(motivo).toLowerCase() + ")." : "."),
            "FINANCEIRO", "#/financeiro");
        auditoria.registrar(operador, "CRIAR", "FATURA", salva.getId(), "Cobrança individual \"" + titulo + "\" para "
            + aluno.getNome() + " · R$ " + original + (desconto.signum() > 0 ? " − R$ " + desconto + " (" + motivo + ")" : ""));
        return catalogo.fatura(salva, ctx);
    }

    @Transactional
    public FaturaItem ajustar(Integer faturaId, AjusteFaturaRequest req, Usuario operador) {
        if (req == null) throw new RegraNegocioException("Informe o ajuste.");
        Fatura f = faturaRepository.buscarComBloqueio(faturaId).orElseThrow(() -> new RecursoNaoEncontradoException("Fatura"));
        switch (f.getStatus()) {
            case "CONFIRMADO" -> throw new RegraNegocioException("Esta cobrança já foi paga. Para devolver valor, faça um estorno.");
            case "CANCELADO" -> throw new RegraNegocioException("Cobrança cancelada não pode ser ajustada.");
            case "EM_ANALISE" -> throw new RegraNegocioException("Há um comprovante em análise. Aprove ou recuse antes de ajustar o valor.");
            default -> { }
        }
        BigDecimal original = f.getValorOriginal() == null ? f.getValor() : f.getValorOriginal();
        BigDecimal desconto = calcularDesconto(original, req.tipoDesconto(), req.desconto());
        String motivo = validarMotivo(desconto, req.motivoDesconto());
        BigDecimal antes = f.getValor();
        LocalDate vencAntes = f.getDataVencimento();

        f.setDesconto(desconto);
        f.setValor(original.subtract(desconto));
        f.setMotivoDesconto(motivo);
        if (req.observacao() != null) f.setObservacao(limpar(req.observacao()));
        if (req.dataVencimento() != null) f.setDataVencimento(req.dataVencimento());
        f.setStatus(f.getDataVencimento().isBefore(AgendaUtil.hoje()) ? "VENCIDO" : "PENDENTE");
        f.setAjustadoEm(LocalDateTime.now(AgendaUtil.FUSO));
        YearMonth mes = YearMonth.parse(f.getMesReferencia());
        f.setPixCopiaCola(gerarPixCopiaCola(f.getIdAluno(), f.getIdTurma() == null ? 0 : f.getIdTurma(), mes, f.getValor()));
        faturaRepository.save(f);

        boolean mudouValor = antes.compareTo(f.getValor()) != 0;
        boolean mudouData = !vencAntes.equals(f.getDataVencimento());
        if (mudouValor || mudouData) {
            String texto = "\"" + f.getTitulo() + "\" agora é de R$ " + f.getValor().toPlainString().replace('.', ',')
                + (desconto.signum() > 0 ? " (" + MOTIVOS_DESCONTO.get(motivo).toLowerCase() + ")" : "")
                + (mudouData ? ", vencendo em " + f.getDataVencimento().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM")) : "") + ".";
            notificacoes.notificar(f.getIdAluno(), "Cobrança atualizada", texto, "FINANCEIRO", "#/financeiro");
        }
        auditoria.registrar(operador, "AJUSTAR", "FATURA", f.getId(), "\"" + f.getTitulo() + "\" R$ " + antes + " → R$ " + f.getValor()
            + (desconto.signum() > 0 ? " · desconto R$ " + desconto + " (" + motivo + ")" : " · sem desconto")
            + (mudouData ? " · vencimento " + vencAntes + " → " + f.getDataVencimento() : ""));
        return catalogo.fatura(f, catalogo.contexto());
    }

    private static BigDecimal dinheiro(BigDecimal v) {
        return v == null ? null : v.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /** Converte o desconto informado (percentual ou em reais) em valor, sem zerar a cobrança. */
    static BigDecimal calcularDesconto(BigDecimal original, String tipo, BigDecimal informado) {
        if (informado == null || informado.signum() == 0) return BigDecimal.ZERO.setScale(2);
        if (informado.signum() < 0) throw new RegraNegocioException("O desconto não pode ser negativo.");
        BigDecimal desconto;
        if ("PERCENTUAL".equalsIgnoreCase(tipo)) {
            if (informado.compareTo(BigDecimal.valueOf(100)) >= 0) {
                throw new RegraNegocioException("Desconto de 100% não gera cobrança: use cancelar ou não lance a mensalidade.");
            }
            desconto = original.multiply(informado).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        } else {
            desconto = dinheiro(informado);
        }
        if (desconto.compareTo(original) >= 0) throw new RegraNegocioException("O desconto precisa ser menor que o valor cheio.");
        return desconto;
    }

    private static String validarMotivo(BigDecimal desconto, String motivo) {
        if (desconto.signum() == 0) return null;
        String m = motivo == null ? "" : motivo.trim().toUpperCase();
        if (!MOTIVOS_DESCONTO.containsKey(m)) throw new RegraNegocioException("Escolha o motivo do desconto.");
        return m;
    }

    private static String limpar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    @Transactional
    public FaturaItem baixaRapida(Integer faturaId, BaixaRequest req, Usuario operador) {
        Fatura f = buscar(faturaId);
        if ("CONFIRMADO".equals(f.getStatus())) throw new RegraNegocioException("Esta fatura já está quitada.");
        if ("CANCELADO".equals(f.getStatus())) throw new RegraNegocioException("Fatura cancelada não pode receber baixa.");
        String forma = req == null || req.forma() == null ? "PIX" : req.forma().toUpperCase();
        if (!FORMAS.contains(forma)) throw new RegraNegocioException("Forma de pagamento inválida.");
        BigDecimal valor = req == null || req.valor() == null ? f.getValor() : req.valor();

        String statusAnterior = f.getStatus();
        LocalDateTime agora = LocalDateTime.now(AgendaUtil.FUSO);

        // Reaproveita um pagamento em análise (comprovante) ou registra um novo
        Pagamento p = pagamentoRepository.findByIdFaturaOrderByCriadoEmDesc(faturaId).stream()
            .filter(x -> "EM_ANALISE".equals(x.getStatus()) || "PENDENTE".equals(x.getStatus()))
            .findFirst().orElseGet(Pagamento::new);
        String statusPagAnterior = p.getId() == null ? null : p.getStatus();
        p.setIdFatura(f.getId());
        p.setIdAluno(f.getIdAluno());
        if (p.getFormaPagamento() == null) p.setFormaPagamento(forma);
        p.setValorPago(valor);
        if (p.getValorBase() == null) p.setValorBase(f.getValorOriginal() == null ? f.getValor() : f.getValorOriginal());
        p.setStatus("CONFIRMADO");
        p.setDataConfirmacao(agora);
        p.setValidadoPor(operador.getId());
        p.setObservacao(req == null || req.observacao() == null ? "Baixa manual pelo ADM" : req.observacao());
        Pagamento salvo = pagamentoRepository.save(p);

        f.setStatus("CONFIRMADO");
        faturaRepository.save(f);

        auditoriaPagamento.registrar(salvo.getId(), operador.getId(), "APROVACAO_MANUAL", statusPagAnterior,
            "CONFIRMADO", "Baixa rápida (" + forma + ") · fatura " + statusAnterior + " → CONFIRMADO", RequestUtil.ipAtual());
        auditoria.registrar(operador, "BAIXA", "FATURA", f.getId(), "Baixa de R$ " + valor + " em \"" + f.getTitulo() + "\"");
        notificacoes.notificar(f.getIdAluno(), "Pagamento confirmado ✓",
            "\"" + f.getTitulo() + "\" foi quitada. Obrigado!", "SUCESSO", "#/financeiro");
        return catalogo.fatura(f, catalogo.contexto());
    }

    @Transactional
    public FaturaItem cancelar(Integer faturaId, DecisaoRequest req, Usuario operador) {
        Fatura f = buscar(faturaId);
        if ("CONFIRMADO".equals(f.getStatus())) throw new RegraNegocioException("Faturas pagas não podem ser canceladas.");
        String anterior = f.getStatus();
        f.setStatus("CANCELADO");
        faturaRepository.save(f);
        String motivo = req == null || req.resposta() == null ? "sem motivo informado" : req.resposta();
        auditoria.registrar(operador, "CANCELAR", "FATURA", f.getId(), "\"" + f.getTitulo() + "\" " + anterior
            + " → CANCELADO · " + motivo);
        notificacoes.notificar(f.getIdAluno(), "Cobrança cancelada", "\"" + f.getTitulo() + "\" foi cancelada.",
            "FINANCEIRO", "#/financeiro");
        return catalogo.fatura(f, catalogo.contexto());
    }

    @Transactional
    public PagamentoItem decidirComprovante(Integer pagamentoId, boolean aprovar, DecisaoRequest req, Usuario operador) {
        Pagamento p = pagamentoRepository.findById(pagamentoId)
            .orElseThrow(() -> new RecursoNaoEncontradoException("Pagamento"));
        if (!"EM_ANALISE".equals(p.getStatus()) && !"PENDENTE".equals(p.getStatus())) {
            throw new RegraNegocioException("Este pagamento já foi processado (" + p.getStatus() + ").");
        }
        Fatura f = buscar(p.getIdFatura());
        String anterior = p.getStatus();
        String motivo = req == null ? null : req.resposta();
        if (aprovar) {
            p.setStatus("CONFIRMADO");
            p.setDataConfirmacao(LocalDateTime.now(AgendaUtil.FUSO));
            f.setStatus("CONFIRMADO");
        } else {
            if (motivo == null || motivo.isBlank()) throw new RegraNegocioException("Informe o motivo da recusa.");
            p.setStatus("RECUSADO");
            f.setStatus(f.getDataVencimento().isBefore(AgendaUtil.hoje()) ? "VENCIDO" : "PENDENTE");
        }
        p.setValidadoPor(operador.getId());
        if (motivo != null && !motivo.isBlank()) p.setObservacao(motivo);
        pagamentoRepository.save(p);
        faturaRepository.save(f);

        auditoriaPagamento.registrar(p.getId(), operador.getId(), aprovar ? "APROVACAO_MANUAL" : "REJEICAO_MANUAL",
            anterior, p.getStatus(), motivo, RequestUtil.ipAtual());
        auditoria.registrar(operador, aprovar ? "APROVAR" : "RECUSAR", "PAGAMENTO", p.getId(),
            (aprovar ? "Comprovante aprovado: " : "Comprovante recusado: ") + f.getTitulo());
        notificacoes.notificar(p.getIdAluno(), aprovar ? "Comprovante aprovado ✓" : "Comprovante recusado",
            aprovar ? "\"" + f.getTitulo() + "\" foi confirmada." : "Motivo: " + motivo + ". Envie um novo comprovante.",
            aprovar ? "SUCESSO" : "ALERTA", "#/financeiro");
        Map<Integer, Fatura> mapa = Map.of(f.getId(), f);
        return catalogo.pagamento(p, mapa, catalogo.contexto());
    }

    /** Marca como VENCIDO toda cobrança pendente cujo vencimento passou (diariamente e sob demanda). */
    @Scheduled(cron = "0 5 0 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public int atualizarVencidas() {
        List<Fatura> atrasadas = faturaRepository.findByStatusAndDataVencimentoBefore("PENDENTE", AgendaUtil.hoje());
        for (Fatura f : atrasadas) {
            f.setStatus("VENCIDO");
            faturaRepository.save(f);
            notificacoes.notificar(f.getIdAluno(), "Mensalidade em atraso",
                "\"" + f.getTitulo() + "\" venceu. Regularize para manter sua matrícula ativa.", "ALERTA", "#/financeiro");
        }
        if (!atrasadas.isEmpty()) {
            log.info("{} fatura(s) marcadas como VENCIDO.", atrasadas.size());
        }
        return atrasadas.size();
    }

    // ================================================================ helpers

    private Fatura buscar(Integer id) {
        return faturaRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Fatura"));
    }

    static String mesExtenso(YearMonth mes) {
        return MESES[mes.getMonthValue() - 1] + "/" + mes.getYear();
    }

    private static String tituloMensalidade(YearMonth mes, String turma) {
        String t = "Mensalidade " + mesExtenso(mes) + " - " + turma;
        return t.length() > 150 ? t.substring(0, 150) : t;
    }

    /** Payload PIX estático (BR Code) com txid determinístico por aluno/turma/mês. */
    private static String gerarPixCopiaCola(Integer aluno, Integer turma, YearMonth mes, BigDecimal valor) {
        String valorTxt = valor.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        String txid = ("VD" + aluno + "T" + turma + "M" + mes.toString().replace("-", "")).toUpperCase();
        String chavePix = "financeiro@vibedance.com";
        String chave = "0014br.gov.bcb.pix" + "01" + String.format("%02d", chavePix.length()) + chavePix;
        String semCrc = "000201" + "26" + String.format("%02d", chave.length()) + chave
            + "52040000" + "5303986" + "54" + String.format("%02d", valorTxt.length()) + valorTxt
            + "5802BR" + "5915VibeDance Studio" + "6008Brasilia"
            + "62" + String.format("%02d", txid.length() + 4) + "05" + String.format("%02d", txid.length()) + txid
            + "6304";
        return semCrc + crc16(semCrc);
    }

    private static String crc16(String payload) {
        int crc = 0xFFFF;
        for (byte b : payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return String.format("%04X", crc);
    }

    public static LocalDate vencimentoPadrao(YearMonth mes, int dia) {
        return mes.atDay(Math.min(dia, mes.lengthOfMonth()));
    }
}
