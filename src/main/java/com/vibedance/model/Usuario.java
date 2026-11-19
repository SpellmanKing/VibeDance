package com.vibedance.model;

import com.vibedance.realtime.SincronizacaoEntityListener;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

@Entity
@JsonIgnoreProperties(value = {"senha", "password", "authorities", "username", "accountNonExpired", "accountNonLocked", "credentialsNonExpired", "enabled"}, allowSetters = true)
@EntityListeners(SincronizacaoEntityListener.class)
@Table(name = "usuarios")
public class Usuario implements UserDetails {

    public static final Pattern PADRAO_DOMINIO_VIBEDANCE = Pattern.compile(
        "^[a-zA-Z0-9._%+-]+@vibedance\\.com$",
        Pattern.CASE_INSENSITIVE
    );

    public static boolean isDominioInstitucionalValido(String email) {
        if (email == null || email.isBlank()) {
            return false;
        }
        return PADRAO_DOMINIO_VIBEDANCE.matcher(email.trim()).matches();
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Integer id;

    @Column(name = "nome")
    private String nome;

    @Column(name = "cpf")
    private String cpf;

    @Column(name = "email")
    private String email;

    @Column(name = "senha")
    private String senha;

    @Column(name = "telefone")
    private String telefone;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "tipo_perfil")
    private String perfil; // ALUNO, PROFESSOR, ADMINISTRADOR

    @Column(name = "ativo")
    private Boolean ativo;

    @Column(name = "data_cadastro")
    private LocalDateTime dataCadastro;

    public Usuario() {
    }

    @PrePersist
    @PreUpdate
    public void validarDominioInstitucional() {
        if (!isDominioInstitucionalValido(this.email)) {
            throw new IllegalArgumentException(
                "Acesso bloqueado: o cadastro e login são exclusivos para contas institucionais @vibedance.com."
            );
        }
        this.email = this.email.trim().toLowerCase();
        if (this.ativo == null) {
            this.ativo = true;
        }
        if (this.dataCadastro == null) {
            this.dataCadastro = LocalDateTime.now();
        }
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

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getPerfil() {
        return perfil;
    }

    public void setPerfil(String perfil) {
        this.perfil = perfil;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public LocalDateTime getDataCadastro() {
        return dataCadastro;
    }

    public void setDataCadastro(LocalDateTime dataCadastro) {
        this.dataCadastro = dataCadastro;
    }

    // --- MÉTODOS DO USERDETAILS (SPRING SECURITY) ---

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + this.perfil));
    }

    @Override
    public String getPassword() {
        return this.senha;
    }

    @Override
    public String getUsername() {
        return this.email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(this.ativo) && isDominioInstitucionalValido(this.email);
    }
}
