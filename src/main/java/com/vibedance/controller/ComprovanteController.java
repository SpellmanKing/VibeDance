package com.vibedance.controller;

import com.vibedance.model.Pagamento;
import com.vibedance.model.Usuario;
import com.vibedance.service.PagamentoService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;

import java.util.Map;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/aluno/comprovantes")
public class ComprovanteController {

    private final PagamentoService pagamentoService;

    public ComprovanteController(PagamentoService pagamentoService) {
        this.pagamentoService = pagamentoService;
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> enviarComprovante(

            @RequestParam("idFatura") Integer idFatura,
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "observacao", required = false)
            String observacao,

            @AuthenticationPrincipal Usuario usuario,

            jakarta.servlet.http.HttpServletRequest requisicao) {

        try {

            Pagamento pagamento = pagamentoService.enviarComprovante(
                    idFatura, 
                    usuario.getId(), 
                    observacao, 
                    requisicao.getRemoteAddr(), 
                    arquivo
            );

            return ResponseEntity.status(201).body(
                    Map.of(
                            "mensagem", "Comprovante enviado para análise.",
                            "idPagamento", pagamento.getId(),
                            "status", pagamento.getStatus()
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest().body(
                    Map.of("erro", e.getMessage())
            );

        } catch (java.util.NoSuchElementException e) {

            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/pagamento/{idPagamento}")
    public ResponseEntity<?> visualizarComprovante(
            @PathVariable Integer idPagamento,
            @AuthenticationPrincipal Usuario usuario) {

        try {
            Path caminho = pagamentoService.localizarComprovante(
                    idPagamento,
                    usuario.getId()
            );

            Resource arquivo = new UrlResource(caminho.toUri());

            String tipo = Files.probeContentType(caminho);

            if (tipo == null) {
                tipo = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(tipo))
                    .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename(caminho.getFileName().toString())
                                .build()
                                .toString()
                    )
                    .body(arquivo);

        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();

        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}