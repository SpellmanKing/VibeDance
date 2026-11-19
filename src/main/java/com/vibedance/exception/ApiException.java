package com.vibedance.exception;

import org.springframework.http.HttpStatus;

/**
 * Exceção base de negócio. Toda falha previsível da API deve estender esta classe
 * para ser convertida pelo {@link com.vibedance.config.GlobalExceptionHandler}
 * em uma resposta JSON padronizada (nunca uma falha silenciosa).
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String codigo;
    private final transient Object detalhes;

    public ApiException(HttpStatus status, String codigo, String mensagem) {
        this(status, codigo, mensagem, null);
    }

    public ApiException(HttpStatus status, String codigo, String mensagem, Object detalhes) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
        this.detalhes = detalhes;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCodigo() {
        return codigo;
    }

    public Object getDetalhes() {
        return detalhes;
    }
}
