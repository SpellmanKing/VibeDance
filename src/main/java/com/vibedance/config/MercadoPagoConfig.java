package com.vibedance.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class MercadoPagoConfig {

    @Bean
    public RestClient mercadoPagoRestClient(RestClient.Builder builder) {
        return builder
                .baseUrl("https://api.mercadopago.com")
                .build();
    }
}