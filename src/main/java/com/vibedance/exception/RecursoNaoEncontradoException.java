package com.vibedance.exception;

import org.springframework.http.HttpStatus;

public class RecursoNaoEncontradoException extends ApiException {

    public RecursoNaoEncontradoException(String recurso) {
        super(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", recurso + " não encontrado(a).");
    }
}
