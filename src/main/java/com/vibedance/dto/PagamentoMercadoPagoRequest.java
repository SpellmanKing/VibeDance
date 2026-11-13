package com.vibedance.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class PagamentoMercadoPagoRequest {

    private Integer idFatura;

    private String token;

    @JsonProperty("payment_method_id")
    private String paymentMethodId;

    private Integer installments;

    @JsonProperty("issuer_id")
    private Long issuerId;

    public Integer getIdFatura() {
        return idFatura;
    }

    public void setIdFatura(Integer idFatura) {
        this.idFatura = idFatura;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getPaymentMethodId() {
        return paymentMethodId;
    }

    public void setPaymentMethodId(String paymentMethodId) {
        this.paymentMethodId = paymentMethodId;
    }

    public Integer getInstallments() {
        return installments;
    }

    public void setInstallments(Integer installments) {
        this.installments = installments;
    }

    public Long getIssuerId() {
        return issuerId;
    }

    public void setIssuerId(Long issuerId) {
        this.issuerId = issuerId;
    }
}