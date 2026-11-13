package com.vibedance.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

import javax.annotation.processing.Generated;

@Entity
@Table(name = "aulas_particulares")
public class AulaParticular {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_aula_particular")
    private Integer id;

    @Column(name = "id_aluno", nullable = false)
    private Integer idAluno;

    @Column(name = "id_professor")
    private Integer idProfessor;

    @Column(name = "id_modalidade", nullable = false)
    private Integer idModalidade;

    @Column(name = "id_sala")
    private Integer idSala;

    @Column(name = "data_horario", nullable = false)
    private LocalDateTime dataHora;

    @Column(name = "duracao_minutos")
    private Integer duracaoMinutos = 60;

    @Column(name = "status", length = 20)
    private String status = "SOLICITADO";

    @Column(name = "observacoes", columnDefinition = "TEXT")
    private String observacoes;

    public AulaParticular() {
    }

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

    public Integer getIdProfessor() {
        return idProfessor;
    }

    public void setIdProfessor(Integer idProfessor) {
        this.idProfessor = idProfessor;
    }

    public Integer getIdModalidade() {
        return idModalidade;
    }

    public void setIdModalidade(Integer idModalidade) {
        this.idModalidade = idModalidade;
    }

    public Integer getIdSala() {
        return idSala;
    }

    public void setIdSala(Integer idSala) {
        this.idSala = idSala;
    }

    public LocalDateTime getDataHora() {
        return dataHora;
    }

    public void setDataHora(LocalDateTime dataHora) {
        this.dataHora = dataHora;
    }

    public Integer getDuracaoMinutos() {
        return duracaoMinutos;
    }

    public void setDuracaoMinutos(Integer duracaoMinutos) {
        this.duracaoMinutos = duracaoMinutos;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }
}