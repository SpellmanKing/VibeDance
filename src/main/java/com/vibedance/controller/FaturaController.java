package com.vibedance.controller;

import com.vibedance.model.Fatura;
import com.vibedance.model.Usuario;
import com.vibedance.service.FaturaService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/aluno/faturas")
public class FaturaController {

    private final FaturaService faturaService;

    public FaturaController(FaturaService faturaService) {
        this.faturaService = faturaService;
    }

    @GetMapping 
    public ResponseEntity<List<Fatura>> listarMinhasFaturas(
            @AuthenticationPrincipal Usuario usuario) {

        return ResponseEntity.ok(
            faturaService.listarPorAluno(usuario.getId())
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> buscarMinhaFatura(
            @PathVariable Integer id,
            @AuthenticationPrincipal Usuario usuario) {

        try {
            Fatura fatura = faturaService.buscarPorAluno(
                    id,
                    usuario.getId()
            );

            return ResponseEntity.ok(fatura);

        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}    