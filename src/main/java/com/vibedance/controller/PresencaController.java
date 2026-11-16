package com.vibedance.controller;

import com.vibedance.dto.PresencaAlunoResponse;
import com.vibedance.dto.AulasResumoResponse;
import com.vibedance.model.Presenca;
import com.vibedance.model.Usuario;
import com.vibedance.model.Matricula;
import com.vibedance.model.Turma;
import com.vibedance.repository.PresencaRepository;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.text.Normalizer;
import java.time.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/aluno/presencas")
public class PresencaController {

    private final PresencaRepository presencaRepository;
    private final UsuarioRepository usuarioRepository;
    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;

    public PresencaController(
        PresencaRepository presencaRepository,
        UsuarioRepository usuarioRepository,
        MatriculaRepository matriculaRepository,
        TurmaRepository turmaRepository
    ) {
        this.presencaRepository = presencaRepository;
        this.usuarioRepository = usuarioRepository;
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
    }

    @GetMapping
    public ResponseEntity<List<PresencaAlunoResponse>> listarMinhasPresencas(
        @AuthenticationPrincipal Usuario usuario
    ) {
        List<Presenca> presencas =
            presencaRepository.findByAlunoIdOrderByDataAulaDesc(usuario.getId());

        List<PresencaAlunoResponse> resposta = new ArrayList<>();

        for (Presenca presenca : presencas) {

            String nomeTurma = presenca.getTurma().getNomeTurma();

            if (nomeTurma == null || nomeTurma.isBlank()) {
                nomeTurma = presenca.getTurma()
                    .getModalidade().getNome();
            }

            Integer professorId = presenca.getTurma().getProfessorId();

            String professorNome = "Instrutor";

            if (professorId != null) {
                professorNome = usuarioRepository.findById(professorId)
                    .map(Usuario::getNome)
                    .orElse("Instrutor");
            }

            String horario = presenca.getTurma().getHorario() != null
                ? presenca.getTurma().getHorario().toString()
                : "A definir";

            resposta.add(new PresencaAlunoResponse(
                presenca.getId(),
                presenca.getTurma().getId(),
                presenca.getDataAula(),
                presenca.getPresente(),
                nomeTurma,
                professorNome,
                horario
            ));
        }

        return ResponseEntity.ok(resposta);
    }

    @GetMapping("/resumo")
    public ResponseEntity<AulasResumoResponse> buscarResumoMensal(
        @AuthenticationPrincipal Usuario usuario
    ) {
        YearMonth mesAtual = YearMonth.now(
            ZoneId.of("America/Sao_Paulo")
        );

        LocalDate primeiroDia = mesAtual.atDay(1);
        LocalDate ultimoDia = mesAtual.atEndOfMonth();

        int aulasConcluidas = 0;

        List<Presenca> presencas =
            presencaRepository.findByAlunoIdOrderByDataAulaDesc(usuario.getId());

        for (Presenca presenca : presencas) {
            LocalDate data = presenca.getDataAula();

            if (Boolean.TRUE.equals(presenca.getPresente())
                && !data.isBefore(primeiroDia)
                && !data.isAfter(ultimoDia)) {
                aulasConcluidas++;
            }
        }

        int metaMensal = 0;

        List<Matricula> matriculas =
            matriculaRepository.findByIdAluno(usuario.getId());

        for (Matricula matricula : matriculas) {

            if (!"ATIVA".equalsIgnoreCase(matricula.getStatus())) {
                continue;
            }

            Turma turma = turmaRepository
                .findById(matricula.getIdTurma())
                .orElse(null);

            if (turma == null || !Boolean.TRUE.equals(turma.getAtivo())) {
                continue;
            }

            LocalDate inicio = primeiroDia;

            if (matricula.getDataMatricula() != null) {
                LocalDate dataMatricula =
                    matricula.getDataMatricula().toLocalDate();

                if (dataMatricula.isAfter(inicio)) {
                    inicio = dataMatricula;
                }
            }

            for (LocalDate data = inicio;
                 !data.isAfter(ultimoDia);
                 data = data.plusDays(1)) {

                if (diaDaSemanaCorresponde(
                    turma.getDiasSemana(),
                    data.getDayOfWeek()
                )) {
                    metaMensal++;
                }
            }
        }

        return ResponseEntity.ok(
            new AulasResumoResponse(
                aulasConcluidas,
                metaMensal,
                mesAtual.toString()
            )
        );
    }

    private boolean diaDaSemanaCorresponde(
        String diasSemana,
        DayOfWeek dia
    ) {
        if (diasSemana == null) {
            return false;
        }

        String dias = Normalizer.normalize(
            diasSemana,
            Normalizer.Form.NFD
        )
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT);

        switch (dia) {
            case MONDAY:
                return dias.contains("segunda");
            case TUESDAY:
                return dias.contains("terca");
            case WEDNESDAY:
                return dias.contains("quarta");
            case THURSDAY:
                return dias.contains("quinta");
            case FRIDAY:
                return dias.contains("sexta");
            case SATURDAY:
                return dias.contains("sabado");
            case SUNDAY:
                return dias.contains("domingo");
            default:
                return false;
        }
    }
}