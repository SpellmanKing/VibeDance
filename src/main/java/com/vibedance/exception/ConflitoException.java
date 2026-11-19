package com.vibedance.exception;

import org.springframework.http.HttpStatus;

public class ConflitoException extends ApiException {

    public ConflitoException(String codigo, String mensagem) {
        super(HttpStatus.CONFLICT, codigo, mensagem);
    }

    public ConflitoException(String codigo, String mensagem, Object detalhes) {
        super(HttpStatus.CONFLICT, codigo, mensagem, detalhes);
    }
}
