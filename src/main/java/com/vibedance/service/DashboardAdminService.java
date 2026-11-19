package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Fatura;
import com.vibedance.model.Matricula;
import com.vibedance.model.Turma;
import com.vibedance.repository.*;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Stream;

/** KPIs executivos e consulta do log de auditoria do Cockpit ADM. */
@Service
@Transactional(readOnly = true)
public class DashboardAdminService {

    private static final String[] MES_CURTO = {"Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"};

    private final FaturaRepository faturaRepository;
    private final MatriculaRepository matriculaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ReposicaoRepository reposicaoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final AuditoriaGeralRepository auditoriaGeralRepository;
    private final AuditoriaPagamentoRepository auditoriaPagamentoRepository;
    private final CatalogoService catalogo;

    public DashboardAdminService(FaturaRepository faturaRepository, MatriculaRepository matriculaRepository,
                                 UsuarioRepository usuarioRepository, ReposicaoRepository reposicaoRepository,
                                 PagamentoRepository pagamentoRepository, AuditoriaGeralRepository auditoriaGeralRepository,
                                 AuditoriaPagamentoRepository auditoriaPagamentoRepository, CatalogoService catalogo) {
        this.faturaRepository = faturaRepository;
        this.matriculaRepository = matriculaRepository;
        this.usuarioRepository = usuarioRepository;
        this.reposicaoRepository = reposicaoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.auditoriaGeralRepository = auditoriaGeralRepository;
        this.auditoriaPagamentoRepository = auditoriaPagamentoRepository;
        this.catalogo = catalogo;
    }

    public DashboardAdmin dashboard() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        LocalDate hoje = AgendaUtil.hoje();
        YearMonth mesAtual = YearMonth.from(hoje);
        List<Fatura> faturas = faturaRepository.findAll().stream()
            .filter(f -> !"CANCELADO".equals(f.getStatus())).toList();

        // Receita Mensal Recorrente (faturado no mês) e variação
        BigDecimal mrr = somar(faturas.stream().filter(f -> mesAtual.toString().equals(f.getMesReferencia())));
        BigDecimal mrrAnterior = somar(faturas.stream()
            .filter(f -> mesAtual.minusMonths(1).toString().equals(f.getMesReferencia())));
        double variacao = mrrAnterior.signum() == 0 ? 0
            : mrr.subtract(mrrAnterior).multiply(BigDecimal.valueOf(100))
                .divide(mrrAnterior, 1, RoundingMode.HALF_UP).doubleValue();

        // Inadimplência: vencidas / cobranças já vencíveis
        long venciveis = faturas.stream().filter(f -> !f.getDataVencimento().isAfter(hoje)).count();
        long vencidas = faturas.stream().filter(f -> "VENCIDO".equals(f.getStatus())).count();
        BigDecimal emAberto = somar(faturas.stream()
            .filter(f -> Set.of("PENDENTE", "VENCIDO", "EM_ANALISE").contains(f.getStatus())));

        // Ocupação das turmas ativas
        List<Turma> ativas = ctx.turmas().values().stream().filter(t -> !Boolean.FALSE.equals(t.getAtivo())).toList();
        long somaOcupadas = 0, somaLimite = 0;
        List<OcupacaoTurma> ocupacao = new ArrayList<>();
        for (Turma t : ativas) {
            int ocupadas = ctx.ocupadas().getOrDefault(t.getId(), 0);
            somaOcupadas += ocupadas;
            somaLimite += t.getLimiteVagas();
            ocupacao.add(new OcupacaoTurma(t.getId(), t.getNomeTurma(), ocupadas, t.getLimiteVagas(),
                CatalogoService.percentual(ocupadas, t.getLimiteVagas())));
        }
        ocupacao.sort(Comparator.comparingDouble(OcupacaoTurma::percentual).reversed());

        // Retenção: alunos com matrícula ativa / alunos que já se matricularam
        List<Matricula> matriculas = matriculaRepository.findAll();
        Set<Integer> comHistorico = new HashSet<>(), ativosSet = new HashSet<>();
        for (Matricula m : matriculas) {
            comHistorico.add(m.getIdAluno());
            if ("ATIVA".equals(m.getStatus())) ativosSet.add(m.getIdAluno());
        }

        // Séries: receita (confirmada x faturada) nos últimos 6 meses
        List<SeriePonto> serie = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            YearMonth ym = mesAtual.minusMonths(i);
            String chave = ym.toString();
            BigDecimal faturado = somar(faturas.stream().filter(f -> chave.equals(f.getMesReferencia())));
            BigDecimal recebido = somar(faturas.stream()
                .filter(f -> chave.equals(f.getMesReferencia()) && "CONFIRMADO".equals(f.getStatus())));
            serie.add(new SeriePonto(MES_CURTO[ym.getMonthValue() - 1] + "/" + String.valueOf(ym.getYear()).substring(2),
                recebido, faturado));
        }

        // Distribuição de alunos ativos por modalidade
        Map<String, Long> porModalidade = new TreeMap<>();
        for (Matricula m : matriculas) {
            if (!"ATIVA".equals(m.getStatus())) continue;
            Turma t = ctx.turmas().get(m.getIdTurma());
            String nome = t == null || t.getModalidade() == null ? "Outras" : t.getModalidade().getNome();
            porModalidade.merge(nome, 1L, Long::sum);
        }
        List<Fatia> distribuicao = porModalidade.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .map(e -> new Fatia(e.getKey(), e.getValue())).toList();

        return new DashboardAdmin(mrr, mrrAnterior, variacao,
            CatalogoService.percentual(vencidas, venciveis), emAberto,
            CatalogoService.percentual(somaOcupadas, somaLimite),
            CatalogoService.percentual(ativosSet.size(), comHistorico.size()),
            usuarioRepository.countByPerfilAndAtivoTrue("ALUNO"),
            usuarioRepository.countByPerfilAndAtivoTrue("PROFESSOR"),
            ativas.size(),
            reposicaoRepository.countByStatus("SOLICITADA"),
            pagamentoRepository.findByStatusOrderByCriadoEmDesc("EM_ANALISE").size(),
            serie, distribuicao, ocupacao, auditoria(null, null, null, 8));
    }

    /** Log unificado (ações gerais + trilha financeira), mais recente primeiro. */
    public List<AuditoriaItem> auditoria(String entidade, String acao, String busca, int limite) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        String termo = busca == null ? "" : busca.trim().toLowerCase();
        Stream<AuditoriaItem> gerais = auditoriaGeralRepository.findTop1000ByOrderByDataHoraDesc().stream()
            .map(catalogo::auditoria);
        Stream<AuditoriaItem> financeiras = auditoriaPagamentoRepository.findTop300ByOrderByDataHoraDesc().stream()
            .map(a -> catalogo.auditoria(a, ctx));
        return Stream.concat(gerais, financeiras)
            .filter(a -> entidade == null || entidade.isBlank() || entidade.equalsIgnoreCase(a.entidade()))
            .filter(a -> acao == null || acao.isBlank() || acao.equalsIgnoreCase(a.acao()))
            .filter(a -> termo.isEmpty()
                || (a.descricao() != null && a.descricao().toLowerCase().contains(termo))
                || (a.usuarioNome() != null && a.usuarioNome().toLowerCase().contains(termo)))
            .sorted(Comparator.comparing(AuditoriaItem::dataHora, Comparator.nullsFirst(Comparator.<LocalDateTime>naturalOrder())).reversed())
            .limit(Math.max(1, Math.min(limite, 1000)))
            .toList();
    }

    private static BigDecimal somar(Stream<Fatura> faturas) {
        return faturas.map(Fatura::getValor).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
