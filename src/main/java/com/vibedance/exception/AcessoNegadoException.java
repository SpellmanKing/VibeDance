package com.vibedance.exception;

import org.springframework.http.HttpStatus;

public class AcessoNegadoException extends ApiException {

    public static final String MSG_DOMINIO =
        "Acesso bloqueado: o VibeDance aceita exclusivamente contas institucionais @vibedance.com.";

    public AcessoNegadoException(String mensagem) {
        super(HttpStatus.FORBIDDEN, "ACESSO_NEGADO", mensagem);
    }

    public AcessoNegadoException(String codigo, String mensagem) {
        super(HttpStatus.FORBIDDEN, codigo, mensagem);
    }

    public static AcessoNegadoException dominio() {
        return new AcessoNegadoException("DOMINIO_NAO_AUTORIZADO", MSG_DOMINIO);
    }
}
