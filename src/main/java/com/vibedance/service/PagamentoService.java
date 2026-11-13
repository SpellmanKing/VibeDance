package com.vibedance.service;

import com.vibedance.dto.PagamentoMercadoPagoRequest;
import com.vibedance.model.Pagamento;
import com.vibedance.model.Fatura;
import com.vibedance.model.Usuario;
import com.vibedance.repository.PagamentoRepository;
import com.vibedance.repository.FaturaRepository;
import com.vibedance.repository.UsuarioRepository;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import java.util.NoSuchElementException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

@Service
@Transactional(readOnly = true)
public class PagamentoService {

    private final PagamentoRepository pagamentoRepository;
    private final FaturaRepository faturaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ComprovanteService comprovanteService;
    private final AuditoriaPagamentoService auditoriaService;
    private final MercadoPagoService mercadoPagoService;
    private final PagamentoGatewayService pagamentoGatewayService;

    public PagamentoService(
            PagamentoRepository pagamentoRepository,
            FaturaRepository faturaRepository,
            UsuarioRepository usuarioRepository,
            ComprovanteService comprovanteService,
            AuditoriaPagamentoService auditoriaService,
            MercadoPagoService mercadoPagoService,
            PagamentoGatewayService pagamentoGatewayService) {

        this.pagamentoRepository = pagamentoRepository;
        this.faturaRepository = faturaRepository;
        this.usuarioRepository = usuarioRepository;
        this.comprovanteService = comprovanteService;
        this.auditoriaService = auditoriaService;
        this.mercadoPagoService = mercadoPagoService;
        this.pagamentoGatewayService = pagamentoGatewayService;
    }

    public List<Pagamento> listarPorAluno(Integer idAluno) {

        if (idAluno == null) {
            throw new IllegalArgumentException("Aluno não identificado.");
        }

        return pagamentoRepository.findByIdAlunoOrderByCriadoEmDesc(idAluno);
    }

    public Pagamento buscarPorAluno(Integer idPagamento, Integer idAluno) {

        if (idPagamento == null || idAluno == null) {
            throw new IllegalArgumentException("Dados do pagamento inválidos.");
        }

        return pagamentoRepository.findByIdAndIdAluno(idPagamento, idAluno)
                .orElseThrow(() -> new NoSuchElementException(
                    "Pagamento não encontrado.")
                );
    }

    public Path localizarComprovante(Integer idPagamento, Integer idAluno) {

        Pagamento pagamento = buscarPorAluno(idPagamento, idAluno);

        if (pagamento.getComprovanteUrl() == null
                || pagamento.getComprovanteUrl().isBlank()) {

            throw new NoSuchElementException(
                "Este pagamento não possui comprovante."
            );
        }

        return comprovanteService.localizar(
            pagamento.getComprovanteUrl()
        );
    }

    public List<Pagamento> listarPorFatura(Integer idFatura, Integer idAluno) {

        if (idFatura == null || idAluno == null) {
            throw new IllegalArgumentException("Dados da fatura inválidos.");
        }

        return pagamentoRepository
                .findByIdFaturaAndIdAlunoOrderByCriadoEmDesc(idFatura, idAluno);
    }

    @Transactional
    public Map<String, Object> criarPagamentoOnline(
            PagamentoMercadoPagoRequest requisicao,
            Integer idAluno,
            String ipOrigem) {

        if (requisicao == null || requisicao.getIdFatura() == null) {
            throw new IllegalArgumentException("Fatura não informada.");
        }

        if (idAluno == null) {
            throw new IllegalArgumentException("Aluno não identificado.");
        }

        String metodo = requisicao.getPaymentMethodId();

        if (metodo == null || metodo.isBlank()) {
            throw new IllegalArgumentException("Meio de pagamento não informado.");
        }

        boolean pix = "pix".equalsIgnoreCase(metodo);

        if (!pix) {
            Map<String, Object> dadosMetodo =
                    mercadoPagoService.buscarMeioPagamento(metodo);

            Object tipo = dadosMetodo.get("payment_type_id");

            if (!"credit_card".equals(tipo)) {
                throw new IllegalArgumentException(
                        "Por enquanto, somente cartão de crédito é aceito."
                );
            }

            if (requisicao.getToken() == null
                    || requisicao.getToken().isBlank()) {
                throw new IllegalArgumentException(
                        "Token do cartão não informado."
                );
            }

            if (requisicao.getInstallments() == null
                    || requisicao.getInstallments() < 1) {
                throw new IllegalArgumentException(
                        "Quantidade de parcelas inválida."
                );
            }
        }

        Fatura fatura = faturaRepository
                .findByIdAndIdAluno(requisicao.getIdFatura(), idAluno)
                .orElseThrow(() -> new NoSuchElementException(
                        "Fatura não encontrada."
                ));

        if ("CONFIRMADO".equalsIgnoreCase(fatura.getStatus())) {
            throw new IllegalArgumentException("Esta fatura já está paga.");
        }

        if ("CANCELADO".equalsIgnoreCase(fatura.getStatus())) {
            throw new IllegalArgumentException("Esta fatura está cancelada.");
        }

        List<Pagamento> anteriores =
            pagamentoRepository
                    .findByIdFaturaAndIdAlunoOrderByCriadoEmDesc(
                            fatura.getId(), idAluno
                    );

        Pagamento tentativaPendente = anteriores.stream()
                .filter(p ->
                        "PENDENTE".equalsIgnoreCase(p.getStatus())
                        && (p.getGatewayTransacaoId() == null
                            || p.getGatewayTransacaoId().isBlank())
                        && (pix
                            ? "PIX".equalsIgnoreCase(p.getFormaPagamento())
                            : "CARTAO_CREDITO".equalsIgnoreCase(p.getFormaPagamento()))
                )
                .findFirst()
                .orElse(null);

        boolean existeOutroPagamentoAberto = anteriores.stream().anyMatch(p ->
                p != tentativaPendente
                && ("PENDENTE".equalsIgnoreCase(p.getStatus())
                    || "EM_ANALISE".equalsIgnoreCase(p.getStatus())
                    || "CONFIRMADO".equalsIgnoreCase(p.getStatus()))
        );

        if (existeOutroPagamentoAberto) {
            throw new IllegalArgumentException(
                    "Já existe um pagamento aguardando confirmação ou análise."
            );
        }

        Usuario aluno = usuarioRepository.findById(idAluno)
                .orElseThrow(() -> new NoSuchElementException(
                        "Cadastro do aluno não encontrado."
                ));

        if (aluno.getEmail() == null || aluno.getEmail().isBlank()
                || aluno.getCpf() == null || aluno.getCpf().isBlank()
                || aluno.getNome() == null || aluno.getNome().isBlank()) {
            throw new IllegalArgumentException(
                    "Complete nome, CPF e e-mail no cadastro antes de pagar."
            );
        }

        String cpf = aluno.getCpf().replaceAll("[^0-9]", "");

        if (cpf.length() != 11) {
            throw new IllegalArgumentException(
                    "O CPF cadastrado precisa ter 11 números."
            );
        }

        Pagamento salvo = tentativaPendente;

        if (salvo == null) {
            salvo = pagamentoGatewayService.registrarTentativa(
                    fatura,
                    idAluno,
                    pix ? "PIX" : "CARTAO_CREDITO"
            );
        }

        String[] partesNome = aluno.getNome().trim().split("\\s+", 2);

        Map<String, Object> identificacao = new HashMap<>();
        identificacao.put("type", "CPF");
        identificacao.put("number", cpf);

        Map<String, Object> pagador = new HashMap<>();
        pagador.put("email", aluno.getEmail());
        pagador.put("first_name", partesNome[0]);
        pagador.put("last_name", partesNome.length > 1 ? partesNome[1] : partesNome[0]);
        pagador.put("identification", identificacao);

        Map<String, Object> dados = new HashMap<>();
        dados.put("transaction_amount", fatura.getValor());
        dados.put("description", fatura.getTitulo());
        dados.put("payment_method_id", metodo);
        dados.put("payer", pagador);
        dados.put("external_reference", salvo.getId().toString());

        if (pix) {
            dados.put("installments", 1);
        } else {
            dados.put("token", requisicao.getToken());
            dados.put("installments", requisicao.getInstallments());

            if (requisicao.getIssuerId() != null) {
                dados.put("issuer_id", requisicao.getIssuerId());
            }
        }

        String chaveIdempotencia = UUID.nameUUIDFromBytes(
                ("VibeDance-Pagamento-" + salvo.getId())
                        .getBytes(StandardCharsets.UTF_8)
        ).toString();

        Map<String, Object> resposta = mercadoPagoService.criarPagamento(
                dados,
                chaveIdempotencia
        );

        if (resposta == null || resposta.get("id") == null) {
            throw new IllegalStateException(
                    "O Mercado Pago não retornou o identificador do pagamento."
            );
        }

        String idTransacao = String.valueOf(resposta.get("id"));
        String statusGateway = String.valueOf(resposta.get("status"));
        String detalhe = String.valueOf(resposta.get("status_detail"));

        salvo.setGatewayTransacaoId(idTransacao);

        String statusAnteriorFatura = fatura.getStatus();

        if ("approved".equalsIgnoreCase(statusGateway)) {
            salvo.setStatus("CONFIRMADO");
            salvo.setDataConfirmacao(
                    LocalDateTime.now(ZoneId.of("America/Sao_Paulo"))
            );
            fatura.setStatus("CONFIRMADO");
            faturaRepository.save(fatura);

        } else if ("rejected".equalsIgnoreCase(statusGateway)
                || "cancelled".equalsIgnoreCase(statusGateway)) {
            salvo.setStatus("RECUSADO");

        } else if ("refunded".equalsIgnoreCase(statusGateway)
                || "charged_back".equalsIgnoreCase(statusGateway)) {
            salvo.setStatus("ESTORNADO");
        }

        salvo.setObservacao("Mercado Pago: " + detalhe);
        pagamentoRepository.save(salvo);

        auditoriaService.registrar(
                salvo.getId(),
                idAluno,
                "PAGAMENTO_ONLINE_INICIADO",
                statusAnteriorFatura,
                fatura.getStatus(),
                "Transação Mercado Pago: " + idTransacao,
                ipOrigem
        );

        Map<String, Object> resultado = new HashMap<>();
        resultado.put("id", idTransacao);
        resultado.put("status", salvo.getStatus());
        resultado.put("statusDetail", detalhe);
        resultado.put("paymentMethodId", metodo);

        Object interacao = resposta.get("point_of_interaction");

        if (interacao instanceof Map<?, ?> ponto) {
            Object transacao = ponto.get("transaction_data");

            if (transacao instanceof Map<?, ?> dadosTransacao) {
                resultado.put("qrCode", dadosTransacao.get("qr_code"));
                resultado.put("qrCodeBase64", dadosTransacao.get("qr_code_base64"));
                resultado.put("ticketUrl", dadosTransacao.get("ticket_url"));
            }
        }

        return resultado;
    }

    @Transactional
    public Pagamento enviarComprovante(
            Integer idFatura,
            Integer idAluno,
            String observacao,
            String ipOrigem,
            MultipartFile arquivo) {

        Fatura fatura = faturaRepository
                .findByIdAndIdAluno(idFatura, idAluno)
                .orElseThrow(() -> new NoSuchElementException(
                    "Fatura não encontrada."
                ));

        if ("CONFIRMADO".equalsIgnoreCase(fatura.getStatus())) {
            throw new IllegalArgumentException("Esta fatura já está paga.");
        }

        if ("CANCELADO".equalsIgnoreCase(fatura.getStatus())) {
            throw new IllegalArgumentException("Esta fatura está cancelada.");
        }

        List<Pagamento> anteriores =
                pagamentoRepository.findByIdFaturaAndIdAlunoOrderByCriadoEmDesc(
                        idFatura, idAluno
                );

        boolean pagamentoEmAberto = anteriores.stream().anyMatch(pagamento ->
            "PENDENTE".equalsIgnoreCase(pagamento.getStatus())
            || "EM_ANALISE".equalsIgnoreCase(pagamento.getStatus())
            || "CONFIRMADO".equalsIgnoreCase(pagamento.getStatus())
        );

        if (pagamentoEmAberto) {
            throw new IllegalArgumentException(
                "Já existe um pagamento aguardando análise ou confirmação."
            );
        }

        String caminhoArquivo = comprovanteService.salvar(arquivo);

        Pagamento pagamento = new Pagamento();
        pagamento.setIdFatura(fatura.getId());
        pagamento.setIdAluno(idAluno);
        pagamento.setFormaPagamento("COMPROVANTE_MANUAL");
        pagamento.setValorPago(fatura.getValor());
        pagamento.setStatus("EM_ANALISE");
        pagamento.setComprovanteUrl(caminhoArquivo);

        String nomeOriginal = arquivo.getOriginalFilename();

        if (nomeOriginal != null) {
            nomeOriginal = nomeOriginal.replace("\\", "/");
            nomeOriginal = nomeOriginal.substring(
                    nomeOriginal.lastIndexOf("/") + 1
            );

            if (nomeOriginal.length() > 255) {
                nomeOriginal = nomeOriginal.substring(0, 255);
            }
        }

        pagamento.setComprovanteNome(nomeOriginal);

        pagamento.setComprovanteEnviadoEm(
                LocalDateTime.now(ZoneId.of("America/Sao_Paulo"))
        );

        pagamento.setObservacao(observacao);

        Pagamento salvo = pagamentoRepository.save(pagamento);

        String statusAnterior = fatura.getStatus();

        fatura.setStatus("EM_ANALISE");
        faturaRepository.save(fatura);

        auditoriaService.registrar(
                salvo.getId(),
                idAluno,
                "COMPROVANTE_ENVIADO",
                statusAnterior,
                "EM_ANALISE",
                observacao,
                ipOrigem
        );

        return salvo;
    }
}