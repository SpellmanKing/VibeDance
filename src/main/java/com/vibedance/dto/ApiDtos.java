package com.vibedance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Contratos (requests/responses) da API v2 do VibeDance, agrupados por domínio.
 * Records imutáveis, serializados diretamente pelo Jackson.
 */
public final class ApiDtos {

    private ApiDtos() {
    }

    // =====================================================================
    // Comuns
    // =====================================================================

    public record UsuarioResumo(Integer id, String nome, String email, String perfil, String telefone,
                                String cpf, Boolean ativo, String avatarUrl, LocalDateTime dataCadastro) {
    }

    public record TurmaResumo(Integer id, String nome, Integer modalidadeId, String modalidadeNome,
                              String modalidadeIcone, String categoria, Integer professorId, String professorNome,
                              Integer salaId, String salaNome, Integer salaCapacidade, String diasSemana,
                              List<Integer> dias, String horarioInicio, String horarioFim, String nivel,
                              Integer limiteVagas, Integer ocupadas, Boolean ativo) {
    }

    public record SalaItem(Integer id, String nome, Integer capacidade, String recursos, Boolean ativo) {
    }

    public record ModalidadeItem(Integer id, String nome, String categoria, String descricao, String icone,
                                 Boolean ativo, long turmas, long alunos) {
    }

    public record NotificacaoItem(Integer id, String titulo, String mensagem, String tipo, String link,
                                  Boolean lida, LocalDateTime criadaEm) {
    }

    public record NotificacoesResponse(long naoLidas, List<NotificacaoItem> itens) {
    }

    public record ComunicadoItem(Integer id, String titulo, String conteudo, String linkAnexo, Boolean urgente,
                                 LocalDateTime dataPostagem, Integer turmaId, String turmaNome, String autorNome,
                                 String autorPerfil, boolean oficial) {
    }

    public record ComunicadoForm(String titulo, String conteudo, String linkAnexo, Boolean urgente, Integer turmaId) {
    }

    public record BuscaItem(String tipo, Integer id, String titulo, String subtitulo, String rota, String icone) {
    }

    public record SeriePonto(String rotulo, BigDecimal valor, BigDecimal previsto) {
    }

    public record Fatia(String rotulo, long valor) {
    }

    // =====================================================================
    // Administrador
    // =====================================================================

    public record OcupacaoTurma(Integer turmaId, String nome, int ocupadas, int limite, double percentual) {
    }

    public record AuditoriaItem(Integer id, LocalDateTime dataHora, String usuarioNome, String perfil, String acao,
                                String entidade, Integer idEntidade, String descricao, String ip, String origem) {
    }

    public record DashboardAdmin(BigDecimal mrr, BigDecimal mrrAnterior, double variacaoMrr,
                                 double inadimplencia, BigDecimal valorEmAberto, double ocupacaoMedia,
                                 double retencao, long alunosAtivos, long professoresAtivos, long turmasAtivas,
                                 long reposicoesPendentes, long comprovantesEmAnalise,
                                 List<SeriePonto> receitaMensal, List<Fatia> distribuicaoModalidades,
                                 List<OcupacaoTurma> ocupacaoTurmas, List<AuditoriaItem> ultimasAcoes) {
    }

    public record MatriculaItem(Integer id, Integer turmaId, String turmaNome, String modalidade, String status,
                                LocalDateTime dataMatricula, String horario) {
    }

    public record UsuarioDetalhe(UsuarioResumo usuario, List<MatriculaItem> matriculas,
                                 List<TurmaResumo> turmasLecionadas, long faturasEmAberto,
                                 double frequencia, List<AuditoriaItem> historico) {
    }

    public record UsuarioForm(String nome, String email, String cpf, String telefone, String perfil, String senha) {
    }

    public record MatriculaLoteRequest(List<Integer> turmas) {
    }

    public record StatusRequest(String status) {
    }

    public record TurmaForm(String nome, Integer modalidadeId, Integer professorId, Integer salaId,
                            List<Integer> dias, String horarioInicio, String horarioFim, String nivel,
                            Integer limiteVagas, Boolean ativo) {
    }

    public record Conflito(String tipo, Integer turmaId, String turmaNome, String diasSemana, String horario,
                           String mensagem) {
    }

    public record GradeHoraria(List<TurmaResumo> turmas, List<SalaItem> salas, List<Conflito> conflitos) {
    }

    public record SalaForm(String nome, Integer capacidade, String recursos, Boolean ativo) {
    }

    public record ModalidadeForm(String nome, String categoria, String descricao, String icone, Boolean ativo) {
    }

    public record PagamentoItem(Integer id, Integer faturaId, String faturaTitulo, Integer alunoId, String alunoNome,
                                String forma, BigDecimal valor, String status, String comprovanteNome,
                                boolean temComprovante, LocalDateTime dataConfirmacao, LocalDateTime criadoEm,
                                String observacao) {
    }

    public record FaturaItem(Integer id, Integer alunoId, String alunoNome, Integer turmaId, String turmaNome,
                             String titulo, String mesReferencia, BigDecimal valor, LocalDate dataVencimento,
                             String status, long diasAtraso, String pixCopiaCola, LocalDateTime criadoEm,
                             BigDecimal valorOriginal, BigDecimal desconto, String motivoDesconto, String observacao,
                             String origem) {
    }

    /** Cobrança individual: condições especiais, recém-chegados e descontos. tipoDesconto = PERCENTUAL | VALOR. */
    public record NovaFaturaRequest(Integer alunoId, Integer turmaId, String mesReferencia, String titulo,
                                    BigDecimal valorOriginal, LocalDate dataVencimento, String tipoDesconto,
                                    BigDecimal desconto, String motivoDesconto, String observacao) {
    }

    /** Ajuste de uma cobrança em aberto: desconto, motivo e (opcional) novo vencimento. */
    public record AjusteFaturaRequest(String tipoDesconto, BigDecimal desconto, String motivoDesconto,
                                      String observacao, LocalDate dataVencimento) {
    }

    public record TurmaCobranca(Integer id, String nome, LocalDate matriculadoEm, List<String> mesesCobrados) {
    }

    public record AlunoCobranca(Integer id, String nome, String email, String avatarUrl, List<TurmaCobranca> turmas) {
    }

    public record ResumoFinanceiro(BigDecimal recebidoMes, BigDecimal emAberto, BigDecimal vencido,
                                   long pagas, long pendentes, long atrasadas, long emAnalise) {
    }

    public record FinanceiroAdmin(ResumoFinanceiro resumo, List<FaturaItem> faturas) {
    }

    public record LoteFaturasRequest(String mesReferencia, LocalDate dataVencimento, BigDecimal valor,
                                     Integer idPacote, List<Integer> alunos) {
    }

    public record LoteResultado(int criadas, int ignoradas, int total, List<String> avisos) {
    }

    public record BaixaRequest(String forma, BigDecimal valor, String observacao) {
    }

    public record DecisaoRequest(String resposta) {
    }

    // =====================================================================
    // Professor
    // =====================================================================

    public record AulaDoDia(TurmaResumo turma, LocalDate data, String inicio, String fim, long confirmados,
                            long reposicoes, long alunosAtivos, boolean chamadaRealizada, long presentes,
                            String situacao) {
    }

    public record DiaAgenda(LocalDate data, List<AulaDoDia> aulas) {
    }

    public record HojeProfessor(LocalDate data, List<AulaDoDia> aulas, AulaDoDia proxima, List<DiaAgenda> semana,
                                long reposicoesPendentes, long alunosTotal, long turmasAtivas,
                                double frequenciaMedia30d) {
    }

    public record ChamadaAluno(Integer alunoId, String nome, String email, String avatarUrl, String tipo,
                               String status, String justificativa, boolean checkin, double frequencia) {
    }

    public record ChamadaResponse(TurmaResumo turma, LocalDate data, boolean diaDeAula, List<ChamadaAluno> alunos,
                                  long presentes, long faltas, long justificados, long pendentes, double taxa) {
    }

    public record MarcacaoRequest(LocalDate data, String status, String justificativa) {
    }

    public record Marcacao(Integer alunoId, String status, String justificativa) {
    }

    public record ChamadaLoteRequest(LocalDate data, List<Marcacao> registros) {
    }

    public record DiarioItem(Integer id, Integer turmaId, String turmaNome, LocalDate data, String conteudo,
                             String coreografia, List<String> links, String observacoes, String professorNome,
                             LocalDateTime atualizadoEm) {
    }

    public record DiarioForm(LocalDate data, String conteudo, String coreografia, List<String> links,
                             String observacoes) {
    }

    public record AvaliacaoItem(Integer id, Integer turmaId, String turmaNome, Integer alunoId, String alunoNome,
                                String professorNome, String coreografia, BigDecimal ritmo, BigDecimal tecnica,
                                BigDecimal expressao, BigDecimal coreografiaNota, BigDecimal media,
                                String feedback, String link, LocalDateTime data) {
    }

    public record AvaliacaoForm(Integer turmaId, Integer alunoId, String coreografiaFoco, BigDecimal notaRitmo,
                                BigDecimal notaTecnica, BigDecimal notaExpressao, BigDecimal notaCoreografia,
                                String feedbackTexto, String linkReferencia) {
    }

    public record ReposicaoItem(Integer id, Integer alunoId, String alunoNome, Integer turmaOrigemId,
                                String turmaOrigemNome, Integer turmaDestinoId, String turmaDestinoNome,
                                LocalDate dataFalta, LocalDate dataAulaDestino, String horario, String tipo,
                                String status, String motivo, String resposta, LocalDateTime solicitadoEm,
                                LocalDateTime avaliadoEm) {
    }

    public record AlunoDaTurma(Integer alunoId, String nome, String email, String avatarUrl, double frequencia,
                               long faltas, BigDecimal ultimaMedia, LocalDateTime ultimaAvaliacao) {
    }

    public record TurmaProfessorDetalhe(TurmaResumo turma, List<AlunoDaTurma> alunos, double frequenciaMedia,
                                        List<String> proximasAulas) {
    }

    // =====================================================================
    // Aluno
    // =====================================================================

    public record FrequenciaTurma(Integer turmaId, String turmaNome, long presentes, long faltas,
                                  long justificadas, long total, double percentual, String alerta) {
    }

    public record AulaAgenda(TurmaResumo turma, LocalDate data, String tipo, boolean checkin, boolean podeCheckin,
                             String presenca, Integer reposicaoId) {
    }

    public record Passaporte(UsuarioResumo usuario, String codigo, String statusMatricula, long turmasAtivas,
                             String situacaoFinanceira, BigDecimal valorEmAberto, FaturaItem proximaFatura,
                             AulaAgenda proximaAula, double frequenciaGeral, List<FrequenciaTurma> frequenciaPorTurma,
                             String alerta, BigDecimal mediaAvaliacoes, long totalAvaliacoes) {
    }

    public record CheckinRequest(Integer turmaId, LocalDate data) {
    }

    public record OpcaoReposicao(TurmaResumo turma, List<LocalDate> datas, int vagas, boolean mesmaModalidade) {
    }

    public record ReposicaoForm(String tipo, Integer turmaOrigemId, LocalDate dataFalta, Integer turmaDestinoId,
                                LocalDate dataAulaDestino, String motivo) {
    }

    public record PresencaItem(Integer id, Integer turmaId, String turmaNome, LocalDate data, String status,
                               String justificativa) {
    }

    public record EvolucaoAluno(List<AvaliacaoItem> avaliacoes, List<DiarioItem> coreografias,
                                List<PresencaItem> presencas, BigDecimal mediaGeral, List<SeriePonto> evolucaoNotas) {
    }

    public record ResumoFinanceiroAluno(BigDecimal emAberto, BigDecimal pagoNoAno, long atrasadas, long emAnalise) {
    }

    public record FinanceiroAluno(ResumoFinanceiroAluno resumo, List<FaturaItem> faturas,
                                  List<PagamentoItem> pagamentos) {
    }

    public record MatriculaRequest(Integer idTurma) {
    }

    /** Tela "Minha conta": dados do próprio usuário com um resumo do seu perfil. */
    public record MeusDados(UsuarioResumo usuario, String codigo, List<TurmaResumo> turmas, long faturasEmAberto,
                            BigDecimal valorEmAberto, long notificacoesNaoLidas) {
    }

    // =====================================================================
    // Cancelamento de matrícula
    // =====================================================================

    /** Situação financeira calculada na hora: base para a decisão do ADM. */
    public record DiagnosticoFinanceiro(boolean adimplente, BigDecimal totalEmAberto, BigDecimal totalAtrasado,
                                        long faturasAtrasadas, long faturasPendentes, long faturasEmAnalise,
                                        List<FaturaItem> abertas) {
    }

    public record SolicitacaoCancelamentoItem(Integer id, Integer alunoId, String alunoNome, String alunoEmail,
                                              String matricula, List<TurmaResumo> turmas, String motivo,
                                              String justificativa, String status, String resposta,
                                              String avaliadoPorNome, LocalDateTime solicitadoEm,
                                              LocalDateTime avaliadoEm, DiagnosticoFinanceiro diagnostico) {
    }

    public record CancelamentoAluno(List<TurmaResumo> turmas, DiagnosticoFinanceiro diagnostico,
                                    SolicitacaoCancelamentoItem pendente,
                                    List<SolicitacaoCancelamentoItem> historico) {
    }

    public record CancelamentoForm(List<Integer> turmas, String motivo, String justificativa) {
    }

    // =====================================================================
    // Checkout e planilha financeira
    // =====================================================================

    public record CheckoutFatura(FaturaItem fatura, BigDecimal valorBase, BigDecimal multa, BigDecimal juros,
                                 BigDecimal desconto, BigDecimal total, long diasAtraso, String pixCopiaCola,
                                 String linhaDigitavel, int parcelasMax, boolean pagavel, String motivoBloqueio) {
    }

    public record PagamentoSimuladoRequest(String forma, Integer parcelas, String cartaoFinal, String bandeira) {
    }

    public record ComprovantePagamento(Integer pagamentoId, String transacao, Integer faturaId, String titulo,
                                       String referencia, String turmaNome, String alunoNome, String forma,
                                       String metodoDetalhe, Integer parcelas, BigDecimal valorBase,
                                       BigDecimal ajuste, BigDecimal total, LocalDateTime pagoEm) {
    }

    /** Linha da planilha financeira: uma por cobrança (ou por estorno), já com o pagamento que a quitou. */
    public record LinhaPlanilha(String transacao, Integer faturaId, Integer pagamentoId, Integer alunoId,
                                String alunoNome, String referencia, String titulo, String turmaNome, String metodo,
                                String metodoDetalhe, LocalDate vencimento, LocalDateTime pagoEm,
                                BigDecimal valorBase, BigDecimal ajuste, BigDecimal valorFinal, String status) {
    }

    // =====================================================================
    // Vitrine pública (home)
    // =====================================================================

    public record VitrineMetricas(long alunos, long turmas, long modalidades, long professores, double ocupacao) {
    }

    public record VitrineTurma(Integer id, String nome, String modalidade, String icone, String categoria, String nivel,
                               String professorNome, List<Integer> dias, String inicio, String fim, String salaNome,
                               int vagas, int limite, int ocupadas, String destaque) {
    }

    public record VitrineProfessor(String nome, String avatarUrl, List<String> modalidades, long turmas) {
    }

    public record Vitrine(VitrineMetricas metricas, List<VitrineTurma> turmas, List<VitrineProfessor> professores) {
    }

    // =====================================================================
    // Pedidos de acesso ("Quero dançar")
    // =====================================================================

    public record PedidoAcessoForm(String nome, String email, String telefone, String cpf, LocalDate dataNascimento,
                                   List<String> modalidades, String experiencia, List<Integer> turmas,
                                   List<String> disponibilidade, String objetivo, String mensagem, String origem,
                                   Boolean consentimento, String site) {
    }

    public record PedidoAcessoRecibo(String protocolo, String primeiroNome, LocalDateTime solicitadoEm) {
    }

    public record ConsultaAcessoRequest(String protocolo, String email) {
    }

    public record AtivacaoAcessoRequest(String protocolo, String email, String senha) {
    }

    public record EtapaAcesso(String chave, String titulo, String descricao, LocalDateTime em, String estado) {
    }

    /** Visão pública do pedido (só com protocolo + e-mail corretos). */
    public record PedidoAcessoPublico(String protocolo, String primeiroNome, String status, LocalDateTime solicitadoEm,
                                      String resposta, String emailInstitucional, boolean ativado, boolean podeAtivar,
                                      boolean conviteExpirado, List<String> turmasInteresse, List<EtapaAcesso> etapas) {
    }

    public record PedidoAcessoItem(Integer id, String protocolo, String nome, String emailContato, String telefone,
                                   String cpf, LocalDate dataNascimento, Integer idade, List<String> modalidades,
                                   String experiencia, List<TurmaResumo> turmasInteresse, List<String> disponibilidade,
                                   String objetivo, String mensagem, String origem, String status, String resposta,
                                   String notaInterna, String emailInstitucional, Integer usuarioId,
                                   String avaliadoPorNome, LocalDateTime solicitadoEm, LocalDateTime atualizadoEm,
                                   LocalDateTime avaliadoEm, LocalDateTime ativadoEm, boolean conviteExpirado,
                                   String sugestaoEmail, List<String> alertas) {
    }

    public record AprovarAcessoRequest(String emailInstitucional, List<Integer> turmas, String mensagem) {
    }

    public record NotaAcessoRequest(String nota) {
    }

    // =====================================================================
    // Agenda completa e frequência do aluno
    // =====================================================================

    public record ResumoFrequencia(long aulas, long presentes, long faltas, long justificadas, double percentualPresenca,
                                   double percentualFaltas, double participacaoPresentes, double participacaoFaltas,
                                   double participacaoJustificadas) {
    }

    public record AulaCalendario(Integer turmaId, String turmaNome, String modalidadeIcone, String horarioInicio,
                                 String horarioFim, String salaNome, String professorNome, String tipo, String status,
                                 String justificativa, boolean checkin) {
    }

    public record DiaCalendario(LocalDate data, List<AulaCalendario> aulas) {
    }

    public record OcorrenciaFrequencia(LocalDate data, Integer turmaId, String turmaNome, String professorNome,
                                       String status, String justificativa) {
    }

    public record FrequenciaAluno(String mes, String mesAnterior, String mesSeguinte, ResumoFrequencia geral,
                                  ResumoFrequencia doMes, int sequenciaPresencas, List<FrequenciaTurma> porTurma,
                                  List<DiaCalendario> dias, List<OcorrenciaFrequencia> ausencias) {
    }
}
