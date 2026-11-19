package com.vibedance.controller;

import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.model.Sala;
import com.vibedance.repository.TurmaRepository;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.repository.SalaRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/turmas")
public class TurmaController {

    @Autowired
    private TurmaRepository repository;

    @Autowired
    private MatriculaRepository matriculaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private SalaRepository salaRepository;

    @GetMapping
    public ResponseEntity<List<Turma>> listarTodas() {

        List<Turma> turmas = repository.findAll();

        for (Turma turma : turmas) {
            atualizarVagasOcupadas(turma);
            preencherNomes(turma);
        }

        return ResponseEntity.ok(turmas);
    }

    @PostMapping
    public ResponseEntity<Turma> cadastrarTurma(@RequestBody Turma turma) {

        turma.setVagasOcupadas(0);

        Turma salva = repository.save(turma);

        preencherNomes(salva);

        return ResponseEntity.ok(salva);
    }

    @GetMapping("/modalidade/{modalidadeId}")
    public ResponseEntity<List<Turma>> listarPorModalidade(
            @PathVariable Integer modalidadeId) {

        List<Turma> turmas = repository.findByModalidadeId(modalidadeId);

        for (Turma turma : turmas) {
            atualizarVagasOcupadas(turma);
            preencherNomes(turma);
        }

        return ResponseEntity.ok(turmas);
    }

    private void atualizarVagasOcupadas(Turma turma) {

        long ocupadas = matriculaRepository.countByIdTurmaAndStatus(
            turma.getId(), "ATIVA"
        );

        turma.setVagasOcupadas(Math.toIntExact(ocupadas));
    }

    private void preencherNomes(Turma turma) {

        if (turma.getProfessorId() != null) {
            usuarioRepository.findById(turma.getProfessorId())
                    .ifPresent(usuario ->
                            turma.setProfessorNome(usuario.getNome()));
        }

        if (turma.getSalaId() != null) {
            salaRepository.findById(turma.getSalaId())
                    .ifPresent(sala ->
                            turma.setSalaNome(sala.getNome()));
        }
    }
}