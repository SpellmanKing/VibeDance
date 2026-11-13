package com.vibedance.controller;

import com.vibedance.dto.PagamentoAlunoResponse;
import com.vibedance.dto.PagamentoMercadoPagoRequest;
import com.vibedance.model.Pagamento;
import com.vibedance.model.Usuario;
import com.vibedance.service.PagamentoService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/aluno/pagamentos")
public class PagamentoController {

    private final PagamentoService pagamentoService;

    @Value("${mercadopago.public-key:}")
    private String publicKey;

    public PagamentoController(PagamentoService pagamentoService) {
        this.pagamentoService = pagamentoService;
    }

    @GetMapping("/configuracao")
    public ResponseEntity<Map<String, String>> configuracaoMercadoPago() {

        if (publicKey == null || publicKey.isBlank()) {
            return ResponseEntity.status(503).build();
        }

        return ResponseEntity.ok(Map.of("publicKey", publicKey));
    }

    @GetMapping
    public ResponseEntity<List<PagamentoAlunoResponse>> listarMeusPagamentos(
            @AuthenticationPrincipal Usuario usuario) {

        List<PagamentoAlunoResponse> pagamentos =
                pagamentoService.listarPorAluno(usuario.getId())
                        .stream()
                        .map(PagamentoAlunoResponse::new)
                        .toList();

        return ResponseEntity.ok(pagamentos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarMeuPagamento(
            @PathVariable Integer id,
            @AuthenticationPrincipal Usuario usuario) {

        try {
            Pagamento pagamento = pagamentoService.buscarPorAluno(
                    id, usuario.getId()
            );

            return ResponseEntity.ok(
                    new PagamentoAlunoResponse(pagamento)
            );

        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/fatura/{idFatura}")
    public ResponseEntity<List<PagamentoAlunoResponse>> listarPorFatura(
            @PathVariable Integer idFatura,
            @AuthenticationPrincipal Usuario usuario) {

        List<PagamentoAlunoResponse> pagamentos =
                pagamentoService.listarPorFatura(
                        idFatura, usuario.getId()
                )
                .stream()
                .map(PagamentoAlunoResponse::new)
                .toList();

        return ResponseEntity.ok(pagamentos);
    }

    @PostMapping("/online")
    public ResponseEntity<?> criarPagamentoOnline(
            @RequestBody PagamentoMercadoPagoRequest requisicao,
            @AuthenticationPrincipal Usuario usuario,
            HttpServletRequest request) {

        try {
            Map<String, Object> resultado =
                    pagamentoService.criarPagamentoOnline(
                            requisicao,
                            usuario.getId(),
                            request.getRemoteAddr()
                    );

            return ResponseEntity.ok(resultado);

        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404)
                    .body(Map.of("erro", e.getMessage()));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("erro", e.getMessage()));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(502)
                    .body(Map.of(
                            "erro",
                            "Não foi possível processar o pagamento."
                    ));
        }
    }
}