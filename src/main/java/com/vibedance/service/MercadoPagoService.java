package com.vibedance.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;

@Service
public class MercadoPagoService {

    private final RestClient restClient;

    @Value("${mercadopago.access-token:}")
    private String accessToken;

    public MercadoPagoService(RestClient mercadoPagoRestClient) {
        this.restClient = mercadoPagoRestClient;
    }

    private void validarCredencial() {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException(
                    "Credencial do Mercado Pago não configurada."
            );
        }
    }

    public Map<String, Object> buscarMeioPagamento(String id) {
        validarCredencial();

        try {
            return restClient.get()
                    .uri("/v1/payment_methods/{id}", id)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        } catch (RestClientResponseException e) {
            throw new IllegalStateException(
                    "Erro ao consultar meio de pagamento no Mercado Pago. Código: "
                            + e.getStatusCode(),
                    e
            );
        }
    }

    // Consulta os dados de um pagamento pelo ID no Mercado Pago.
    public Map<String, Object> buscarPagamento(String id) {
        validarCredencial();

        try {
            return restClient.get()
                    .uri("/v1/payments/{id}", id)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        } catch (RestClientResponseException e) {
            throw new IllegalStateException(
                    "Erro ao consultar pagamento no Mercado Pago. Código: "
                            + e.getStatusCode(),
                    e
            );
        }
    }

    public Map<String, Object> criarPagamento(
            Map<String, Object> dados,
            String chaveIdempotencia) {

        validarCredencial();

        try {
            return restClient.post()
                    .uri("/v1/payments")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .header("X-Idempotency-Key", chaveIdempotencia)
                    .body(dados)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        } catch (RestClientResponseException e) {
            throw new IllegalStateException(
                    "Erro ao solicitar pagamento ao Mercado Pago. Código: "
                            + e.getStatusCode(),
                    e
            );
        }
    }
}