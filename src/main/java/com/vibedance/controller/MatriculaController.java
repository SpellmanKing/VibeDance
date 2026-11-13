package com.vibedance.controller;

import com.vibedance.model.Matricula;
import com.vibedance.model.Usuario;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.service.MatriculaService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/aluno/matriculas")
public class MatriculaController {

    private final MatriculaRepository repository;
    private final MatriculaService matriculaService;

    public MatriculaController(
        MatriculaRepository repository,
        MatriculaService matriculaService) {

        this.repository = repository;
        this.matriculaService = matriculaService;
    }

    @GetMapping
    public ResponseEntity<List<Matricula>> listarMinhasMatriculas(
        @AuthenticationPrincipal Usuario usuario) {

            List<Matricula> matriculas = repository.findByIdAluno(usuario.getId());

            return ResponseEntity.ok(matriculas);

    }

    @PostMapping
    public ResponseEntity<?> realizarMatricula(
        @AuthenticationPrincipal Usuario usuario,
        @RequestBody DadosNovaMatricula dados) {

            try {
                Matricula matricula = matriculaService.matricular(
                    usuario.getId(),
                    dados.idTurma()
                );

                return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(matricula);

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

    @PatchMapping("/{idMatricula}/cancelar")
    public ResponseEntity<?> cancelarMatricula(
        @AuthenticationPrincipal Usuario usuario,
        @PathVariable Integer idMatricula) {

        try {
            Matricula matricula = matriculaService.cancelar(
                usuario.getId(),
                idMatricula
            );

            return ResponseEntity.ok(matricula);

        } catch (IllegalArgumentException erro) {

            return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(Map.of("erro", erro.getMessage()));

        } catch (IllegalStateException erro) {

            return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(Map.of("erro", erro.getMessage()));
        }
    }

    public record DadosNovaMatricula(Integer idTurma) {
    }
}