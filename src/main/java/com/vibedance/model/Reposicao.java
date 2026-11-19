package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Solicitação de reposição ou aula experimental em uma turma de destino. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "reposicoes")
public class Reposicao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_reposicao")
    private Integer id;

    @Column(name = "id_aluno", nullable = false)
    private Integer idAluno;

    @Column(name = "id_turma_origem")
    private Integer idTurmaOrigem;

    @Column(name = "id_turma_destino", nullable = false)
    private Integer idTurmaDestino;

    @Column(name = "data_falta")
    private LocalDate dataFalta;

    @Column(name = "data_aula_destino", nullable = false)
    private LocalDate dataAulaDestino;

    @Column(name = "tipo", nullable = false)
    private String tipo;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "motivo")
    private String motivo;

    @Column(name = "resposta")
    private String resposta;

    @Column(name = "avaliado_por")
    private Integer avaliadoPor;

    @Column(name = "solicitado_em", insertable = false, updatable = false)
    private LocalDateTime solicitadoEm;

    @Column(name = "avaliado_em")
    private LocalDateTime avaliadoEm;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getIdAluno() {
        return idAluno;
    }

    public void setIdAluno(Integer idAluno) {
        this.idAluno = idAluno;
    }

    public Integer getIdTurmaOrigem() {
        return idTurmaOrigem;
    }

    public void setIdTurmaOrigem(Integer idTurmaOrigem) {
        this.idTurmaOrigem = idTurmaOrigem;
    }

    public Integer getIdTurmaDestino() {
        return idTurmaDestino;
    }

    public void setIdTurmaDestino(Integer idTurmaDestino) {
        this.idTurmaDestino = idTurmaDestino;
    }

    public LocalDate getDataFalta() {
        return dataFalta;
    }

    public void setDataFalta(LocalDate dataFalta) {
        this.dataFalta = dataFalta;
    }

    public LocalDate getDataAulaDestino() {
        return dataAulaDestino;
    }

    public void setDataAulaDestino(LocalDate dataAulaDestino) {
        this.dataAulaDestino = dataAulaDestino;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public String getResposta() {
        return resposta;
    }

    public void setResposta(String resposta) {
        this.resposta = resposta;
    }

    public Integer getAvaliadoPor() {
        return avaliadoPor;
    }

    public void setAvaliadoPor(Integer avaliadoPor) {
        this.avaliadoPor = avaliadoPor;
    }

    public LocalDateTime getSolicitadoEm() {
        return solicitadoEm;
    }

    public void setSolicitadoEm(LocalDateTime solicitadoEm) {
        this.solicitadoEm = solicitadoEm;
    }

    public LocalDateTime getAvaliadoEm() {
        return avaliadoEm;
    }

    public void setAvaliadoEm(LocalDateTime avaliadoEm) {
        this.avaliadoEm = avaliadoEm;
    }
}
