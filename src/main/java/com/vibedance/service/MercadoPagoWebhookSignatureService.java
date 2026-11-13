package com.vibedance.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Service
public class MercadoPagoWebhookSignatureService {

    @Value("${mercadopago.webhook-secret:}")
    private String webhookSecret;

    public boolean validar(
            String assinatura,
            String requestId,
            String dataId) {

        if (webhookSecret == null || webhookSecret.isBlank()
                || assinatura == null || assinatura.isBlank()
                || requestId == null || requestId.isBlank()
                || dataId == null || dataId.isBlank()) {
            return false;
        }

        String timestamp = null;
        String hashRecebido = null;

        for (String parte : assinatura.split(",")) {
            String[] campos = parte.trim().split("=", 2);

            if (campos.length != 2) {
                continue;
            }

            String chave = campos[0].trim();
            String valor = campos[1].trim();

            if ("ts".equals(chave)) {
                timestamp = valor;
            } else if ("v1".equals(chave)) {
                hashRecebido = valor;
            }
        }

        if (timestamp == null || hashRecebido == null
                || !hashRecebido.matches("[0-9a-fA-F]{64}")) {
            return false;
        }

        String manifesto = "id:" + dataId
                + ";request-id:" + requestId
                + ";ts:" + timestamp + ";";

        try {
            Mac mac = Mac.getInstance("HmacSHA256");

            SecretKeySpec chave = new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"
            );

            mac.init(chave);

            byte[] assinaturaCalculada = mac.doFinal(
                    manifesto.getBytes(StandardCharsets.UTF_8)
            );

            byte[] assinaturaRecebida =
                    HexFormat.of().parseHex(hashRecebido);

            return MessageDigest.isEqual(
                    assinaturaCalculada,
                    assinaturaRecebida
            );

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Erro ao validar assinatura do webhook.", e
            );
        }
    }
}