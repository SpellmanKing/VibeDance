package com.vibedance.dto;

public record MaterialProfessorRequest(
    Integer turmaId,
    String titulo,
    String tipo,
    String url,
    String descricao
) {}
