package com.vibedance.model;

import jakarta.persistence.*;

import java.beans.Transient;
import java.time.LocalTime;

@Entity
@Table(name = "turmas")
public class Turma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_turma")
    private Integer id;

    // Relacionamento: Muitas turmas podem pertencer a uma mesma Modalidade
    @ManyToOne
    @JoinColumn(name = "id_modalidade", nullable = false)
    private Modalidade modalidade;

    // Para simplificar agora, mapeamos o ID do professor diretamente.
    // Futuramente, isso pode virar um @ManyToOne com a entidade Usuario.
    @Column(name = "id_professor")
    private Integer professorId;

    @Column(name = "id_sala")
    private Integer salaId;

    @Column(name = "nome_turma")
    private String nomeTurma;

    @Column(name = "dias_semana", nullable = false, length = 50)
    private String diasSemana;

    @Column(name = "horario_inicio", nullable = false)
    private LocalTime horario;

    @Column(name = "horario_fim")
    private LocalTime horarioFim;

    @Column(name = "nivel")
    private String nivel;

    @Column(name = "limite_vagas", nullable = false)
    private Integer limiteVagas;

    @Column(name = "ativo")
    private Boolean ativo;

    // Valor temporário
    @jakarta.persistence.Transient
    private Integer vagasOcupadas = 0;

    // Construtor vazio exigido pelo JPA
    public Turma() {
    }

    // Getters e Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Modalidade getModalidade() {
        return modalidade;
    }

    public void setModalidade(Modalidade modalidade) {
        this.modalidade = modalidade;
    }

    public Integer getProfessorId() {
        return professorId;
    }

    public void setProfessorId(Integer professorId) {
        this.professorId = professorId;
    }

    public Integer getSalaId() {
        return salaId;
    }

    public void setSalaId(Integer salaId) {
        this.salaId = salaId;
    }

    public String getNomeTurma() {
        return nomeTurma;
    }

    public void setNomeTurma(String nomeTurma) {
        this.nomeTurma = nomeTurma;
    }

    public String getDiasSemana() {
        return diasSemana;
    }

    public void setDiasSemana(String diasSemana) {
        this.diasSemana = diasSemana;
    }

    public LocalTime getHorario() {
        return horario;
    }

    public void setHorario(LocalTime horario) {
        this.horario = horario;
    }

    public LocalTime getHorarioFim() {
        return horarioFim;
    }

    public void setHorarioFim(LocalTime horarioFim) {
        this.horarioFim = horarioFim;
    }

    public String getNivel() {
        return nivel;
    }

    public void setNivel(String nivel) {
        this.nivel = nivel;
    }

    public Integer getLimiteVagas() {
        return limiteVagas;
    }

    public void setLimiteVagas(Integer limiteVagas) {
        this.limiteVagas = limiteVagas;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public Integer getVagasOcupadas() {
        return vagasOcupadas;
    }

    public void setVagasOcupadas(Integer vagasOcupadas) {
        this.vagasOcupadas = vagasOcupadas;
    }
}