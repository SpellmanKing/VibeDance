package com.vibedance.config;

import com.vibedance.repository.UsuarioRepository;
import com.vibedance.service.TokenService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class FiltroAutenticacao extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final UsuarioRepository usuarioRepository;

    public FiltroAutenticacao(
        TokenService tokenService,
        UsuarioRepository usuarioRepository) {
            this.tokenService = tokenService;
            this.usuarioRepository = usuarioRepository;
    }
    
    @Override 
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain)
        throws ServletException, IOException {

            String authorization = request.getHeader("Authorization");

            if (authorization != null && authorization.startsWith("Bearer ")) {

                String token = authorization.substring(7).trim();

                if (!token.isEmpty()) {

                    String email = tokenService.validarToken(token);

                    if (email != null &&
                        SecurityContextHolder.getContext().getAuthentication() == null) {

                            UserDetails usuario = usuarioRepository.findByEmail(email);

                            if (usuario != null && usuario.isEnabled()) {

                                var autenticacao = 
                                new UsernamePasswordAuthenticationToken(
                                    usuario,
                                    null,
                                    usuario.getAuthorities()
                                );

                                autenticacao.setDetails(
                                    new WebAuthenticationDetailsSource()
                                    .buildDetails(request)
                                );

                                SecurityContextHolder.getContext()
                                .setAuthentication(autenticacao);
                            }
                        }
                }
            }

            filterChain.doFilter(request, response);
        }

}