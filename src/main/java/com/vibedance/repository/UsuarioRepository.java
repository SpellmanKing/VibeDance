package com.vibedance.repository;

import com.vibedance.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    Usuario findByEmail(String email);

    List<Usuario> findByPerfilAndAtivoTrueOrderByNomeAsc(String perfil);
}