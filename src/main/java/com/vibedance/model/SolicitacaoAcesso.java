package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

/** Pedido público de acesso ("Quero dançar"): analisado pelo ADM, que cria a conta institucional. */
@Entity
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "solicitacoes_acesso")
public class SolicitacaoAcesso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_solicitacao")
    private Integer id;

    @Column(name = "protocolo", nullable = false, unique = true, length = 12)
    private String protocolo;

    @Column(name = "nome", nullable = false, length = 120)
    private String nome;

    @Column(name = "email_contato", nullable = false, length = 150)
    private String emailContato;

    @Column(name = "telefone", nullable = false, length = 20)
    private String telefone;

    @Column(name = "cpf", nullable = false, length = 14)
    private String cpf;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(name = "modalidades", length = 255)
    private String modalidades;

    @Column(name = "experiencia", nullable = false, length = 20)
    private String experiencia;

    @Column(name = "turmas_interesse", length = 255)
    private String turmasInteresse;

    @Column(name = "disponibilidade", length = 255)
    private String disponibilidade;

    @Column(name = "objetivo", length = 30)
    private String objetivo;

    @Column(name = "mensagem", columnDefinition = "TEXT")
    private String mensagem;

    @Column(name = "origem", length = 40)
    private String origem;

    @Column(name = "status", nullable = false, length = 15)
    private String status = "NOVA";

    @Column(name = "resposta", columnDefinition = "TEXT")
    private String resposta;

    @Column(name = "nota_interna", columnDefinition = "TEXT")
    private String notaInterna;

    @Column(name = "email_institucional", length = 150)
    private String emailInstitucional;

    @Column(name = "id_usuario_criado")
    private Integer idUsuarioCriado;

    @Column(name = "avaliado_por")
    private Integer avaliadoPor;

    @Column(name = "ip_origem", length = 45)
    private String ipOrigem;

    @Column(name = "solicitado_em", insertable = false, updatable = false)
    private LocalDateTime solicitadoEm;

    @Column(name = "atualizado_em")
    private LocalDateTime atualizadoEm;

    @Column(name = "avaliado_em")
    private LocalDateTime avaliadoEm;

    @Column(name = "ativado_em")
    private LocalDateTime ativadoEm;

    public static List<String> separar(String texto) {
        if (texto == null || texto.isBlank()) return List.of();
        return Arrays.stream(texto.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public static String juntar(Collection<?> itens) {
        return itens == null ? null : itens.stream().map(String::valueOf).distinct().collect(Collectors.joining(","));
    }

    public List<Integer> getIdsTurmas() {
        return separar(turmasInteresse).stream().map(Integer::valueOf).toList();
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getProtocolo() { return protocolo; }
    public void setProtocolo(String protocolo) { this.protocolo = protocolo; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmailContato() { return emailContato; }
    public void setEmailContato(String emailContato) { this.emailContato = emailContato; }
    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }
    public String getCpf() { return cpf; }
    public void setCpf(String cpf) { this.cpf = cpf; }
    public LocalDate getDataNascimento() { return dataNascimento; }
    public void setDataNascimento(LocalDate dataNascimento) { this.dataNascimento = dataNascimento; }
    public String getModalidades() { return modalidades; }
    public void setModalidades(String modalidades) { this.modalidades = modalidades; }
    public String getExperiencia() { return experiencia; }
    public void setExperiencia(String experiencia) { this.experiencia = experiencia; }
    public String getTurmasInteresse() { return turmasInteresse; }
    public void setTurmasInteresse(String turmasInteresse) { this.turmasInteresse = turmasInteresse; }
    public String getDisponibilidade() { return disponibilidade; }
    public void setDisponibilidade(String disponibilidade) { this.disponibilidade = disponibilidade; }
    public String getObjetivo() { return objetivo; }
    public void setObjetivo(String objetivo) { this.objetivo = objetivo; }
    public String getMensagem() { return mensagem; }
    public void setMensagem(String mensagem) { this.mensagem = mensagem; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResposta() { return resposta; }
    public void setResposta(String resposta) { this.resposta = resposta; }
    public String getNotaInterna() { return notaInterna; }
    public void setNotaInterna(String notaInterna) { this.notaInterna = notaInterna; }
    public String getEmailInstitucional() { return emailInstitucional; }
    public void setEmailInstitucional(String emailInstitucional) { this.emailInstitucional = emailInstitucional; }
    public Integer getIdUsuarioCriado() { return idUsuarioCriado; }
    public void setIdUsuarioCriado(Integer idUsuarioCriado) { this.idUsuarioCriado = idUsuarioCriado; }
    public Integer getAvaliadoPor() { return avaliadoPor; }
    public void setAvaliadoPor(Integer avaliadoPor) { this.avaliadoPor = avaliadoPor; }
    public String getIpOrigem() { return ipOrigem; }
    public void setIpOrigem(String ipOrigem) { this.ipOrigem = ipOrigem; }
    public LocalDateTime getSolicitadoEm() { return solicitadoEm; }
    public void setSolicitadoEm(LocalDateTime solicitadoEm) { this.solicitadoEm = solicitadoEm; }
    public LocalDateTime getAtualizadoEm() { return atualizadoEm; }
    public void setAtualizadoEm(LocalDateTime atualizadoEm) { this.atualizadoEm = atualizadoEm; }
    public LocalDateTime getAvaliadoEm() { return avaliadoEm; }
    public void setAvaliadoEm(LocalDateTime avaliadoEm) { this.avaliadoEm = avaliadoEm; }
    public LocalDateTime getAtivadoEm() { return ativadoEm; }
    public void setAtivadoEm(LocalDateTime ativadoEm) { this.ativadoEm = ativadoEm; }
}
