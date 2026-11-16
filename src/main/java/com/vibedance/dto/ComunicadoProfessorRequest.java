package com.vibedance.dto;

public record ComunicadoProfessorRequest(
    Integer turmaId,
    String titulo,
    String conteudo,
    String link,
    Boolean urgente
) {}