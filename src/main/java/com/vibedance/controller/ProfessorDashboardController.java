package com.vibedance.controller;

import com.vibedance.dto.DashboardProfessorResponse;
import com.vibedance.model.Presenca;
import com.vibedance.model.Sala;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.model.Matricula;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.PresencaRepository;
import com.vibedance.repository.SalaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api/professor/dashboard")
public class ProfessorDashboardController {

    private final TurmaRepository turmaRepository;
    private final MatriculaRepository matriculaRepository;
    private final PresencaRepository presencaRepository;
    private final SalaRepository salaRepository;

    public ProfessorDashboardController(
        TurmaRepository turmaRepository,
        MatriculaRepository matriculaRepository,
        PresencaRepository presencaRepository,
        SalaRepository salaRepository
    ) {
        this.turmaRepository = turmaRepository;
        this.matriculaRepository = matriculaRepository;
        this.presencaRepository = presencaRepository;
        this.salaRepository = salaRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<DashboardProfessorResponse> buscarDashboard(
        @AuthenticationPrincipal Usuario usuario
    ) {
        if (usuario == null || !"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Turma> turmas =
            turmaRepository.findByProfessorIdAndAtivoTrue(usuario.getId());

        List<Integer> idsTurmas = new ArrayList<>();

        for (Turma turma : turmas) {
            idsTurmas.add(turma.getId());
        }

        Set<Integer> alunosUnicos = new HashSet<>();

        if (!idsTurmas.isEmpty()) {
            List<Matricula> matriculasAtivas =
                matriculaRepository.findByIdTurmaInAndStatus(
                    idsTurmas, "ATIVA"
                );

            for (Matricula matricula : matriculasAtivas) {
                alunosUnicos.add(matricula.getIdAluno());
            }
        }

        long totalAlunos = alunosUnicos.size();

        double presencaMedia = calcularPresencaMedia(idsTurmas);

        ProximaAula proximaAula = buscarProximaTurma(turmas);

        Turma proximaTurma = proximaAula != null
            ? proximaAula.turma()
            : null;

        String proximaAulaHorario = "Sem aula";
        String proximaAulaData = "";
        String proximaAulaDetalhe = "Nenhuma aula futura encontrada";

        if (proximaTurma != null) {
            proximaAulaHorario = proximaTurma.getHorario()
                .format(DateTimeFormatter.ofPattern("HH:mm"));
            proximaAulaData = proximaAula.dataHora()
                .toLocalDate()
                .toString();

            String salaNome = "Sala não informada";

            if (proximaTurma.getSalaId() != null) {
                salaNome = salaRepository.findById(proximaTurma.getSalaId())
                    .map(Sala::getNome)
                    .orElse("Sala não informada");
            }

            String modalidade = "Modalidade não informada";

            if (proximaTurma.getModalidade() != null) {
                modalidade = proximaTurma.getModalidade().getNome();
            }

            proximaAulaDetalhe = proximaTurma.getNomeTurma()
                + " • " + salaNome
                + " • " + modalidade;
        }

        DashboardProfessorResponse resposta =
            new DashboardProfessorResponse(
                totalAlunos,
                presencaMedia,
                proximaAulaHorario,
                proximaAulaData,
                proximaAulaDetalhe
            );

        return ResponseEntity.ok(resposta);
    }

    private double calcularPresencaMedia(List<Integer> idsTurmas) {
        if (idsTurmas.isEmpty()) {
            return 0.0;
        }

        List<Presenca> presencas =
            presencaRepository.findByTurmaIdIn(idsTurmas);

        if (presencas.isEmpty()) {
            return 0.0;
        }

        long presentes = 0;

        for (Presenca presenca : presencas) {
            if (Boolean.TRUE.equals(presenca.getPresente())) {
                presentes++;
            }
        }

        double percentual = (presentes * 100.0) / presencas.size();

        return Math.round(percentual * 10.0) / 10.0;
    }

    private ProximaAula buscarProximaTurma(List<Turma> turmas) {
        ZoneId zona = ZoneId.of("America/Sao_Paulo");

        LocalDateTime agora = LocalDateTime.now(zona);
        LocalDate hoje = LocalDate.now(zona);

        ProximaAula proximaAula = null;

        for (Turma turma : turmas) {
            if (turma.getDiasSemana() == null || turma.getHorario() == null) {
                continue;
            }

            for (int i = 0; i <= 7; i++) {
                LocalDate data = hoje.plusDays(i);

                if (!diaDaSemanaCadastrado(turma.getDiasSemana(), data.getDayOfWeek())) {
                    continue;
                }

                LocalDateTime horarioAula = data.atTime(turma.getHorario());

                if (horarioAula.isBefore(agora)) {
                    continue;
                }

                if (proximaAula == null ||
                    horarioAula.isBefore(proximaAula.dataHora())) {

                    proximaAula = new ProximaAula(turma, horarioAula);
                }
            }
        }

        return proximaAula;
    }

    private record ProximaAula(Turma turma, LocalDateTime dataHora) {
    }

    private boolean diaDaSemanaCadastrado(String dias, DayOfWeek dia) {
        String texto = Normalizer.normalize(
            dias, Normalizer.Form.NFD
        ).replaceAll("\\p{M}", "").toLowerCase();

        return switch (dia) {
            case MONDAY -> texto.contains("segunda");
            case TUESDAY -> texto.contains("terca");
            case WEDNESDAY -> texto.contains("quarta");
            case THURSDAY -> texto.contains("quinta");
            case FRIDAY -> texto.contains("sexta");
            case SATURDAY -> texto.contains("sabado");
            case SUNDAY -> texto.contains("domingo");
        };
    }
}