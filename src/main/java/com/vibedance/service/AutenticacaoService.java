package com.vibedance.service;

import com.vibedance.model.Usuario;
import com.vibedance.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AutenticacaoService implements UserDetailsService {

    @Autowired
    private UsuarioRepository repository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        if (!Usuario.isDominioInstitucionalValido(username)) {
            throw new BadCredentialsException(
                "Acesso restrito a contas institucionais VibeDance (@vibedance.com)."
            );
        }

        UserDetails usuario = repository.findByEmail(username.trim().toLowerCase());
        if (usuario == null) {
            throw new UsernameNotFoundException("Conta institucional VibeDance não encontrada.");
        }
        return usuario;
    }
}
