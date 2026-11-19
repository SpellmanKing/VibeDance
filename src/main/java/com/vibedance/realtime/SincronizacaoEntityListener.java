package com.vibedance.realtime;

import com.vibedance.model.*;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Listener JPA registrado em todas as entidades: qualquer CRUD — de qualquer perfil
 * ou endpoint — gera uma {@link MudancaDominio}. O {@link RealtimeHub} entrega o
 * evento via SSE somente após o COMMIT, garantindo que ADM, Professor e Aluno
 * recarreguem dados que já estão no banco (Single Source of Truth).
 */
public class SincronizacaoEntityListener {

    @PostPersist
    public void criado(Object entidade) {
        emitir(entidade, "CRIADO");
    }

    @PostUpdate
    public void atualizado(Object entidade) {
        emitir(entidade, "ATUALIZADO");
    }

    @PostRemove
    public void removido(Object entidade) {
        emitir(entidade, "REMOVIDO");
    }

    private void emitir(Object e, String operacao) {
        MudancaDominio evento = mapear(e, operacao);
        if (evento != null) {
            EventosDominio.publicar(evento);
        }
    }

    private static Set<String> escopos(String... valores) {
        Set<String> s = new LinkedHashSet<>();
        for (String v : valores) {
            if (v != null && !v.endsWith(":null")) {
                s.add(v);
            }
        }
        return s;
    }

    private static MudancaDominio evt(String dominio, String op, Integer id, Set<String> escopos) {
        return new MudancaDominio(dominio, op, id, escopos, Map.of());
    }

    static MudancaDominio mapear(Object e, String op) {
        if (e instanceof Usuario u) {
            return evt("usuarios", op, u.getId(), escopos("ADMIN", "USER:" + u.getId()));
        }
        if (e instanceof Turma t) {
            return evt("turmas", op, t.getId(), escopos("ALL"));
        }
        if (e instanceof Sala s) {
            return evt("turmas", op, s.getId(), escopos("ALL"));
        }
        if (e instanceof Modalidade m) {
            return evt("turmas", op, m.getId(), escopos("ALL"));
        }
        if (e instanceof Matricula m) {
            return evt("matriculas", op, m.getId(),
                escopos("ADMIN", "USER:" + m.getIdAluno(), "PROF_TURMA:" + m.getIdTurma()));
        }
        if (e instanceof Presenca p) {
            Integer aluno = p.getAluno() != null ? p.getAluno().getId() : null;
            Integer turma = p.getTurma() != null ? p.getTurma().getId() : null;
            return evt("presencas", op, p.getId(), escopos("ADMIN", "USER:" + aluno, "PROF_TURMA:" + turma));
        }
        if (e instanceof Fatura f) {
            return evt("financeiro", op, f.getId(), escopos("ADMIN", "USER:" + f.getIdAluno()));
        }
        if (e instanceof Pagamento p) {
            return evt("financeiro", op, p.getId(), escopos("ADMIN", "USER:" + p.getIdAluno()));
        }
        if (e instanceof AuditoriaPagamento a) {
            return evt("auditoria", op, a.getId(), escopos("ADMIN"));
        }
        if (e instanceof AuditoriaGeral a) {
            return evt("auditoria", op, a.getId(), escopos("ADMIN"));
        }
        if (e instanceof Comunicado c) {
            Integer turma = c.getTurma() != null ? c.getTurma().getId() : null;
            return evt("comunicados", op, c.getId(), turma == null ? escopos("ALL") : escopos("ADMIN", "TURMA:" + turma));
        }
        if (e instanceof MaterialAula m) {
            Integer turma = m.getTurma() != null ? m.getTurma().getId() : null;
            return evt("materiais", op, m.getId(), turma == null ? escopos("ALL") : escopos("ADMIN", "TURMA:" + turma));
        }
        if (e instanceof DiarioClasse d) {
            return evt("diario", op, d.getId(), escopos("ADMIN", "TURMA:" + d.getIdTurma()));
        }
        if (e instanceof AvaliacaoTecnica a) {
            return evt("avaliacoes", op, a.getId(),
                escopos("ADMIN", "USER:" + a.getIdAluno(), "USER:" + a.getIdProfessor()));
        }
        if (e instanceof Reposicao r) {
            return evt("reposicoes", op, r.getId(),
                escopos("ADMIN", "USER:" + r.getIdAluno(), "PROF_TURMA:" + r.getIdTurmaDestino()));
        }
        if (e instanceof SolicitacaoAcesso s) {
            return evt("acessos", op, s.getId(), escopos("ADMIN"));
        }
        if (e instanceof SolicitacaoCancelamento s) {
            return evt("cancelamentos", op, s.getId(), escopos("ADMIN", "USER:" + s.getIdAluno()));
        }
        if (e instanceof Checkin c) {
            return evt("checkins", op, c.getId(),
                escopos("ADMIN", "USER:" + c.getIdAluno(), "PROF_TURMA:" + c.getIdTurma()));
        }
        if (e instanceof AulaParticular a) {
            return evt("aulas_particulares", op, a.getId(),
                escopos("ADMIN", "USER:" + a.getIdAluno(), "USER:" + a.getIdProfessor()));
        }
        if (e instanceof Notificacao n) {
            Map<String, Object> dados = new LinkedHashMap<>();
            dados.put("titulo", n.getTitulo());
            dados.put("mensagem", n.getMensagem());
            dados.put("tipo", n.getTipo());
            dados.put("link", n.getLink());
            return new MudancaDominio("notificacoes", op, n.getId(), escopos("USER:" + n.getIdUsuario()),
                "CRIADO".equals(op) ? dados : Map.of());
        }
        return null;
    }
}
