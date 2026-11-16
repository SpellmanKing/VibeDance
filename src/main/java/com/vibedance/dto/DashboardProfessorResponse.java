package com.vibedance.dto;

public record DashboardProfessorResponse(
    long totalAlunos,
    double presencaMedia,
    String proximaAulaHorario,
    String proximaAulaData,
    String proximaAulaDetalhe
) {
}