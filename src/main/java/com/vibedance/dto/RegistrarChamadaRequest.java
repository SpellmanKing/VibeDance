package com.vibedance.dto;

import java.time.LocalDate;
import java.util.List;

public record RegistrarChamadaRequest(
    LocalDate data,
    List<AlunoPresenca> alunos
) {
    public record AlunoPresenca(
        Integer alunoId,
        Boolean presente
    ) {}
}