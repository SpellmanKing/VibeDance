package com.vibedance.dto;

import java.time.LocalDateTime;

public record ComunicadoResponse(
    Integer id,
    Integer turmaId,
    String titulo,
    String conteudo,
    String link,
    Boolean urgente,
    String professorNome,
    LocalDateTime data
) {}