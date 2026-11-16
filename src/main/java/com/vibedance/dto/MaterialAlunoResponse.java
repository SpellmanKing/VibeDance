package com.vibedance.dto;

public record MaterialAlunoResponse(
    Integer id,
    String titulo,
    String tipo,
    String descricao,
    String url,
    Integer duracaoMinutos
) {}