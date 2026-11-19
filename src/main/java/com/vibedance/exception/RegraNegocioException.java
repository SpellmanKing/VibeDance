package com.vibedance.exception;

import org.springframework.http.HttpStatus;

public class RegraNegocioException extends ApiException {

    public RegraNegocioException(String mensagem) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, "REGRA_DE_NEGOCIO", mensagem);
    }

    public RegraNegocioException(String codigo, String mensagem) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, codigo, mensagem);
    }
}
