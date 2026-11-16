package com.vibedance.dto;

import java.time.LocalDate;

public record PresencaAlunoResponse(
    Integer id,
    Integer idTurma,
    LocalDate data,
    Boolean presente,
    String turmaNome,
    String professorNome,
    String horario
) {
}