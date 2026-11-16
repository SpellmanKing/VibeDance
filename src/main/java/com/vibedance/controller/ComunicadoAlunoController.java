package com.vibedance.controller;

import com.vibedance.dto.ComunicadoResponse;
import com.vibedance.model.Matricula;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.ComunicadoRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/aluno/comunicados")
public class ComunicadoAlunoController {

    private final ComunicadoRepository comunicadoRepository;
    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;

    public ComunicadoAlunoController(
        ComunicadoRepository comunicadoRepository,
        MatriculaRepository matriculaRepository,
        TurmaRepository turmaRepository
    ) {
        this.comunicadoRepository = comunicadoRepository;
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
    }

    @GetMapping
    public ResponseEntity<?> listarComunicados(
        @AuthenticationPrincipal Usuario usuario
    ) {

        if (!"ALUNO".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas alunos podem consultar comunicados.");
        }

        List<Integer> idsTurmasMatriculadas = matriculaRepository
            .findByIdAlunoAndStatus(usuario.getId(), "ATIVA")
            .stream()
            .map(Matricula::getIdTurma)
            .distinct()
            .toList();

        if (idsTurmasMatriculadas.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Integer> idsTurmasAtivas = turmaRepository
            .findAllById(idsTurmasMatriculadas)
            .stream()
            .filter(turma -> Boolean.TRUE.equals(turma.getAtivo()))
            .map(Turma::getId)
            .toList();

        if (idsTurmasAtivas.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<ComunicadoResponse> comunicados = comunicadoRepository
            .findByTurmaIdInOrderByDataPostagemDesc(idsTurmasAtivas)
            .stream()
            .map(c -> new ComunicadoResponse(
                c.getId(),
                c.getTurma().getId(),
                c.getTitulo(),
                c.getConteudo(),
                c.getLinkAnexo(),
                c.getUrgente(),
                c.getProfessor().getNome(),
                c.getDataPostagem()
            ))
            .toList();

        return ResponseEntity.ok(comunicados);
    }
}