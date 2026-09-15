package com.vibedance.controller;

import com.vibedance.model.Turma;
import com.vibedance.repository.TurmaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/turmas")
@CrossOrigin(origins = "*") // Permite requisições do frontend
public class TurmaController {

    @Autowired
    private TurmaRepository repository;

    // Rota para listar todas as turmas (US14)
    @GetMapping
    public ResponseEntity<List<Turma>> listarTodas() {
        List<Turma> turmas = repository.findAll();
        return ResponseEntity.ok(turmas);
    }

    // Rota para cadastrar uma nova turma (US14)
    @PostMapping
    public ResponseEntity<Turma> cadastrarTurma(@RequestBody Turma turma) {
        // Ao criar uma turma nova, garantimos que ela comece com 0 vagas ocupadas
        turma.setVagasOcupadas(0);

        Turma salva = repository.save(turma);
        return ResponseEntity.ok(salva);
    }

    // Rota extra para listar turmas de uma modalidade específica (US03)
    @GetMapping("/modalidade/{modalidadeId}")
    public ResponseEntity<List<Turma>> listarPorModalidade(@PathVariable Long modalidadeId) {
        List<Turma> turmas = repository.findByModalidadeId(modalidadeId);
        return ResponseEntity.ok(turmas);
    }
}