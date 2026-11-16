package com.vibedance.controller;

import com.vibedance.dto.ComunicadoProfessorRequest;
import com.vibedance.dto.ComunicadoResponse;
import com.vibedance.model.Comunicado;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.ComunicadoRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/professor/comunicados")
public class ComunicadoProfessorController {

    private final ComunicadoRepository comunicadoRepository;
    private final TurmaRepository turmaRepository;

    public ComunicadoProfessorController(
        ComunicadoRepository comunicadoRepository,
        TurmaRepository turmaRepository
    ) {
        this.comunicadoRepository = comunicadoRepository;
        this.turmaRepository = turmaRepository;
    }

    @PostMapping
    public ResponseEntity<?> cadastrarComunicado(
        @RequestBody ComunicadoProfessorRequest request,
        @AuthenticationPrincipal Usuario usuario
    ) {

        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas professores podem publicar comunicados.");
        }

        if (request.turmaId() == null
            || request.titulo() == null
            || request.titulo().isBlank()
            || request.conteudo() == null
            || request.conteudo().isBlank()) {
            return ResponseEntity.badRequest().body("Preencha os campos obrigatórios.");
        }

        if (request.titulo().length() > 150
            || (request.link() != null && request.link().length() > 255)) {
            return ResponseEntity.badRequest().body("Título ou link ultrapassa o limite permitido.");
        }

        Turma turma = turmaRepository.findById(request.turmaId()).orElse(null);

        if (turma == null || !Boolean.TRUE.equals(turma.getAtivo())) {
            return ResponseEntity.badRequest().body("Turma não encontrada ou inativa.");
        }

        if (!usuario.getId().equals(turma.getProfessorId())) {
            return ResponseEntity.status(403).body("Esta turma não pertence a você.");
        }

        Comunicado comunicado = new Comunicado();
        comunicado.setTurma(turma);
        comunicado.setProfessor(usuario);
        comunicado.setTitulo(request.titulo().trim());
        comunicado.setConteudo(request.conteudo().trim());
        comunicado.setLinkAnexo(
            request.link() == null || request.link().isBlank()
                ? null
                : request.link().trim()
        );
        comunicado.setUrgente(Boolean.TRUE.equals(request.urgente()));

        Comunicado salvo = comunicadoRepository.save(comunicado);

        return ResponseEntity.ok(salvo.getId());
    }

    @GetMapping
    public ResponseEntity<?> listarComunicados(
        @AuthenticationPrincipal Usuario usuario
    ) {

        if (!"PROFESSOR".equalsIgnoreCase(usuario.getPerfil())) {
            return ResponseEntity.status(403).body("Apenas professores podem consultar estes comunicados.");
        }

        List<ComunicadoResponse> comunicados =
            comunicadoRepository
                .findByProfessorIdOrderByDataPostagemDesc(usuario.getId())
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