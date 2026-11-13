package com.vibedance.controller;

import com.vibedance.repository.UsuarioRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/aluno/professores")
public class ProfessorConsultaController {

    private final UsuarioRepository repository;

    public ProfessorConsultaController(UsuarioRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<DadosProfessor>> listarProfessores() {

        List<DadosProfessor> professores = repository
                .findByPerfilAndAtivoTrueOrderByNomeAsc("PROFESSOR")
                .stream()
                .map(usuario -> new DadosProfessor(
                        usuario.getId(),
                        usuario.getNome()
                ))
                .toList();

        return ResponseEntity.ok(professores);
    } 

    public record DadosProfessor(
            Integer id,
            String nome
    ) {
    }
}