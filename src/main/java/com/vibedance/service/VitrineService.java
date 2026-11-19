package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.model.Modalidade;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.util.AgendaUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Dados públicos da tela inicial: métricas agregadas, turmas abertas e professores.
 * Expõe apenas informação de apresentação — nada de e-mails, CPF ou dados de alunos.
 */
@Service
public class VitrineService {

    private final CatalogoService catalogo;

    public VitrineService(CatalogoService catalogo) {
        this.catalogo = catalogo;
    }

    @Transactional(readOnly = true)
    public Vitrine vitrine() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Turma> ativas = ctx.turmas().values().stream()
            .filter(t -> !Boolean.FALSE.equals(t.getAtivo()))
            .sorted(Comparator.comparing(Turma::getHorario, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

        // "Mais procurada": a turma com maior ocupação (só se tiver alunos)
        Integer maisProcurada = ativas.stream()
            .filter(t -> ctx.ocupadas().getOrDefault(t.getId(), 0) > 0)
            .max(Comparator.comparingDouble(t -> ocupacao(t, ctx)))
            .map(Turma::getId).orElse(null);

        List<VitrineTurma> turmas = ativas.stream().map(t -> {
            int ocupadas = ctx.ocupadas().getOrDefault(t.getId(), 0);
            int vagas = Math.max(0, t.getLimiteVagas() - ocupadas);
            String destaque = t.getId().equals(maisProcurada) ? "Mais procurada"
                : vagas == 0 ? "Lotada"
                : vagas <= 3 ? "Últimas vagas"
                : "INICIANTE".equals(t.getNivel()) ? "Ideal para começar" : null;
            Modalidade m = t.getModalidade();
            var sala = t.getSalaId() == null ? null : ctx.salas().get(t.getSalaId());
            return new VitrineTurma(t.getId(), t.getNomeTurma(), m == null ? null : m.getNome(),
                m == null || m.getIcone() == null ? "fa-music" : m.getIcone(), m == null ? null : m.getCategoria(),
                t.getNivel(), ctx.nomeUsuario(t.getProfessorId()), AgendaUtil.diasComoNumeros(t.getDiasSemana()),
                CatalogoService.hora(t.getHorario()), CatalogoService.hora(t.getHorarioFim()),
                sala == null ? null : sala.getNome(), vagas, t.getLimiteVagas(), ocupadas, destaque);
        }).toList();

        // Todos os professores ativos aparecem — inclusive quem ainda não tem turma na grade
        Map<Integer, List<Turma>> porProfessor = ativas.stream().filter(t -> t.getProfessorId() != null)
            .collect(Collectors.groupingBy(Turma::getProfessorId));
        List<VitrineProfessor> professores = ctx.usuarios().values().stream()
            .filter(u -> "PROFESSOR".equals(u.getPerfil()) && Boolean.TRUE.equals(u.getAtivo()))
            .map(p -> {
                List<Turma> dele = porProfessor.getOrDefault(p.getId(), List.of());
                List<String> modalidades = dele.stream().map(Turma::getModalidade).filter(Objects::nonNull)
                    .map(Modalidade::getNome).distinct().toList();
                return new VitrineProfessor(p.getNome(), p.getAvatarUrl(), modalidades, dele.size());
            })
            .sorted(Comparator.comparing(VitrineProfessor::turmas).reversed().thenComparing(VitrineProfessor::nome))
            .toList();

        long alunos = ctx.usuarios().values().stream()
            .filter(u -> "ALUNO".equals(u.getPerfil()) && Boolean.TRUE.equals(u.getAtivo())).count();
        long modalidades = ativas.stream().map(Turma::getModalidade).filter(Objects::nonNull)
            .map(Modalidade::getId).distinct().count();
        double ocupacaoMedia = ativas.isEmpty() ? 0
            : Math.round(ativas.stream().mapToDouble(t -> ocupacao(t, ctx)).average().orElse(0) * 10) / 10.0;

        return new Vitrine(new VitrineMetricas(alunos, ativas.size(), modalidades, professores.size(), ocupacaoMedia),
            turmas, professores);
    }

    private static double ocupacao(Turma t, CatalogoService.Contexto ctx) {
        if (t.getLimiteVagas() == null || t.getLimiteVagas() == 0) return 0;
        return 100.0 * ctx.ocupadas().getOrDefault(t.getId(), 0) / t.getLimiteVagas();
    }
}
