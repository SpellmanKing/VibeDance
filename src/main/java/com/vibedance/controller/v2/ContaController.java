package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Usuario;
import com.vibedance.service.ContaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Endpoints comuns a todos os perfis autenticados. */
@RestController
@RequestMapping("/api")
public class ContaController {

    private final ContaService service;
    private final com.vibedance.service.AvatarService avatares;

    public ContaController(ContaService service, com.vibedance.service.AvatarService avatares) {
        this.service = service;
        this.avatares = avatares;
    }

    @GetMapping("/me/dados")
    public MeusDados meusDados(@AuthenticationPrincipal Usuario eu) {
        return service.meusDados(eu);
    }

    @PostMapping(value = "/me/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public UsuarioResumo enviarFoto(@RequestParam("arquivo") org.springframework.web.multipart.MultipartFile arquivo,
                                    @AuthenticationPrincipal Usuario eu) {
        return avatares.salvar(eu, arquivo);
    }

    @DeleteMapping("/me/avatar")
    public UsuarioResumo removerFoto(@AuthenticationPrincipal Usuario eu) {
        return avatares.remover(eu);
    }

    public record PerfilRequest(String telefone, String avatarUrl) {
    }

    public record SenhaRequest(String senhaAtual, String novaSenha) {
    }

    @GetMapping("/me")
    public UsuarioResumo eu(@AuthenticationPrincipal Usuario eu) {
        return service.eu(eu);
    }

    @PatchMapping("/me")
    public UsuarioResumo atualizar(@RequestBody PerfilRequest req, @AuthenticationPrincipal Usuario eu) {
        return service.atualizarPerfil(eu, req.telefone(), req.avatarUrl());
    }

    @PostMapping("/me/senha")
    public ResponseEntity<Void> senha(@RequestBody SenhaRequest req, @AuthenticationPrincipal Usuario eu) {
        service.trocarSenha(eu, req.senhaAtual(), req.novaSenha());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/notificacoes")
    public NotificacoesResponse notificacoes(@AuthenticationPrincipal Usuario eu) {
        return service.notificacoes(eu);
    }

    @PostMapping("/notificacoes/{id}/lida")
    public ResponseEntity<Void> lida(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        service.marcarLida(eu, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/notificacoes/lidas")
    public Map<String, Integer> todasLidas(@AuthenticationPrincipal Usuario eu) {
        return Map.of("atualizadas", service.marcarTodas(eu));
    }

    @GetMapping("/busca")
    public List<BuscaItem> busca(@RequestParam String q, @AuthenticationPrincipal Usuario eu) {
        return service.buscar(eu, q);
    }
}
