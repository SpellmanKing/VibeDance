package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Usuario;
import com.vibedance.service.ProfessorWorkspaceService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Workspace do Professor — performance & didática. */
@RestController
@RequestMapping("/api/professor/workspace")
public class ProfessorWorkspaceController {

    private final ProfessorWorkspaceService service;

    public ProfessorWorkspaceController(ProfessorWorkspaceService service) {
        this.service = service;
    }

    @GetMapping("/hoje")
    public HojeProfessor hoje(@AuthenticationPrincipal Usuario eu) {
        return service.hoje(eu);
    }

    @GetMapping("/turmas")
    public List<TurmaResumo> turmas(@AuthenticationPrincipal Usuario eu) {
        return service.turmas(eu);
    }

    @GetMapping("/turmas/{id}")
    public TurmaProfessorDetalhe turma(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return service.turma(id, eu);
    }

    @GetMapping("/turmas/{id}/chamada")
    public ChamadaResponse chamada(@PathVariable Integer id,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data,
                                   @AuthenticationPrincipal Usuario eu) {
        return service.chamada(id, data, eu);
    }

    @PutMapping("/turmas/{id}/chamada/{alunoId}")
    public ChamadaResponse marcar(@PathVariable Integer id, @PathVariable Integer alunoId,
                                  @RequestBody MarcacaoRequest req, @AuthenticationPrincipal Usuario eu) {
        return service.marcar(id, alunoId, req, eu);
    }

    @PutMapping("/turmas/{id}/chamada")
    public ChamadaResponse lote(@PathVariable Integer id, @RequestBody ChamadaLoteRequest req,
                                @AuthenticationPrincipal Usuario eu) {
        return service.lote(id, req, eu);
    }

    @GetMapping("/turmas/{id}/diario")
    public List<DiarioItem> diario(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return service.diario(id, eu);
    }

    @PutMapping("/turmas/{id}/diario")
    public DiarioItem salvarDiario(@PathVariable Integer id, @RequestBody DiarioForm form, @AuthenticationPrincipal Usuario eu) {
        return service.salvarDiario(id, form, eu);
    }

    @DeleteMapping("/diario/{id}")
    public ResponseEntity<Void> excluirDiario(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        service.excluirDiario(id, eu);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/turmas/{id}/avaliacoes")
    public List<AvaliacaoItem> avaliacoes(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return service.avaliacoes(id, eu);
    }

    @PostMapping("/avaliacoes")
    public ResponseEntity<AvaliacaoItem> avaliar(@RequestBody AvaliacaoForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.avaliar(form, eu));
    }

    @GetMapping("/reposicoes")
    public List<ReposicaoItem> reposicoes(@AuthenticationPrincipal Usuario eu) {
        return service.reposicoes(eu);
    }

    @PostMapping("/reposicoes/{id}/aprovar")
    public ReposicaoItem aprovar(@PathVariable Integer id, @RequestBody(required = false) DecisaoRequest req,
                                 @AuthenticationPrincipal Usuario eu) {
        return service.decidirReposicao(id, true, req, eu);
    }

    @PostMapping("/reposicoes/{id}/recusar")
    public ReposicaoItem recusar(@PathVariable Integer id, @RequestBody DecisaoRequest req, @AuthenticationPrincipal Usuario eu) {
        return service.decidirReposicao(id, false, req, eu);
    }

    @GetMapping("/comunicados")
    public List<ComunicadoItem> comunicados(@AuthenticationPrincipal Usuario eu) {
        return service.comunicados(eu);
    }

    @PostMapping("/comunicados")
    public ResponseEntity<ComunicadoItem> publicar(@RequestBody ComunicadoForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.publicar(form, eu));
    }
}
