package com.vibedance.controller.v2;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Usuario;
import com.vibedance.service.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Cockpit do Administrador — inteligência e controle total (RBAC: ADMINISTRADOR). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final DashboardAdminService dashboard;
    private final UsuarioAdminService usuarios;
    private final GradeHorariaService grade;
    private final FinanceiroAdminService financeiro;
    private final ProfessorWorkspaceService workspace;
    private final CancelamentoService cancelamentos;
    private final CheckoutService checkout;

    public AdminController(DashboardAdminService dashboard, UsuarioAdminService usuarios, GradeHorariaService grade,
                           FinanceiroAdminService financeiro, ProfessorWorkspaceService workspace,
                           CancelamentoService cancelamentos, CheckoutService checkout) {
        this.dashboard = dashboard;
        this.usuarios = usuarios;
        this.grade = grade;
        this.financeiro = financeiro;
        this.workspace = workspace;
        this.cancelamentos = cancelamentos;
        this.checkout = checkout;
    }

    // ------------------------------------------------------------ cancelamentos de matrícula

    @GetMapping("/cancelamentos")
    public List<SolicitacaoCancelamentoItem> cancelamentos(@RequestParam(required = false) String status) {
        return cancelamentos.listar(status);
    }

    @GetMapping("/cancelamentos/{id}")
    public SolicitacaoCancelamentoItem cancelamento(@PathVariable Integer id) {
        return cancelamentos.detalhe(id);
    }

    @PostMapping("/cancelamentos/{id}/aprovar")
    public SolicitacaoCancelamentoItem aprovarCancelamento(@PathVariable Integer id,
                                                           @RequestBody(required = false) DecisaoRequest req,
                                                           @AuthenticationPrincipal Usuario eu) {
        return cancelamentos.aprovar(id, req, eu);
    }

    @PostMapping("/cancelamentos/{id}/recusar")
    public SolicitacaoCancelamentoItem recusarCancelamento(@PathVariable Integer id, @RequestBody DecisaoRequest req,
                                                           @AuthenticationPrincipal Usuario eu) {
        return cancelamentos.recusar(id, req, eu);
    }

    @GetMapping("/financeiro/planilha")
    public List<LinhaPlanilha> planilha() {
        return checkout.planilhaGeral();
    }

    @GetMapping("/financeiro/pagamentos/{id}/recibo")
    public ResponseEntity<byte[]> recibo(@PathVariable Integer id) {
        return ResponseEntity.ok()
            .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
            .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                org.springframework.http.ContentDisposition.attachment()
                    .filename("comprovante-vibedance-" + id + ".pdf", java.nio.charset.StandardCharsets.UTF_8).build().toString())
            .body(checkout.reciboAdmin(id));
    }

    // ------------------------------------------------------------ dashboard

    @GetMapping("/dashboard")
    public DashboardAdmin dashboard() {
        return dashboard.dashboard();
    }

    @GetMapping("/auditoria")
    public List<AuditoriaItem> auditoria(@RequestParam(required = false) String entidade,
                                         @RequestParam(required = false) String acao,
                                         @RequestParam(required = false) String busca,
                                         @RequestParam(defaultValue = "300") int limite) {
        return dashboard.auditoria(entidade, acao, busca, limite);
    }

    // ------------------------------------------------------------ usuários

    @GetMapping("/usuarios")
    public List<UsuarioResumo> usuarios(@RequestParam(required = false) String perfil,
                                        @RequestParam(required = false) String status,
                                        @RequestParam(required = false) String busca) {
        return usuarios.listar(perfil, status, busca);
    }

    @GetMapping("/usuarios/{id}")
    public UsuarioDetalhe usuario(@PathVariable Integer id) {
        return usuarios.detalhe(id);
    }

    @PostMapping("/usuarios")
    public ResponseEntity<UsuarioResumo> criarUsuario(@RequestBody UsuarioForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(usuarios.criar(form, eu));
    }

    @PutMapping("/usuarios/{id}")
    public UsuarioResumo atualizarUsuario(@PathVariable Integer id, @RequestBody UsuarioForm form,
                                          @AuthenticationPrincipal Usuario eu) {
        return usuarios.atualizar(id, form, eu);
    }

    @PatchMapping("/usuarios/{id}/suspender")
    public UsuarioResumo suspender(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return usuarios.alterarStatus(id, false, eu);
    }

    @PatchMapping("/usuarios/{id}/reativar")
    public UsuarioResumo reativar(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return usuarios.alterarStatus(id, true, eu);
    }

    @DeleteMapping("/usuarios/{id}")
    public ResponseEntity<Void> excluirUsuario(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        usuarios.excluir(id, eu);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/usuarios/{id}/matriculas")
    public List<MatriculaItem> matricular(@PathVariable Integer id, @RequestBody MatriculaLoteRequest req,
                                          @AuthenticationPrincipal Usuario eu) {
        return usuarios.vincularMatriculas(id, req, eu);
    }

    @PatchMapping("/matriculas/{id}")
    public MatriculaItem statusMatricula(@PathVariable Integer id, @RequestBody StatusRequest req,
                                         @AuthenticationPrincipal Usuario eu) {
        return usuarios.alterarStatusMatricula(id, req.status(), eu);
    }

    // ------------------------------------------------------------ grade / turmas

    @GetMapping("/grade")
    public GradeHoraria grade() {
        return grade.grade();
    }

    @GetMapping("/turmas")
    public List<TurmaResumo> turmas(@RequestParam(defaultValue = "false") boolean inativas) {
        return grade.listarTurmas(inativas);
    }

    @PostMapping("/turmas/validar")
    public Map<String, Object> validarTurma(@RequestBody TurmaForm form, @RequestParam(required = false) Integer ignorar) {
        List<Conflito> conflitos = grade.validar(form, ignorar);
        return Map.of("valido", conflitos.isEmpty(), "conflitos", conflitos);
    }

    @PostMapping("/turmas")
    public ResponseEntity<TurmaResumo> criarTurma(@RequestBody TurmaForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(grade.salvarTurma(null, form, eu));
    }

    @PutMapping("/turmas/{id}")
    public TurmaResumo atualizarTurma(@PathVariable Integer id, @RequestBody TurmaForm form,
                                      @AuthenticationPrincipal Usuario eu) {
        return grade.salvarTurma(id, form, eu);
    }

    @DeleteMapping("/turmas/{id}")
    public ResponseEntity<Void> encerrarTurma(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        grade.encerrarTurma(id, eu);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/turmas/{id}/detalhe")
    public TurmaProfessorDetalhe detalheTurma(@PathVariable Integer id, @AuthenticationPrincipal Usuario eu) {
        return workspace.turma(id, eu);
    }

    @GetMapping("/salas")
    public List<SalaItem> salas() {
        return grade.salas();
    }

    @PostMapping("/salas")
    public SalaItem criarSala(@RequestBody SalaForm form, @AuthenticationPrincipal Usuario eu) {
        return grade.salvarSala(null, form, eu);
    }

    @PutMapping("/salas/{id}")
    public SalaItem atualizarSala(@PathVariable Integer id, @RequestBody SalaForm form, @AuthenticationPrincipal Usuario eu) {
        return grade.salvarSala(id, form, eu);
    }

    @GetMapping("/modalidades")
    public List<ModalidadeItem> modalidades() {
        return grade.modalidades();
    }

    @PostMapping("/modalidades")
    public ModalidadeItem criarModalidade(@RequestBody ModalidadeForm form, @AuthenticationPrincipal Usuario eu) {
        return grade.salvarModalidade(null, form, eu);
    }

    @PutMapping("/modalidades/{id}")
    public ModalidadeItem atualizarModalidade(@PathVariable Integer id, @RequestBody ModalidadeForm form,
                                              @AuthenticationPrincipal Usuario eu) {
        return grade.salvarModalidade(id, form, eu);
    }

    // ------------------------------------------------------------ financeiro

    @GetMapping("/financeiro")
    public FinanceiroAdmin financeiro(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) String mes,
                                      @RequestParam(required = false) String busca) {
        return financeiro.painel(status, mes, busca);
    }

    @GetMapping("/financeiro/transacoes")
    public List<PagamentoItem> transacoes(@RequestParam(required = false) String status) {
        return financeiro.transacoes(status);
    }

    @GetMapping("/financeiro/faturas/{id}/pagamentos")
    public List<PagamentoItem> pagamentosDaFatura(@PathVariable Integer id) {
        return financeiro.pagamentosDaFatura(id);
    }

    @PostMapping("/financeiro/lote")
    public LoteResultado lote(@RequestBody LoteFaturasRequest req, @AuthenticationPrincipal Usuario eu) {
        return financeiro.gerarLote(req, eu);
    }

    @GetMapping("/financeiro/alunos-cobranca")
    public List<AlunoCobranca> alunosCobranca() {
        return financeiro.alunosParaCobranca();
    }

    @PostMapping("/financeiro/faturas")
    public FaturaItem novaFatura(@RequestBody NovaFaturaRequest req, @AuthenticationPrincipal Usuario eu) {
        return financeiro.criarIndividual(req, eu);
    }

    @PutMapping("/financeiro/faturas/{id}/ajuste")
    public FaturaItem ajustarFatura(@PathVariable Integer id, @RequestBody AjusteFaturaRequest req,
                                    @AuthenticationPrincipal Usuario eu) {
        return financeiro.ajustar(id, req, eu);
    }

    @PostMapping("/financeiro/faturas/{id}/baixa")
    public FaturaItem baixa(@PathVariable Integer id, @RequestBody(required = false) BaixaRequest req,
                            @AuthenticationPrincipal Usuario eu) {
        return financeiro.baixaRapida(id, req, eu);
    }

    @PostMapping("/financeiro/faturas/{id}/cancelar")
    public FaturaItem cancelarFatura(@PathVariable Integer id, @RequestBody(required = false) DecisaoRequest req,
                                     @AuthenticationPrincipal Usuario eu) {
        return financeiro.cancelar(id, req, eu);
    }

    @PostMapping("/financeiro/pagamentos/{id}/aprovar")
    public PagamentoItem aprovarComprovante(@PathVariable Integer id, @RequestBody(required = false) DecisaoRequest req,
                                            @AuthenticationPrincipal Usuario eu) {
        return financeiro.decidirComprovante(id, true, req, eu);
    }

    @PostMapping("/financeiro/pagamentos/{id}/recusar")
    public PagamentoItem recusarComprovante(@PathVariable Integer id, @RequestBody DecisaoRequest req,
                                            @AuthenticationPrincipal Usuario eu) {
        return financeiro.decidirComprovante(id, false, req, eu);
    }

    @PostMapping("/financeiro/atualizar-vencidas")
    public Map<String, Integer> atualizarVencidas() {
        return Map.of("atualizadas", financeiro.atualizarVencidas());
    }

    // ------------------------------------------------------------ comunicados / reposições

    @GetMapping("/comunicados")
    public List<ComunicadoItem> comunicados(@AuthenticationPrincipal Usuario eu) {
        return workspace.comunicados(eu);
    }

    @PostMapping("/comunicados")
    public ResponseEntity<ComunicadoItem> publicar(@RequestBody ComunicadoForm form, @AuthenticationPrincipal Usuario eu) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspace.publicar(form, eu));
    }

    @GetMapping("/reposicoes")
    public List<ReposicaoItem> reposicoes(@AuthenticationPrincipal Usuario eu) {
        return workspace.reposicoes(eu);
    }
}
