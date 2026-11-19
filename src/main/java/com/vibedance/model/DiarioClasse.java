package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Diário de classe: conteúdo trabalhado, coreografia e referências de uma aula. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "diario_classe")
public class DiarioClasse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_diario")
    private Integer id;

    @Column(name = "id_turma", nullable = false)
    private Integer idTurma;

    @Column(name = "id_professor", nullable = false)
    private Integer idProfessor;

    @Column(name = "data_aula", nullable = false)
    private LocalDate dataAula;

    @Column(name = "conteudo", nullable = false)
    private String conteudo;

    @Column(name = "coreografia")
    private String coreografia;

    @Column(name = "links_referencia")
    private String linksReferencia;

    @Column(name = "observacoes")
    private String observacoes;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em")
    private LocalDateTime atualizadoEm;

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

    public Integer getIdProfessor() {
        return idProfessor;
    }

    public void setIdProfessor(Integer idProfessor) {
        this.idProfessor = idProfessor;
    }

    public LocalDate getDataAula() {
        return dataAula;
    }

    public void setDataAula(LocalDate dataAula) {
        this.dataAula = dataAula;
    }

    public String getConteudo() {
        return conteudo;
    }

    public void setConteudo(String conteudo) {
        this.conteudo = conteudo;
    }

    public String getCoreografia() {
        return coreografia;
    }

    public void setCoreografia(String coreografia) {
        this.coreografia = coreografia;
    }

    public String getLinksReferencia() {
        return linksReferencia;
    }

    public void setLinksReferencia(String linksReferencia) {
        this.linksReferencia = linksReferencia;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(LocalDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public LocalDateTime getAtualizadoEm() {
        return atualizadoEm;
    }

    public void setAtualizadoEm(LocalDateTime atualizadoEm) {
        this.atualizadoEm = atualizadoEm;
    }
}
