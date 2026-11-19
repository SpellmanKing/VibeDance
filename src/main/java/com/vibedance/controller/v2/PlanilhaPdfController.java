package com.vibedance.controller.v2;

import com.vibedance.model.Usuario;
import com.vibedance.service.CheckoutService;
import com.vibedance.service.PlanilhaPdfService;
import com.vibedance.service.PlanilhaPdfService.Filtros;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/** Exportação da planilha financeira em PDF, com os mesmos filtros da tela. */
@RestController
public class PlanilhaPdfController {

    private final CheckoutService checkout;
    private final PlanilhaPdfService pdf;

    public PlanilhaPdfController(CheckoutService checkout, PlanilhaPdfService pdf) {
        this.checkout = checkout;
        this.pdf = pdf;
    }

    @GetMapping("/api/admin/financeiro/planilha/pdf")
    public ResponseEntity<byte[]> admin(@AuthenticationPrincipal Usuario eu,
                                        @RequestParam(required = false) String status, @RequestParam(required = false) String de,
                                        @RequestParam(required = false) String ate, @RequestParam(required = false) String busca) {
        Filtros f = new Filtros(status, de, ate, busca);
        byte[] corpo = pdf.gerar(PlanilhaPdfService.filtrar(checkout.planilhaGeral(), f), f, true, eu.getNome(), null);
        return arquivo(corpo, "relatorio-financeiro-vibedance-" + LocalDate.now() + ".pdf");
    }

    @GetMapping("/api/aluno/portal/financeiro/planilha/pdf")
    public ResponseEntity<byte[]> aluno(@AuthenticationPrincipal Usuario eu,
                                        @RequestParam(required = false) String status, @RequestParam(required = false) String de,
                                        @RequestParam(required = false) String ate, @RequestParam(required = false) String busca) {
        Filtros f = new Filtros(status, de, ate, busca);
        byte[] corpo = pdf.gerar(PlanilhaPdfService.filtrar(checkout.planilhaDoAluno(eu), f), f, false, null, eu.getNome());
        return arquivo(corpo, "extrato-financeiro-vibedance-" + LocalDate.now() + ".pdf");
    }

    private static ResponseEntity<byte[]> arquivo(byte[] corpo, String nome) {
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(nome, StandardCharsets.UTF_8).build().toString())
            .body(corpo);
    }
}
