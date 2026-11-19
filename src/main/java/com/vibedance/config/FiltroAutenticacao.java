package com.vibedance.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vibedance.exception.AcessoNegadoException;
import com.vibedance.model.Usuario;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.service.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filtro JWT + trava de domínio (camada 1 do back-end).
 * - Lê o token do header Authorization ou, apenas no stream SSE (/api/stream),
 *   do parâmetro access_token (EventSource não envia headers).
 * - Rejeita com 403 qualquer token cujo titular não seja @vibedance.com
 *   ou cuja conta esteja suspensa.
 */
public class FiltroAutenticacao extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final UsuarioRepository usuarioRepository;
    private final ObjectMapper objectMapper;

    public FiltroAutenticacao(TokenService tokenService, UsuarioRepository usuarioRepository, ObjectMapper objectMapper) {
        this.tokenService = tokenService;
        this.usuarioRepository = usuarioRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

        String token = extrairToken(request);

        if (token != null) {
            String email = tokenService.validarToken(token);

            if (email != null) {
                if (!Usuario.isDominioInstitucionalValido(email)) {
                    SecurityContextHolder.clearContext();
                    SecurityConfigurations.escreverErro(objectMapper, response, HttpStatus.FORBIDDEN,
                        "DOMINIO_NAO_AUTORIZADO", AcessoNegadoException.MSG_DOMINIO, request.getRequestURI());
                    return;
                }

                Usuario usuario = usuarioRepository.findByEmail(email.trim().toLowerCase());

                if (usuario != null && !Boolean.TRUE.equals(usuario.getAtivo())) {
                    SecurityContextHolder.clearContext();
                    SecurityConfigurations.escreverErro(objectMapper, response, HttpStatus.FORBIDDEN,
                        "CONTA_SUSPENSA", "Sua conta está suspensa. Procure a administração do estúdio.",
                        request.getRequestURI());
                    return;
                }

                if (usuario != null && usuario.isEnabled()
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                    var autenticacao = new UsernamePasswordAuthenticationToken(usuario, null, usuario.getAuthorities());
                    autenticacao.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(autenticacao);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extrairToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        if ("/api/stream".equals(request.getRequestURI())) {
            String token = request.getParameter("access_token");
            return token == null || token.isBlank() ? null : token.trim();
        }
        return null;
    }
}
