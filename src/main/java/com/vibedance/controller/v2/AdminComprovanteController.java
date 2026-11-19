package com.vibedance.controller.v2;

import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.model.Pagamento;
import com.vibedance.repository.PagamentoRepository;
import com.vibedance.service.PagamentoService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Permite ao ADM abrir o arquivo de comprovante enviado pelo aluno antes de aprovar. */
@RestController
public class AdminComprovanteController {

    private final PagamentoRepository pagamentoRepository;
    private final PagamentoService pagamentoService;

    public AdminComprovanteController(PagamentoRepository pagamentoRepository, PagamentoService pagamentoService) {
        this.pagamentoRepository = pagamentoRepository;
        this.pagamentoService = pagamentoService;
    }

    @GetMapping("/api/admin/financeiro/pagamentos/{id}/comprovante")
    public ResponseEntity<Resource> comprovante(@PathVariable Integer id) throws IOException {
        Pagamento p = pagamentoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Pagamento"));
        Path caminho = pagamentoService.localizarComprovante(p.getId(), p.getIdAluno());
        String tipo = Files.probeContentType(caminho);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(tipo == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : tipo))
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.inline().filename(caminho.getFileName().toString()).build().toString())
            .body(new UrlResource(caminho.toUri()));
    }
}
