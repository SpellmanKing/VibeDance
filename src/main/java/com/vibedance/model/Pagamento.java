package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "pagamentos")
public class Pagamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pagamento")
    private Integer id;

    @Column(name = "id_fatura", nullable = false)
    private Integer idFatura;

    @Column(name = "id_aluno", nullable = false)
    private Integer idAluno;

    @Column(name = "forma_pagamento", nullable = false, length = 30)
    private String formaPagamento;

    @Column(name = "valor_pago", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorPago;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDENTE";

    @Column(name = "comprovante_url", columnDefinition = "TEXT")
    private String comprovanteUrl;

    @Column(name = "comprovante_nome", length = 255)
    private String comprovanteNome;

    @Column(name = "gateway_transacao_id", length = 100)
    private String gatewayTransacaoId;

    @Column(name = "comprovante_enviado_em")
    private LocalDateTime comprovanteEnviadoEm;

    @Column(name = "data_confirmacao")
    private LocalDateTime dataConfirmacao;

    @Column(name = "validado_por")
    private Integer validadoPor;

    @Column(name = "observacao", columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private LocalDateTime criadoEm;

    /** Valor da fatura no momento do pagamento (antes de multa/juros/descontos). */
    @Column(name = "valor_base", precision = 10, scale = 2)
    private BigDecimal valorBase;

    @Column(name = "parcelas")
    private Integer parcelas;

    /** Ex.: "Visa •••• 4242" ou "Boleto 23793.38128…" — nunca o número completo do cartão. */
    @Column(name = "metodo_detalhe", length = 80)
    private String metodoDetalhe;

    public Pagamento() {
    }

    public BigDecimal getValorBase() {
        return valorBase;
    }

    public void setValorBase(BigDecimal valorBase) {
        this.valorBase = valorBase;
    }

    public Integer getParcelas() {
        return parcelas;
    }

    public void setParcelas(Integer parcelas) {
        this.parcelas = parcelas;
    }

    public String getMetodoDetalhe() {
        return metodoDetalhe;
    }

    public void setMetodoDetalhe(String metodoDetalhe) {
        this.metodoDetalhe = metodoDetalhe;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getIdFatura() {
        return idFatura;
    }

    public void setIdFatura(Integer idFatura) {
        this.idFatura = idFatura;
    }

    public Integer getIdAluno() {
        return idAluno;
    }

    public void setIdAluno(Integer idAluno) {
        this.idAluno = idAluno;
    }

    public String getFormaPagamento() {
        return formaPagamento;
    }

    public void setFormaPagamento(String formaPagamento) {
        this.formaPagamento = formaPagamento;
    }

    public BigDecimal getValorPago() {
        return valorPago;
    }

    public void setValorPago(BigDecimal valorPago) {
        this.valorPago = valorPago;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getComprovanteUrl() {
        return comprovanteUrl;
    }

    public void setComprovanteUrl(String comprovanteUrl) {
        this.comprovanteUrl = comprovanteUrl;
    }

    public String getComprovanteNome() {
        return comprovanteNome;
    }

    public void setComprovanteNome(String comprovanteNome) {
        this.comprovanteNome = comprovanteNome;
    }

    public String getGatewayTransacaoId() {
        return gatewayTransacaoId;
    }

    public void setGatewayTransacaoId(String gatewayTransacaoId) {
        this.gatewayTransacaoId = gatewayTransacaoId;
    }

    public LocalDateTime getComprovanteEnviadoEm() {
        return comprovanteEnviadoEm;
    }

    public void setComprovanteEnviadoEm(LocalDateTime comprovanteEnviadoEm) {
        this.comprovanteEnviadoEm = comprovanteEnviadoEm;
    }

    public LocalDateTime getDataConfirmacao() {
        return dataConfirmacao;
    }

    public void setDataConfirmacao(LocalDateTime dataConfirmacao) {
        this.dataConfirmacao = dataConfirmacao;
    }

    public Integer getValidadoPor() {
        return validadoPor;
    }

    public void setValidadoPor(Integer validadoPor) {
        this.validadoPor = validadoPor;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }
}
