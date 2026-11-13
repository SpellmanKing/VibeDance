package com.vibedance.controller;

import com.vibedance.dto.RegistrarChamadaRequest;
import com.vibedance.dto.AlunoChamadaResponse;
import com.vibedance.model.Presenca;
import com.vibedance.model.Usuario;
import com.vibedance.model.Turma;
import com.vibedance.model.Matricula;
import com.vibedance.repository.PresencaRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.TurmaRepository;
import com.vibedance.repository.UsuarioRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/professor/presencas")
public class ProfessorPresencaController {

    private final PresencaRepository presencaRepository;
    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;
    private final UsuarioRepository usuarioRepository;

    public ProfessorPresencaController(
        PresencaRepository presencaRepository,
        MatriculaRepository matriculaRepository,
        TurmaRepository turmaRepository,
        UsuarioRepository usuarioRepository
    ) {
        this.presencaRepository = presencaRepository;
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @GetMapping("/turmas")
    public ResponseEntity<?> listarTurmas(
        @AuthenticationPrincipal Usuario usuario
    ) {
        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas professores.");
        }

        List<Turma> turmas = turmaRepository
            .findByProfessorIdAndAtivoTrue(usuario.getId());

        return ResponseEntity.ok(turmas);
    }

    @GetMapping("/{turmaId}")
    public ResponseEntity<?> listarAlunos(
        @PathVariable Integer turmaId,
        @RequestParam LocalDate data,
        @AuthenticationPrincipal Usuario usuario
    ) {
        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas professores.");
        }

        Turma turma = turmaRepository.findById(turmaId).orElse(null);

        if (turma == null) {
            return ResponseEntity.notFound().build();
        }

        if (!usuario.getId().equals(turma.getProfessorId())) {
            return ResponseEntity.status(403).body("Turma não pertence a você.");
        }

        List<Matricula> matriculas = matriculaRepository
            .findByIdTurmaAndStatus(turmaId, "ATIVA");

        List<Integer> ids = matriculas.stream()
            .map(Matricula::getIdAluno)
            .toList();

        Map<Integer, Boolean> presencas = presencaRepository
            .findByTurmaIdAndDataAula(turmaId, data)
            .stream()
            .collect(Collectors.toMap(
                p -> p.getAluno().getId(),
                Presenca::getPresente,
                (a, b) -> b
            ));

        List<Usuario> alunos = usuarioRepository.findAllById(ids);

        List<AlunoChamadaResponse> resposta = alunos.stream()
            .map(aluno -> new AlunoChamadaResponse(
                aluno.getId(),
                aluno.getNome(),
                aluno.getEmail(),
                presencas.get(aluno.getId())
            ))
            .toList();

        return ResponseEntity.ok(resposta);
    }

    @PostMapping("/{turmaId}")
    @Transactional
    public ResponseEntity<?> registrarChamada(
        @PathVariable Integer turmaId,
        @RequestBody RegistrarChamadaRequest request,
        @AuthenticationPrincipal Usuario usuario
    ) {
        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403)
                .body("Apenas professores podem registrar chamadas.");
        }

        if (request == null || request.data() == null
            || request.alunos() == null || request.alunos().isEmpty()) {
            return ResponseEntity.badRequest()
                .body("Informe a data e os alunos da chamada.");
        }

        Turma turma = turmaRepository.findById(turmaId).orElse(null);

        if (turma == null) {
            return ResponseEntity.notFound().build();
        }

        if (!usuario.getId().equals(turma.getProfessorId())) {
            return ResponseEntity.status(403)
                .body("Você não é o professor responsável por esta turma.");
        }

        Set<Integer> alunosProcessados = new HashSet<>();

        for (RegistrarChamadaRequest.AlunoPresenca alunoRequest : request.alunos()) {
            if (alunoRequest.alunoId() == null
                || alunoRequest.presente() == null
                || !alunosProcessados.add(alunoRequest.alunoId())) {
                return ResponseEntity.badRequest()
                    .body("A lista contém dados inválidos ou alunos repetidos.");
            }

            boolean matriculaAtiva = matriculaRepository
                .findByIdAlunoAndIdTurma(alunoRequest.alunoId(), turmaId)
                .filter(m -> "ATIVA".equalsIgnoreCase(m.getStatus()))
                .isPresent();

            if (!matriculaAtiva
                || !usuarioRepository.existsById(alunoRequest.alunoId())) {
                return ResponseEntity.badRequest()
                    .body("Aluno sem matrícula ativa nesta turma.");
            }
        }

        for (RegistrarChamadaRequest.AlunoPresenca alunoRequest : request.alunos()) {
            Presenca presenca = presencaRepository
                .findByTurmaIdAndAlunoIdAndDataAula(
                    turmaId, alunoRequest.alunoId(), request.data()
                )
                .orElseGet(Presenca::new);

            presenca.setTurma(turma);

            Usuario aluno = usuarioRepository
                .findById(alunoRequest.alunoId())
                .orElseThrow();

            presenca.setAluno(aluno);
            presenca.setDataAula(request.data());
            presenca.setPresente(alunoRequest.presente());

            presencaRepository.save(presenca);
        }

        return ResponseEntity.ok("Chamada registrada com sucesso.");
    }
}