package com.vibedance.realtime;

import com.vibedance.model.Matricula;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.TurmaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Hub de tempo real (Server-Sent Events). Mantém as conexões abertas por usuário e
 * entrega cada {@link MudancaDominio} somente depois do COMMIT da transação.
 */
@Component
public class RealtimeHub {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;
    private static final long CACHE_TURMA_MS = 3000L;

    private record Conexao(SseEmitter emitter, Integer usuarioId, String perfil) {
    }

    private record MembrosTurma(Integer professorId, Set<Integer> alunos, long expiraEm) {
    }

    private final Map<String, Conexao> conexoes = new ConcurrentHashMap<>();
    private final Map<Integer, MembrosTurma> cacheTurmas = new ConcurrentHashMap<>();
    private final TurmaRepository turmaRepository;
    private final MatriculaRepository matriculaRepository;

    public RealtimeHub(TurmaRepository turmaRepository, MatriculaRepository matriculaRepository) {
        this.turmaRepository = turmaRepository;
        this.matriculaRepository = matriculaRepository;
    }

    public SseEmitter conectar(Usuario usuario) {
        String id = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        conexoes.put(id, new Conexao(emitter, usuario.getId(), usuario.getPerfil()));
        emitter.onCompletion(() -> conexoes.remove(id));
        emitter.onTimeout(() -> conexoes.remove(id));
        emitter.onError(e -> conexoes.remove(id));
        try {
            emitter.send(SseEmitter.event().name("conectado").reconnectTime(3000)
                .data(Map.of("usuarioId", usuario.getId(), "conexoes", conexoes.size()), MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            conexoes.remove(id);
        }
        return emitter;
    }

    public int totalConexoes() {
        return conexoes.size();
    }

    @TransactionalEventListener(fallbackExecution = true)
    public void aoMudar(MudancaDominio evento) {
        if (conexoes.isEmpty()) {
            return;
        }
        Set<Integer> usuarios = new HashSet<>();
        boolean todos = false;
        boolean admins = false;
        Set<Integer> profsTurma = new HashSet<>();

        for (String escopo : evento.escopos()) {
            if ("ALL".equals(escopo)) {
                todos = true;
            } else if ("ADMIN".equals(escopo)) {
                admins = true;
            } else if (escopo.startsWith("USER:")) {
                usuarios.add(Integer.valueOf(escopo.substring(5)));
            } else if (escopo.startsWith("TURMA:")) {
                MembrosTurma m = membros(Integer.valueOf(escopo.substring(6)));
                if (m != null) {
                    usuarios.addAll(m.alunos());
                    if (m.professorId() != null) usuarios.add(m.professorId());
                }
                admins = true;
            } else if (escopo.startsWith("PROF_TURMA:")) {
                MembrosTurma m = membros(Integer.valueOf(escopo.substring(11)));
                if (m != null && m.professorId() != null) profsTurma.add(m.professorId());
            }
        }
        usuarios.addAll(profsTurma);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("dominio", evento.dominio());
        payload.put("operacao", evento.operacao());
        payload.put("id", evento.id());
        payload.put("ts", Instant.now().toEpochMilli());
        if (evento.dados() != null && !evento.dados().isEmpty()) {
            payload.put("dados", evento.dados());
        }

        String nomeEvento = "notificacoes".equals(evento.dominio()) ? "notificacao" : "sync";

        for (Map.Entry<String, Conexao> entry : conexoes.entrySet()) {
            Conexao c = entry.getValue();
            boolean destinatario = todos
                || usuarios.contains(c.usuarioId())
                || (admins && "ADMINISTRADOR".equals(c.perfil()));
            if (destinatario) {
                enviar(entry.getKey(), c, nomeEvento, payload);
            }
        }
    }

    @Scheduled(fixedRate = 20000)
    public void heartbeat() {
        for (Map.Entry<String, Conexao> entry : conexoes.entrySet()) {
            try {
                entry.getValue().emitter().send(SseEmitter.event().comment("ping"));
            } catch (Exception e) {
                conexoes.remove(entry.getKey());
            }
        }
        long agora = System.currentTimeMillis();
        cacheTurmas.entrySet().removeIf(e -> e.getValue().expiraEm() < agora);
    }

    private void enviar(String id, Conexao c, String nome, Map<String, Object> payload) {
        try {
            c.emitter().send(SseEmitter.event().name(nome).data(payload, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            log.debug("Conexão SSE {} encerrada: {}", id, e.getMessage());
            conexoes.remove(id);
        }
    }

    private MembrosTurma membros(Integer turmaId) {
        long agora = System.currentTimeMillis();
        MembrosTurma cache = cacheTurmas.get(turmaId);
        if (cache != null && cache.expiraEm() > agora) {
            return cache;
        }
        Turma turma = turmaRepository.findById(turmaId).orElse(null);
        if (turma == null) {
            return null;
        }
        Set<Integer> alunos = new HashSet<>();
        for (Matricula m : matriculaRepository.findByIdTurmaAndStatus(turmaId, "ATIVA")) {
            alunos.add(m.getIdAluno());
        }
        MembrosTurma membros = new MembrosTurma(turma.getProfessorId(), alunos, agora + CACHE_TURMA_MS);
        cacheTurmas.put(turmaId, membros);
        return membros;
    }
}
