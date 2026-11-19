package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Notificação persistente exibida no sininho do usuário. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "notificacoes")
public class Notificacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_notificacao")
    private Integer id;

    @Column(name = "id_usuario", nullable = false)
    private Integer idUsuario;

    @Column(name = "titulo", nullable = false)
    private String titulo;

    @Column(name = "mensagem")
    private String mensagem;

    @Column(name = "tipo", nullable = false)
    private String tipo;

    @Column(name = "link")
    private String link;

    @Column(name = "lida", nullable = false)
    private Boolean lida;

    @Column(name = "criada_em", insertable = false, updatable = false)
    private LocalDateTime criadaEm;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getIdUsuario() {
        return idUsuario;
    }

    public void setIdUsuario(Integer idUsuario) {
        this.idUsuario = idUsuario;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public Boolean getLida() {
        return lida;
    }

    public void setLida(Boolean lida) {
        this.lida = lida;
    }

    public LocalDateTime getCriadaEm() {
        return criadaEm;
    }

    public void setCriadaEm(LocalDateTime criadaEm) {
        this.criadaEm = criadaEm;
    }
}
