package com.vibedance.controller;

import com.vibedance.dto.MaterialAlunoResponse;
import com.vibedance.model.Matricula;
import com.vibedance.model.MaterialAula;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.MaterialAulaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/aluno/materiais")
public class MaterialAlunoController {

    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;
    private final MaterialAulaRepository materialRepository;

    public MaterialAlunoController(
        MatriculaRepository matriculaRepository,
        TurmaRepository turmaRepository,
        MaterialAulaRepository materialRepository
    ) {
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
        this.materialRepository = materialRepository;
    }

    @GetMapping
    public ResponseEntity<List<MaterialAlunoResponse>> listarMateriais(
        @AuthenticationPrincipal Usuario usuario
    ) {
        List<Matricula> matriculas =
            matriculaRepository.findByIdAlunoAndStatus(
                usuario.getId(), "ATIVA"
            );

        List<Integer> idsTurmas = matriculas.stream()
            .map(Matricula::getIdTurma)
            .distinct()
            .toList();

        if (idsTurmas.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Integer> idsTurmasAtivas = turmaRepository
            .findAllById(idsTurmas)
            .stream()
            .filter(turma -> Boolean.TRUE.equals(turma.getAtivo()))
            .map(Turma::getId)
            .toList();

        if (idsTurmasAtivas.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<MaterialAlunoResponse> materiais = materialRepository
            .findByTurmaIdInOrderByDataPublicacaoDesc(idsTurmasAtivas)
            .stream()
            .map(this::converterParaResponse)
            .toList();

        return ResponseEntity.ok(materiais);
    }

    private MaterialAlunoResponse converterParaResponse(MaterialAula material) {
        return new MaterialAlunoResponse(
            material.getId(),
            material.getTitulo(),
            material.getTipo(),
            material.getDescricao(),
            material.getUrlConteudo(),
            material.getDuracaoMinutos()
        );
    }
}