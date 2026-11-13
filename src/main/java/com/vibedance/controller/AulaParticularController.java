package com.vibedance.controller;

import com.vibedance.model.AulaParticular;
import com.vibedance.model.Usuario;
import com.vibedance.repository.AulaParticularRepository;
import com.vibedance.service.AulaParticularService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/aluno/aulas-particulares")
public class AulaParticularController {

    private final AulaParticularRepository repository;
    private final AulaParticularService service;

    public AulaParticularController(
            AulaParticularRepository repository,
            AulaParticularService service) {

        this.repository = repository;
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<AulaParticular>> listarMinhasAulas(
            @AuthenticationPrincipal Usuario usuario) {

        List<AulaParticular> aulas = repository.findByIdAluno(usuario.getId());

        return ResponseEntity.ok(aulas);
    }

    @PostMapping
    public ResponseEntity<?> solicitarAula(
            @AuthenticationPrincipal Usuario usuario,
            @RequestBody DadosSolicitacao dados) {

        try {
            AulaParticular aula = service.solicitar(
                    usuario.getId(),
                    dados.idModalidade(),
                    dados.idProfessor(),
                    dados.dataHora(),
                    dados.duracaoMinutos(),
                    dados.observacoes()
            );

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(aula);

        } catch (IllegalArgumentException erro) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of("erro", erro.getMessage()));

        } catch (IllegalStateException erro) {

            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(Map.of("erro", erro.getMessage()));
        }       
    }

    public record DadosSolicitacao(
            Integer idModalidade,
            Integer idProfessor,
            LocalDateTime dataHora,
            Integer duracaoMinutos,
            String observacoes
    ) {
    }
}