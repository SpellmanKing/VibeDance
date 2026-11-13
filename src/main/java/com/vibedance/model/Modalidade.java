package com.vibedance.model;

import jakarta.persistence.*;

@Entity
@Table(name = "modalidades")
public class Modalidade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_modalidade")
    private Integer id;

    @Column(name = "nome")
    private String nome;

    @Column(name = "categoria")
    private String categoria;

    @Column(name = "descricao", columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "icone")
    private String icone;

    @Column(name = "imagem_url")
    private String imagemUrl;

    @Column(name = "ativo")
    private Boolean status;

    // Construtores, Getters e Setters
    public Modalidade() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getIcone() {
        return icone;
    }

    public void setIcone(String icone) {
        this.icone = icone;
    }

    public String getImagemUrl() {
        return imagemUrl;
    }

    public void setImagemUrl(String imagemUrl) {
        this.imagemUrl = imagemUrl;
    }

    public Boolean getStatus() {
        return status;
    }

    public void setStatus(Boolean status) {
        this.status = status;
    }
}