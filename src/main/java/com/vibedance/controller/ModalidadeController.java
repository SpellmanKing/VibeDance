package com.vibedance.controller;

import com.vibedance.model.Modalidade;
import com.vibedance.repository.ModalidadeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/modalidades")
@CrossOrigin(origins = "*") // Permite requisições do frontend
public class ModalidadeController {

    @Autowired
    private ModalidadeRepository repository;

    // Endpoint para o Aluno consultar modalidades (US02)
    @GetMapping
    public ResponseEntity<List<Modalidade>> listarModalidades() {
        List<Modalidade> modalidades = repository.findByStatusTrue();
        return ResponseEntity.ok(modalidades);
    }

    // Endpoint para o Administrador cadastrar novas modalidades (US12)
    @PostMapping
    public ResponseEntity<Modalidade> cadastrarModalidade(@RequestBody Modalidade modalidade) {
        modalidade.setStatus(true);
        Modalidade salva = repository.save(modalidade);
        return ResponseEntity.ok(salva);
    }
}