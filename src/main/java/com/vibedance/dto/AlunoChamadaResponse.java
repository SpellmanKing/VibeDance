package com.vibedance.dto;

public record AlunoChamadaResponse(
    Integer id,
    String nome,
    String email,
    Boolean presente
) {}