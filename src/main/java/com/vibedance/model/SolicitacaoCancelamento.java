package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

/** Pedido do aluno para cancelar a matrícula em uma ou mais turmas; decidido pelo ADM. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "solicitacoes_cancelamento")
public class SolicitacaoCancelamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_solicitacao")
    private Integer id;

    @Column(name = "id_aluno", nullable = false)
    private Integer idAluno;

    /** Ids das turmas separados por vírgula. */
    @Column(name = "turmas", nullable = false, length = 255)
    private String turmas;

    @Column(name = "motivo", nullable = false, length = 40)
    private String motivo;

    @Column(name = "justificativa", nullable = false, columnDefinition = "TEXT")
    private String justificativa;

    @Column(name = "status", nullable = false, length = 15)
    private String status = "SOLICITADA";

    @Column(name = "resposta", columnDefinition = "TEXT")
    private String resposta;

    @Column(name = "avaliado_por")
    private Integer avaliadoPor;

    @Column(name = "solicitado_em", insertable = false, updatable = false)
    private LocalDateTime solicitadoEm;

    @Column(name = "avaliado_em")
    private LocalDateTime avaliadoEm;

    public List<Integer> getIdsTurmas() {
        if (turmas == null || turmas.isBlank()) return List.of();
        return Arrays.stream(turmas.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Integer::valueOf).toList();
    }

    public void setIdsTurmas(Collection<Integer> ids) {
        this.turmas = ids.stream().distinct().map(String::valueOf).collect(Collectors.joining(","));
    }

    public Integer getId() {
        return id;
    }

    public Integer getIdAluno() {
        return idAluno;
    }

    public void setIdAluno(Integer idAluno) {
        this.idAluno = idAluno;
    }

    public String getTurmas() {
        return turmas;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public String getJustificativa() {
        return justificativa;
    }

    public void setJustificativa(String justificativa) {
        this.justificativa = justificativa;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public LocalDateTime getAvaliadoEm() {
        return avaliadoEm;
    }

    public void setAvaliadoEm(LocalDateTime avaliadoEm) {
        this.avaliadoEm = avaliadoEm;
    }
}
