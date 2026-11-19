package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.Vitrine;
import com.vibedance.service.VitrineService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** Endpoint público (sem login) que alimenta a tela inicial. */
@RestController
@RequestMapping("/api/publico")
public class VitrineController {

    private final VitrineService service;
    private final com.vibedance.service.AvatarService avatares;

    public VitrineController(VitrineService service, com.vibedance.service.AvatarService avatares) {
        this.service = service;
        this.avatares = avatares;
    }

    /** Fotos de perfil (nome aleatório, só leitura). */
    @GetMapping("/avatars/{nome}")
    public ResponseEntity<org.springframework.core.io.Resource> avatar(@org.springframework.web.bind.annotation.PathVariable String nome) {
        java.nio.file.Path p = avatares.localizar(nome);
        return ResponseEntity.ok()
            .contentType(org.springframework.http.MediaType.parseMediaType(com.vibedance.service.AvatarService.tipo(nome)))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
            .header("X-Content-Type-Options", "nosniff")
            .body(new org.springframework.core.io.FileSystemResource(p));
    }

    @GetMapping("/vitrine")
    public ResponseEntity<Vitrine> vitrine() {
        // Sem cache: a home consulta periodicamente e precisa ver turmas/professores novos na hora
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.vitrine());
    }
}
