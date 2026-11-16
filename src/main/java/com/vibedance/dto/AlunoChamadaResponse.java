package com.vibedance.dto;

import java.time.LocalDateTime;

public record AlunoChamadaResponse(
    Integer id,
    String nome,
    String email,
    String telefone,
    LocalDateTime dataMatricula,
    Boolean presente
) {}