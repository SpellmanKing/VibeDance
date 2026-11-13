package com.vibedance.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class MercadoPagoWebhookSignatureServiceTest {

    private MercadoPagoWebhookSignatureService service;

    private static final String ASSINATURA_VALIDA =
            "ts=1700000000,v1=fa60dc7eeec14f1d3ea9568926f0aa9cf79dbde1e70dc787aa60cf7b71254be9";

    @BeforeEach
    void configurar() {
        service = new MercadoPagoWebhookSignatureService();

        ReflectionTestUtils.setField(
                service, "webhookSecret", "test-secret"
        );
    }

    @Test
    void deveAceitarAssinaturaValida() {
        assertTrue(service.validar(
                ASSINATURA_VALIDA,
                "req-456",
                "123"
        ));
    }

    @Test
    void deveRejeitarAssinaturaAdulterada() {
        assertFalse(service.validar(
                ASSINATURA_VALIDA,
                "req-456",
                "999"
        ));
    }

    @Test
    void deveRejeitarAssinaturaAusente() {
        assertFalse(service.validar(
                null,
                "req-456",
                "123"
        ));
    }

    @Test
    void deveRejeitarRequestIdAusente() {
        assertFalse(service.validar(
                ASSINATURA_VALIDA,
                null,
                "123"
        ));
    }

    @Test
    void deveRejeitarQuandoSegredoNaoConfigurado() {
        ReflectionTestUtils.setField(
                service, "webhookSecret", ""
        );

        assertFalse(service.validar(
                ASSINATURA_VALIDA,
                "req-456",
                "123"
        ));
    }
}