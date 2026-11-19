package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Usuario;
import com.vibedance.service.AlunoPortalService;
import com.vibedance.service.CancelamentoService;
import com.vibedance.service.CheckoutService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Portal do Aluno — experiência imersiva & autonomia. */
@RestController
@RequestMapping("/api/aluno/portal")
public class AlunoPortalController {

    private final AlunoPortalService service;
    private final CancelamentoService cancelamentos;
    private final CheckoutService checkout;

    public AlunoPortalController(AlunoPortalService service, CancelamentoService cancelamentos, CheckoutService checkout) {
        this.service = service;
        this.cancelamentos = cancelamentos;
        this.checkout = checkout;
    }

    // ------------------------------------------------------------ cancelamento de matrícula

    @GetMapping("/cancelamento")
    public CancelamentoAluno cancelamento(@AuthenticationPrincipal Usuario eu) {
        return cancelamentos.doAluno(eu);
    }

    @PostMapping("/cancelamento")
    public ResponseEntity<CancelamentoAluno> solicitarCancelamento(@RequestBody CancelamentoForm form,
                                                                   @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cancelamentos.solicitar(eu, form));
    }

    // ------------------------------------------------------------ checkout e planilha

    @GetMapping("/faturas/{id}/checkout")
    public CheckoutFatura checkout(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return checkout.checkout(eu, id);
    }

    @PostMapping("/faturas/{id}/pagar")
    public ComprovantePagamento pagar(@PathVariable Integer id, @RequestBody PagamentoSimuladoRequest req,
                                      @AuthenticationPrincipal Usuario eu) {
        return checkout.pagar(eu, id, req);
    }

    @GetMapping("/pagamentos/{id}/comprovante")
    public ComprovantePagamento comprovante(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return checkout.comprovanteDoAluno(eu, id);
    }

    @GetMapping("/financeiro/planilha")
    public List<LinhaPlanilha> planilha(@AuthenticationPrincipal Usuario eu) {
        return checkout.planilhaDoAluno(eu);
    }

    @GetMapping("/passaporte")
    public Passaporte passaporte(@AuthenticationPrincipal Usuario eu) {
        return service.passaporte(eu);
    }

    @GetMapping("/agenda")
    public List<AulaAgenda> agenda(@AuthenticationPrincipal Usuario eu) {
        return service.agenda(eu);
    }

    @PostMapping("/checkin")
    public List<AulaAgenda> checkin(@RequestBody CheckinRequest req, @AuthenticationPrincipal Usuario eu) {
        return service.checkin(eu, req);
    }

    @PostMapping("/checkin/desfazer")
    public List<AulaAgenda> desfazerCheckin(@RequestBody CheckinRequest req, @AuthenticationPrincipal Usuario eu) {
        return service.desfazerCheckin(eu, req);
    }

    @GetMapping("/turmas")
    public List<TurmaResumo> minhasTurmas(@AuthenticationPrincipal Usuario eu) {
        return service.minhasTurmas(eu);
    }

    @GetMapping("/catalogo")
    public List<TurmaResumo> catalogo(@AuthenticationPrincipal Usuario eu) {
        return service.catalogoTurmas(eu);
    }

    @PostMapping("/matriculas")
    public ResponseEntity<List<TurmaResumo>> matricular(@RequestBody MatriculaRequest req, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.matricular(eu, req));
    }

    @GetMapping("/reposicoes")
    public List<ReposicaoItem> reposicoes(@AuthenticationPrincipal Usuario eu) {
        return service.reposicoes(eu);
    }

    @GetMapping("/reposicoes/opcoes")
    public List<OpcaoReposicao> opcoes(@RequestParam(defaultValue = "REPOSICAO") String tipo,
                                       @RequestParam(required = false) Integer turmaOrigem,
                                       @AuthenticationPrincipal Usuario eu) {
        return service.opcoes(eu, tipo, turmaOrigem);
    }

    @PostMapping("/reposicoes")
    public ResponseEntity<ReposicaoItem> solicitar(@RequestBody ReposicaoForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.solicitar(eu, form));
    }

    @PostMapping("/reposicoes/{id}/cancelar")
    public ReposicaoItem cancelar(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return service.cancelarReposicao(eu, id);
    }

    @GetMapping("/evolucao")
    public EvolucaoAluno evolucao(@AuthenticationPrincipal Usuario eu) {
        return service.evolucao(eu);
    }

    @GetMapping("/frequencia")
    public FrequenciaAluno frequencia(@AuthenticationPrincipal Usuario eu, @RequestParam(required = false) String mes) {
        return service.frequencia(eu, mes);
    }

    @GetMapping("/avisos")
    public List<ComunicadoItem> avisos(@AuthenticationPrincipal Usuario eu) {
        return service.avisos(eu);
    }

    @GetMapping("/financeiro")
    public FinanceiroAluno financeiro(@AuthenticationPrincipal Usuario eu) {
        return service.financeiro(eu);
    }
}
