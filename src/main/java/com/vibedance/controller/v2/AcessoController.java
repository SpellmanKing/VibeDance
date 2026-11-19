package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Usuario;
import com.vibedance.service.AcessoService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Pedidos de acesso. Rotas públicas (sem login) em /api/publico/acesso para enviar,
 * acompanhar e ativar; rotas do ADM em /api/admin/acessos para analisar e decidir.
 */
@RestController
public class AcessoController {

    private final AcessoService service;

    public AcessoController(AcessoService service) {
        this.service = service;
    }

    // ------------------------------------------------------------ público

    @PostMapping("/api/publico/acesso/pedidos")
    public ResponseEntity<PedidoAcessoRecibo> solicitar(@RequestBody PedidoAcessoForm form) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(service.solicitar(form));
    }

    @PostMapping("/api/publico/acesso/consulta")
    public ResponseEntity<PedidoAcessoPublico> consultar(@RequestBody ConsultaAcessoRequest req) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.consultar(req));
    }

    @PostMapping("/api/publico/acesso/ativacao")
    public ResponseEntity<PedidoAcessoPublico> ativar(@RequestBody AtivacaoAcessoRequest req) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.ativar(req));
    }

    // ------------------------------------------------------------ ADM

    @GetMapping("/api/admin/acessos")
    public List<PedidoAcessoItem> listar() {
        return service.listar();
    }

    @GetMapping("/api/admin/acessos/pendentes")
    public Map<String, Long> pendentes() {
        return Map.of("total", service.pendentes());
    }

    @GetMapping("/api/admin/acessos/{id}")
    public PedidoAcessoItem detalhe(@PathVariable Integer id) {
        return service.detalhe(id);
    }

    @PostMapping("/api/admin/acessos/{id}/contato")
    public PedidoAcessoItem contato(@PathVariable Integer id, @RequestBody(required = false) NotaAcessoRequest req,
                                    @AuthenticationPrincipal Usuario eu) {
        return service.marcarContato(id, req, eu);
    }

    @PutMapping("/api/admin/acessos/{id}/nota")
    public PedidoAcessoItem nota(@PathVariable Integer id, @RequestBody NotaAcessoRequest req) {
        return service.salvarNota(id, req);
    }

    @PostMapping("/api/admin/acessos/{id}/aprovar")
    public PedidoAcessoItem aprovar(@PathVariable Integer id, @RequestBody AprovarAcessoRequest req,
                                    @AuthenticationPrincipal Usuario eu) {
        return service.aprovar(id, req, eu);
    }

    @PostMapping("/api/admin/acessos/{id}/recusar")
    public PedidoAcessoItem recusar(@PathVariable Integer id, @RequestBody DecisaoRequest req,
                                    @AuthenticationPrincipal Usuario eu) {
        return service.recusar(id, req, eu);
    }

    @PostMapping("/api/admin/acessos/{id}/renovar-convite")
    public PedidoAcessoItem renovar(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return service.renovarConvite(id, eu);
    }
}
