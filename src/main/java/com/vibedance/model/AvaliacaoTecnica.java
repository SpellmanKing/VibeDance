package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

/** Avaliação técnica individual (notas 0–10) enviada pelo professor ao aluno. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "avaliacoes_tecnicas")
public class AvaliacaoTecnica {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_avaliacao")
    private Integer id;

    @Column(name = "id_turma", nullable = false)
    private Integer idTurma;

    @Column(name = "id_aluno", nullable = false)
    private Integer idAluno;

    @Column(name = "id_professor", nullable = false)
    private Integer idProfessor;

    @Column(name = "coreografia_foco", nullable = false)
    private String coreografiaFoco;

    @Column(name = "nota_ritmo", nullable = false, precision = 3, scale = 1)
    private BigDecimal notaRitmo;

    @Column(name = "nota_tecnica", nullable = false, precision = 3, scale = 1)
    private BigDecimal notaTecnica;

    @Column(name = "nota_expressao", nullable = false, precision = 3, scale = 1)
    private BigDecimal notaExpressao;

    @Column(name = "nota_coreografia", nullable = false, precision = 3, scale = 1)
    private BigDecimal notaCoreografia;

    @Column(name = "feedback_texto", nullable = false)
    private String feedbackTexto;

    @Column(name = "link_referencia")
    private String linkReferencia;

    @Column(name = "data_avaliacao", insertable = false, updatable = false)
    private LocalDateTime dataAvaliacao;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getIdTurma() {
        return idTurma;
    }

    public void setIdTurma(Integer idTurma) {
        this.idTurma = idTurma;
    }

    public Integer getIdAluno() {
        return idAluno;
    }

    public void setIdAluno(Integer idAluno) {
        this.idAluno = idAluno;
    }

    public Integer getIdProfessor() {
        return idProfessor;
    }

    public void setIdProfessor(Integer idProfessor) {
        this.idProfessor = idProfessor;
    }

    public String getCoreografiaFoco() {
        return coreografiaFoco;
    }

    public void setCoreografiaFoco(String coreografiaFoco) {
        this.coreografiaFoco = coreografiaFoco;
    }

    public BigDecimal getNotaRitmo() {
        return notaRitmo;
    }

    public void setNotaRitmo(BigDecimal notaRitmo) {
        this.notaRitmo = notaRitmo;
    }

    public BigDecimal getNotaTecnica() {
        return notaTecnica;
    }

    public void setNotaTecnica(BigDecimal notaTecnica) {
        this.notaTecnica = notaTecnica;
    }

    public BigDecimal getNotaExpressao() {
        return notaExpressao;
    }

    public void setNotaExpressao(BigDecimal notaExpressao) {
        this.notaExpressao = notaExpressao;
    }

    public BigDecimal getNotaCoreografia() {
        return notaCoreografia;
    }

    public void setNotaCoreografia(BigDecimal notaCoreografia) {
        this.notaCoreografia = notaCoreografia;
    }

    public String getFeedbackTexto() {
        return feedbackTexto;
    }

    public void setFeedbackTexto(String feedbackTexto) {
        this.feedbackTexto = feedbackTexto;
    }

    public String getLinkReferencia() {
        return linkReferencia;
    }

    public void setLinkReferencia(String linkReferencia) {
        this.linkReferencia = linkReferencia;
    }

    public LocalDateTime getDataAvaliacao() {
        return dataAvaliacao;
    }

    public void setDataAvaliacao(LocalDateTime dataAvaliacao) {
        this.dataAvaliacao = dataAvaliacao;
    }
}
