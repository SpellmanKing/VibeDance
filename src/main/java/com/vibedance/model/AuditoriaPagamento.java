package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;

import javax.annotation.processing.Generated;

@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "auditoria_pagamentos")
public class AuditoriaPagamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_auditoria")
    private Integer id;

    @Column(name = "id_pagamento", nullable = false)
    private Integer idPagamento;

    @Column(name = "id_usuario_operador", nullable = false)
    private Integer idUsuarioOperador;

    @Column(name = "acao", nullable = false, length = 50)
    private String acao;

    @Column(name = "status_anterior", length = 20)
    private String statusAnterior;

    @Column(name = "status_novo", length = 20)
    private String statusNovo;

    @Column(name = "motivo_observacao", columnDefinition = "TEXT")
    private String motivoObservacao;

    @Column(name = "ip_origem", length = 45)
    private String ipOrigem;

    @Column(name = "data_hora", insertable = false, updatable = false)
    private LocalDateTime dataHora;

    public AuditoriaPagamento() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    } 

    public Integer getIdPagamento() {
        return idPagamento;
    }

    public void setIdPagamento(Integer idPagamento) {
        this.idPagamento = idPagamento;
    }

    public Integer getIdUsuarioOperador() {
        return idUsuarioOperador;
    }

    public void setIdUsuarioOperador(Integer idUsuarioOperador) {
        this.idUsuarioOperador = idUsuarioOperador;
    }

    public String getAcao() {
        return acao;
    }

    public void setAcao(String acao) {
        this.acao = acao;
    }

    public String getStatusAnterior() {
        return statusAnterior;
    }

    public void setStatusAnterior(String statusAnterior) {
        this.statusAnterior = statusAnterior;
    }

    public String getStatusNovo() {
        return statusNovo;
    }

    public void setStatusNovo(String statusNovo) {
        this.statusNovo = statusNovo;
    }

    public String getMotivoObservacao() {
        return motivoObservacao;
    }

    public void setMotivoObservacao(String motivoObservacao) {
        this.motivoObservacao = motivoObservacao;
    }

    public String getIpOrigem() {
        return ipOrigem;
    }

    public void setIpOrigem(String ipOrigem) {
        this.ipOrigem = ipOrigem;
    }

    public LocalDateTime getDataHora() {
        return dataHora;
    }
}