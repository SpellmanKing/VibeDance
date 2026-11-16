package com.vibedance.controller;

import com.vibedance.dto.MaterialProfessorRequest;
import com.vibedance.model.MaterialAula;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.MaterialAulaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/professor/materiais")
public class MaterialProfessorController {

    private final MaterialAulaRepository materialRepository;
    private final TurmaRepository turmaRepository;

    public MaterialProfessorController(
        MaterialAulaRepository materialRepository,
        TurmaRepository turmaRepository
    ) {
        this.materialRepository = materialRepository;
        this.turmaRepository = turmaRepository;
    }

    @PostMapping
    public ResponseEntity<?> cadastrarMaterial(
        @RequestBody MaterialProfessorRequest request,
        @AuthenticationPrincipal Usuario usuario
    ) {

        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas professores podem publicar materiais.");
        }

        if (request.turmaId() == null
            || request.titulo() == null
            || request.titulo().isBlank()
            || request.url() == null
            || request.url().isBlank()
            || request.tipo() == null) {
            return ResponseEntity.badRequest().body("Preencha os dados obrigatórios do material.");
        }

        if (request.titulo().length() > 150 || request.url().length() > 255) {
            return ResponseEntity.badRequest().body("Título ou link ultrapassa o limite permitido.");
        }

        if (!request.tipo().matches("PLAYLIST|VIDEO_COREOGRAFIA|DOCUMENTO_PDF|LINK_EXTERNO")) {
            return ResponseEntity.badRequest().body("Tipo de material inválido.");
        }

        Turma turma = turmaRepository.findById(request.turmaId()).orElse(null);

        if (turma == null || !Boolean.TRUE.equals(turma.getAtivo())) {
            return ResponseEntity.badRequest().body("Turma não encontrada ou inativa.");
        }

        if (!usuario.getId().equals(turma.getProfessorId())) {
            return ResponseEntity.status(403).body("Esta turma não pertence a você.");
        }

        MaterialAula material = new MaterialAula();
        material.setTurma(turma);
        material.setModalidade(turma.getModalidade());
        material.setProfessor(usuario);
        material.setTitulo(request.titulo().trim());
        material.setTipo(request.tipo());
        material.setUrlConteudo(request.url().trim());
        material.setDescricao(request.descricao());

        MaterialAula salvo = materialRepository.save(material);

        return ResponseEntity.ok(salvo.getId());
    }
}
