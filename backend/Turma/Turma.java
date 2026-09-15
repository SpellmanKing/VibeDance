package com.vibedance.model;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "turmas")
public class Turma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Relacionamento: Muitas turmas podem pertencer a uma mesma Modalidade
    @ManyToOne
    @JoinColumn(name = "modalidade_id", nullable = false)
    private Modalidade modalidade;

    // Para simplificar agora, mapeamos o ID do professor diretamente.
    // Futuramente, isso pode virar um @ManyToOne com a entidade Usuario.
    @Column(name = "professor_id")
    private Long professorId;

    @Column(name = "dias_semana", nullable = false, length = 50)
    private String diasSemana;

    @Column(nullable = false)
    private LocalTime horario;

    @Column(name = "limite_vagas", nullable = false)
    private Integer limiteVagas;

    @Column(name = "vagas_ocupadas")
    private Integer vagasOcupadas = 0;

    // Construtor vazio exigido pelo JPA
    public Turma() {
    }

    // Getters e Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Modalidade getModalidade() {
        return modalidade;
    }

    public void setModalidade(Modalidade modalidade) {
        this.modalidade = modalidade;
    }

    public Long getProfessorId() {
        return professorId;
    }

    public void setProfessorId(Long professorId) {
        this.professorId = professorId;
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

    public Integer getLimiteVagas() {
        return limiteVagas;
    }

    public void setLimiteVagas(Integer limiteVagas) {
        this.limiteVagas = limiteVagas;
    }

    public Integer getVagasOcupadas() {
        return vagasOcupadas;
    }

    public void setVagasOcupadas(Integer vagasOcupadas) {
        this.vagasOcupadas = vagasOcupadas;
    }
}