package com.vibedance.dto;

import com.vibedance.model.Pagamento;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class PagamentoAlunoResponse {

    private Integer id;
    private Integer idFatura;
    private String status;
    private String formaPagamento;
    private BigDecimal valorPago;
    private LocalDateTime dataConfirmacao;
    private LocalDateTime criadoEm;
    private String comprovanteNome;
    private LocalDateTime comprovanteEnviadoEm;
    private boolean possuiComprovante;

    public PagamentoAlunoResponse(Pagamento pagamento) {
        this.id = pagamento.getId();
        this.idFatura = pagamento.getIdFatura();
        this.status = pagamento.getStatus();
        this.formaPagamento = pagamento.getFormaPagamento();
        this.valorPago = pagamento.getValorPago();
        this.dataConfirmacao = pagamento.getDataConfirmacao();
        this.criadoEm = pagamento.getCriadoEm();
        this.comprovanteNome = pagamento.getComprovanteNome();
        this.comprovanteEnviadoEm = pagamento.getComprovanteEnviadoEm();

        this.possuiComprovante =
                pagamento.getComprovanteUrl() != null
                && !pagamento.getComprovanteUrl().isBlank();
    }

    public Integer getId() {
        return id;
    }

    public Integer getIdFatura() {
        return idFatura;
    }

    public String getStatus() {
        return status;
    }

    public String getFormaPagamento() {
        return formaPagamento;
    }

    public BigDecimal getValorPago() {
        return valorPago;
    }

    public LocalDateTime getDataConfirmacao() {
        return dataConfirmacao;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }

    public String getComprovanteNome() {
        return comprovanteNome;
    }

    public LocalDateTime getComprovanteEnviadoEm() {
        return comprovanteEnviadoEm;
    }

    public boolean isPossuiComprovante() {
        return possuiComprovante;
    }
}