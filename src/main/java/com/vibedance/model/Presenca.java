package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "presencas")
public class Presenca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_presenca")
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "id_turma", nullable = false)
    private Turma turma;

    @ManyToOne
    @JoinColumn(name = "id_aluno", nullable = false)
    private Usuario aluno;

    @Column(name = "data_aula", nullable = false)
    private LocalDate dataAula;

    @Column(name = "presente", nullable = false)
    private Boolean presente;

    @Column(name = "status", nullable = false, length = 12)
    private String status;

    @Column(name = "justificativa")
    private String justificativa;

    @Column(name = "registrado_em", insertable = false, updatable = false)
    private LocalDateTime registradoEm;

    public Presenca() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Turma getTurma() {
        return turma;
    }

    public void setTurma(Turma turma) {
        this.turma = turma;
    }

    public Usuario getAluno() {
        return aluno;
    }

    public void setAluno(Usuario aluno) {
        this.aluno = aluno;
    }

    public LocalDate getDataAula() {
        return dataAula;
    }

    public void setDataAula(LocalDate dataAula) {
        this.dataAula = dataAula;
    }

    public Boolean getPresente() {
        return presente;
    }

    public void setPresente(Boolean presente) {
        this.presente = presente;
        if (Boolean.TRUE.equals(presente)) {
            this.status = "PRESENTE";
        } else if (!"JUSTIFICADO".equals(this.status)) {
            this.status = "FALTA";
        }
    }

    public String getJustificativa() {
        return justificativa;
    }

    public void setJustificativa(String justificativa) {
        this.justificativa = justificativa;
    }

    public LocalDateTime getRegistradoEm() {
        return registradoEm;
    }

    public void setRegistradoEm(LocalDateTime registradoEm) {
        this.registradoEm = registradoEm;
    }

    public String getStatus() {
        return status;
    }

    /** PRESENTE, FALTA ou JUSTIFICADO — mantém o booleano legado sincronizado. */
    public void setStatus(String status) {
        this.status = status;
        this.presente = "PRESENTE".equals(status);
    }

    @PrePersist
    @PreUpdate
    void sincronizarStatus() {
        if (status == null) {
            if (Boolean.TRUE.equals(presente)) {
                status = "PRESENTE";
            } else if (justificativa != null && !justificativa.isBlank()) {
                status = "JUSTIFICADO";
            } else {
                status = "FALTA";
            }
        }
        presente = "PRESENTE".equals(status);
    }
}
