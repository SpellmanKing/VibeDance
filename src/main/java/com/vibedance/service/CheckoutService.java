package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Fatura;
import com.vibedance.model.Pagamento;
import com.vibedance.model.Usuario;
import com.vibedance.repository.FaturaRepository;
import com.vibedance.repository.PagamentoRepository;
import com.vibedance.util.AgendaUtil;
import com.vibedance.util.RequestUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Checkout simulado (PIX, cartão e boleto) com cálculo de encargos, comprovante e a
 * planilha financeira consolidada usada pelo aluno e pelo ADM. Nenhum dado completo de
 * cartão é recebido ou guardado — apenas bandeira e últimos 4 dígitos.
 */
@Service
public class CheckoutService {

    /** Multa de 2% e juros de 1% ao mês (pró-rata dia) após o vencimento. */
    private static final BigDecimal MULTA = new BigDecimal("0.02");
    private static final BigDecimal JUROS_DIA = new BigDecimal("0.01").divide(BigDecimal.valueOf(30), 8, RoundingMode.HALF_UP);
    private static final int PARCELAS_MAX = 3;
    private static final Set<String> FORMAS = Set.of("PIX", "CARTAO_CREDITO", "BOLETO");
    private static final Set<String> BANDEIRAS = Set.of("Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Cartão");

    private final FaturaRepository faturaRepository;
    private final PagamentoRepository pagamentoRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final AuditoriaPagamentoService auditoriaPagamento;
    private final NotificacaoService notificacoes;
    private final ReciboPagamentoService recibo;

    public CheckoutService(FaturaRepository faturaRepository, PagamentoRepository pagamentoRepository,
                           CatalogoService catalogo, AuditoriaService auditoria,
                           AuditoriaPagamentoService auditoriaPagamento, NotificacaoService notificacoes,
                           ReciboPagamentoService recibo) {
        this.faturaRepository = faturaRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.auditoriaPagamento = auditoriaPagamento;
        this.notificacoes = notificacoes;
        this.recibo = recibo;
    }

    /** PDF do comprovante para o ADM (qualquer aluno). */
    @Transactional(readOnly = true)
    public byte[] reciboAdmin(Integer pagamentoId) {
        Pagamento p = pagamentoRepository.findById(pagamentoId).orElseThrow(() -> new RecursoNaoEncontradoException("Pagamento"));
        if (!"CONFIRMADO".equals(p.getStatus())) throw new RegraNegocioException("O comprovante só existe para pagamentos confirmados.");
        return recibo.gerar(p, catalogo.contexto().nomeUsuario(p.getIdAluno()));
    }

    // ================================================================ checkout

    private record Encargos(long dias, BigDecimal multa, BigDecimal juros, BigDecimal desconto, BigDecimal total) {
    }

    static Encargos encargos(Fatura f, LocalDate hoje) {
        BigDecimal base = f.getValor();
        long dias = f.getDataVencimento() == null ? 0 : Math.max(0, ChronoUnit.DAYS.between(f.getDataVencimento(), hoje));
        BigDecimal multa = dias > 0 ? base.multiply(MULTA).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2);
        BigDecimal juros = dias > 0
            ? base.multiply(JUROS_DIA).multiply(BigDecimal.valueOf(dias)).setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO.setScale(2);
        // o desconto já está embutido em f.valor (líquido); aqui só é informado para exibição
        BigDecimal desconto = f.getDesconto().setScale(2, RoundingMode.HALF_UP);
        return new Encargos(dias, multa, juros, desconto, base.add(multa).add(juros).setScale(2, RoundingMode.HALF_UP));
    }

    @Transactional(readOnly = true)
    public CheckoutFatura checkout(Usuario u, Integer faturaId) {
        Fatura f = daAluno(u, faturaId);
        Encargos e = encargos(f, AgendaUtil.hoje());
        String bloqueio = switch (f.getStatus()) {
            case "CONFIRMADO" -> "Esta mensalidade já está paga.";
            case "CANCELADO" -> "Esta cobrança foi cancelada pela administração.";
            case "EM_ANALISE" -> "Seu comprovante desta mensalidade está em análise. Aguarde a conferência.";
            default -> null;
        };
        return new CheckoutFatura(catalogo.fatura(f, catalogo.contexto()), valorCheio(f), e.multa(), e.juros(),
            e.desconto(), e.total(), e.dias(), f.getPixCopiaCola(), linhaDigitavel(f, e.total()), PARCELAS_MAX,
            bloqueio == null, bloqueio);
    }

    @Transactional
    public ComprovantePagamento pagar(Usuario u, Integer faturaId, PagamentoSimuladoRequest req) {
        Fatura f = faturaRepository.buscarComBloqueio(faturaId)
            .filter(x -> x.getIdAluno().equals(u.getId()))
            .orElseThrow(() -> new RecursoNaoEncontradoException("Fatura"));
        switch (f.getStatus()) {
            case "CONFIRMADO" -> throw new ConflitoException("FATURA_JA_PAGA", "Esta mensalidade já está paga.");
            case "CANCELADO" -> throw new RegraNegocioException("Esta cobrança foi cancelada e não pode ser paga.");
            case "EM_ANALISE" -> throw new ConflitoException("COMPROVANTE_EM_ANALISE",
                "Seu comprovante desta mensalidade está em análise. Aguarde a conferência.");
            default -> { }
        }

        String forma = req == null || req.forma() == null ? "" : req.forma().trim().toUpperCase();
        if (!FORMAS.contains(forma)) throw new RegraNegocioException("Escolha PIX, cartão de crédito ou boleto.");
        Encargos e = encargos(f, AgendaUtil.hoje());

        int parcelas = 1;
        String detalhe;
        switch (forma) {
            case "CARTAO_CREDITO" -> {
                String fim = req.cartaoFinal() == null ? "" : req.cartaoFinal().replaceAll("\\D", "");
                if (fim.length() != 4) throw new RegraNegocioException("Cartão inválido.");
                parcelas = req.parcelas() == null ? 1 : req.parcelas();
                if (parcelas < 1 || parcelas > PARCELAS_MAX) {
                    throw new RegraNegocioException("Parcele em até " + PARCELAS_MAX + "x sem juros.");
                }
                String bandeira = req.bandeira() != null && BANDEIRAS.contains(req.bandeira()) ? req.bandeira() : "Cartão";
                detalhe = bandeira + " •••• " + fim + (parcelas > 1 ? " · " + parcelas + "x" : " · à vista");
            }
            case "BOLETO" -> detalhe = "Boleto " + linhaDigitavel(f, e.total()).substring(0, 11) + "…";
            default -> detalhe = "PIX instantâneo";
        }

        LocalDateTime agora = LocalDateTime.now(AgendaUtil.FUSO);
        Pagamento p = new Pagamento();
        p.setIdFatura(f.getId());
        p.setIdAluno(u.getId());
        p.setFormaPagamento(forma);
        p.setValorBase(valorCheio(f));
        p.setValorPago(e.total());
        p.setParcelas(parcelas);
        p.setMetodoDetalhe(detalhe);
        p.setStatus("CONFIRMADO");
        p.setDataConfirmacao(agora);
        p.setGatewayTransacaoId("SIM-" + UUID.randomUUID().toString().substring(0, 13).toUpperCase());
        p.setObservacao("Checkout online (simulado)");
        Pagamento salvo = pagamentoRepository.save(p);

        String anterior = f.getStatus();
        f.setStatus("CONFIRMADO");
        faturaRepository.save(f);

        auditoriaPagamento.registrar(salvo.getId(), u.getId(), "CHECKOUT_ONLINE", null, "CONFIRMADO",
            detalhe + " · fatura " + anterior + " → CONFIRMADO", RequestUtil.ipAtual());
        auditoria.registrar(u, "PAGAR", "FATURA", f.getId(), "Pagamento online de R$ " + e.total() + " (" + detalhe + ") em \""
            + f.getTitulo() + "\"");
        notificacoes.notificar(u.getId(), "Pagamento confirmado ✓", "\"" + f.getTitulo() + "\" foi quitada. Comprovante disponível.",
            "SUCESSO", "#/financeiro");
        notificacoes.notificarAdmins("Pagamento recebido", u.getNome() + " pagou \"" + f.getTitulo() + "\" via "
            + rotuloForma(forma) + ".", "FINANCEIRO", "#/financeiro");
        return comprovante(salvo, f, u.getNome());
    }

    @Transactional(readOnly = true)
    public ComprovantePagamento comprovanteDoAluno(Usuario u, Integer pagamentoId) {
        Pagamento p = pagamentoRepository.findById(pagamentoId)
            .filter(x -> x.getIdAluno().equals(u.getId()))
            .orElseThrow(() -> new RecursoNaoEncontradoException("Pagamento"));
        if (!"CONFIRMADO".equals(p.getStatus())) throw new RegraNegocioException("O comprovante só existe para pagamentos confirmados.");
        Fatura f = faturaRepository.findById(p.getIdFatura()).orElseThrow(() -> new RecursoNaoEncontradoException("Fatura"));
        return comprovante(p, f, u.getNome());
    }

    private ComprovantePagamento comprovante(Pagamento p, Fatura f, String alunoNome) {
        BigDecimal base = p.getValorBase() != null ? p.getValorBase() : f.getValor();
        return new ComprovantePagamento(p.getId(), transacao(p), f.getId(), f.getTitulo(), f.getMesReferencia(),
            f.getIdTurma() == null ? null : catalogo.contexto().nomeTurma(f.getIdTurma()), alunoNome, p.getFormaPagamento(),
            p.getMetodoDetalhe(), p.getParcelas(), base, p.getValorPago().subtract(base), p.getValorPago(),
            p.getDataConfirmacao());
    }

    // ================================================================ planilha

    @Transactional(readOnly = true)
    public List<LinhaPlanilha> planilhaDoAluno(Usuario u) {
        return planilha(faturaRepository.findByIdAlunoOrderByDataVencimentoDesc(u.getId()),
            pagamentoRepository.findByIdAlunoOrderByCriadoEmDesc(u.getId()));
    }

    @Transactional(readOnly = true)
    public List<LinhaPlanilha> planilhaGeral() {
        return planilha(faturaRepository.findAllByOrderByDataVencimentoDesc(), pagamentoRepository.findAllByOrderByCriadoEmDesc());
    }

    private List<LinhaPlanilha> planilha(List<Fatura> faturas, List<Pagamento> pagamentos) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        LocalDate hoje = AgendaUtil.hoje();
        Map<Integer, List<Pagamento>> porFatura = pagamentos.stream().collect(Collectors.groupingBy(Pagamento::getIdFatura));
        Map<Integer, Fatura> mapa = faturas.stream().collect(Collectors.toMap(Fatura::getId, Function.identity()));
        List<LinhaPlanilha> linhas = new ArrayList<>();

        for (Fatura f : faturas) {
            List<Pagamento> ps = porFatura.getOrDefault(f.getId(), List.of());
            Pagamento pago = ps.stream().filter(p -> "CONFIRMADO".equals(p.getStatus())).findFirst().orElse(null);
            String turma = f.getIdTurma() == null ? null : ctx.nomeTurma(f.getIdTurma());
            if (pago != null) {
                BigDecimal base = pago.getValorBase() != null ? pago.getValorBase() : valorCheio(f);
                linhas.add(new LinhaPlanilha(transacao(pago), f.getId(), pago.getId(), f.getIdAluno(), ctx.nomeUsuario(f.getIdAluno()),
                    f.getMesReferencia(), f.getTitulo(), turma, pago.getFormaPagamento(), pago.getMetodoDetalhe(),
                    f.getDataVencimento(), pago.getDataConfirmacao() != null ? pago.getDataConfirmacao() : pago.getCriadoEm(),
                    base, pago.getValorPago().subtract(base), pago.getValorPago(), "PAGO"));
            } else {
                String status = switch (f.getStatus()) {
                    case "VENCIDO" -> "ATRASADO";
                    case "EM_ANALISE" -> "EM_ANALISE";
                    case "CANCELADO" -> "CANCELADO";
                    case "CONFIRMADO" -> "PAGO";
                    default -> "PENDENTE";
                };
                Pagamento emAnalise = ps.stream().filter(p -> "EM_ANALISE".equals(p.getStatus())).findFirst().orElse(null);
                BigDecimal devido = Set.of("PENDENTE", "ATRASADO").contains(status) ? encargos(f, hoje).total() : f.getValor();
                linhas.add(new LinhaPlanilha(String.format("FAT-%06d", f.getId()), f.getId(), emAnalise == null ? null : emAnalise.getId(),
                    f.getIdAluno(), ctx.nomeUsuario(f.getIdAluno()), f.getMesReferencia(), f.getTitulo(), turma,
                    emAnalise == null ? null : emAnalise.getFormaPagamento(), null, f.getDataVencimento(), null,
                    valorCheio(f), devido.subtract(valorCheio(f)), devido, status));
            }
        }
        // Estornos aparecem como lançamentos próprios
        for (Pagamento p : pagamentos) {
            if (!"ESTORNADO".equals(p.getStatus())) continue;
            Fatura f = mapa.get(p.getIdFatura());
            BigDecimal base = p.getValorBase() != null ? p.getValorBase() : (f == null ? p.getValorPago() : f.getValor());
            linhas.add(new LinhaPlanilha(transacao(p), p.getIdFatura(), p.getId(), p.getIdAluno(), ctx.nomeUsuario(p.getIdAluno()),
                f == null ? null : f.getMesReferencia(), f == null ? "Fatura #" + p.getIdFatura() : f.getTitulo(),
                f == null || f.getIdTurma() == null ? null : ctx.nomeTurma(f.getIdTurma()), p.getFormaPagamento(),
                p.getMetodoDetalhe(), f == null ? null : f.getDataVencimento(), p.getDataConfirmacao(), base,
                p.getValorPago().subtract(base), p.getValorPago().negate(), "ESTORNADO"));
        }
        return linhas;
    }

    // ================================================================ helpers

    static BigDecimal valorCheio(Fatura f) {
        return f.getValorOriginal() != null ? f.getValorOriginal() : f.getValor();
    }

    private Fatura daAluno(Usuario u, Integer faturaId) {
        return faturaRepository.findByIdAndIdAluno(faturaId, u.getId())
            .orElseThrow(() -> new RecursoNaoEncontradoException("Fatura"));
    }

    private static String transacao(Pagamento p) {
        return String.format("TX-%06d", p.getId());
    }

    private static String rotuloForma(String forma) {
        return switch (forma) {
            case "CARTAO_CREDITO" -> "cartão de crédito";
            case "BOLETO" -> "boleto";
            default -> "PIX";
        };
    }

    /**
     * Linha digitável fictícia (banco 999, inexistente) com fator de vencimento e valor reais,
     * para a experiência de boleto. Não é um boleto válido.
     */
    static String linhaDigitavel(Fatura f, BigDecimal total) {
        LocalDate venc = f.getDataVencimento() == null ? AgendaUtil.hoje() : f.getDataVencimento();
        long fator = Math.max(1000, ChronoUnit.DAYS.between(LocalDate.of(2022, 5, 29), venc) + 1000) % 10000;
        String valor = String.format("%010d", total.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValue());
        String nosso = String.format("%011d", f.getId() * 7919L % 100000000000L);
        String campo1 = "9999" + "0" + nosso.substring(0, 4);
        String campo2 = nosso.substring(4) + String.format("%03d", f.getIdAluno() % 1000);
        String campo3 = String.format("%010d", (long) f.getId() * 104729L % 10000000000L);
        return campo1.substring(0, 5) + "." + campo1.substring(5) + dv(campo1) + " "
            + campo2.substring(0, 5) + "." + campo2.substring(5) + dv(campo2) + " "
            + campo3.substring(0, 5) + "." + campo3.substring(5) + dv(campo3) + " "
            + dv(campo1 + campo2 + campo3) + " " + String.format("%04d", fator) + valor;
    }

    /** Dígito verificador módulo 10. */
    private static int dv(String numero) {
        int soma = 0;
        boolean dobro = true;
        for (int i = numero.length() - 1; i >= 0; i--) {
            int n = Character.getNumericValue(numero.charAt(i)) * (dobro ? 2 : 1);
            soma += n > 9 ? n - 9 : n;
            dobro = !dobro;
        }
        return (10 - soma % 10) % 10;
    }
}
