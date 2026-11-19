package com.vibedance.config;

import com.vibedance.exception.AcessoNegadoException;
import com.vibedance.model.Usuario;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Camada 2 da trava de domínio: todo handler de /api/** revalida, antes de executar,
 * que o usuário autenticado pertence a @vibedance.com e está ativo. Qualquer falha
 * vira 403 tratado pelo GlobalExceptionHandler.
 */
@Component
public class DominioInstitucionalInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Usuario usuario) {
            if (!Usuario.isDominioInstitucionalValido(usuario.getEmail())) {
                throw AcessoNegadoException.dominio();
            }
            if (!Boolean.TRUE.equals(usuario.getAtivo())) {
                throw new AcessoNegadoException("CONTA_SUSPENSA", "Sua conta está suspensa.");
            }
        }
        return true;
    }
}
