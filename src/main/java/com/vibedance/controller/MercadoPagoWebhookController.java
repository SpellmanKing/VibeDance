package com.vibedance.controller;

import com.vibedance.service.MercadoPagoWebhookSignatureService;
import com.vibedance.service.PagamentoService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webhooks/mercadopago")
public class MercadoPagoWebhookController {

    private final PagamentoService pagamentoService;
    private final MercadoPagoWebhookSignatureService assinaturaService;

    public MercadoPagoWebhookController(
            PagamentoService pagamentoService,
            MercadoPagoWebhookSignatureService assinaturaService) {

        this.pagamentoService = pagamentoService;
        this.assinaturaService = assinaturaService;
    }

    @PostMapping
    public ResponseEntity<Void> receberNotificacao(
            @RequestHeader(value = "x-signature", required = false)
            String assinatura,

            @RequestHeader(value = "x-request-id", required = false)
            String requestId,

            @RequestParam(name = "data.id", required = false)
            String dataId) {

        if (dataId == null || dataId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        boolean assinaturaValida = assinaturaService.validar(
                assinatura,
                requestId,
                dataId
        );

        if (!assinaturaValida) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            pagamentoService.atualizarPagamentoNotificado(dataId);
            return ResponseEntity.ok().build();

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();

        } catch (IllegalStateException e) {
            return ResponseEntity.status(
                    HttpStatus.BAD_GATEWAY
            ).build();

        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}