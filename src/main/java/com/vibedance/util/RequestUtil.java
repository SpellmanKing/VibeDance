package com.vibedance.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class RequestUtil {

    private RequestUtil() {
    }

    /** IP de origem da requisição corrente (respeita X-Forwarded-For). */
    public static String ipAtual() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        HttpServletRequest request = attrs.getRequest();
        String encaminhado = request.getHeader("X-Forwarded-For");
        String ip = (encaminhado != null && !encaminhado.isBlank())
            ? encaminhado.split(",")[0].trim()
            : request.getRemoteAddr();
        return ip != null && ip.length() > 45 ? ip.substring(0, 45) : ip;
    }
}
