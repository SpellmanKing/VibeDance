package com.vibedance.realtime;

import java.util.Map;
import java.util.Set;

/**
 * Evento interno disparado a cada INSERT/UPDATE/DELETE persistido.
 *
 * @param dominio   área afetada (turmas, presencas, financeiro, ...) — o front usa
 *                  para decidir quais telas recarregar
 * @param operacao  CRIADO, ATUALIZADO ou REMOVIDO
 * @param id        identificador da entidade alterada
 * @param escopos   destinatários: ALL, ADMIN, USER:{id}, TURMA:{id}, PROF_TURMA:{id}
 * @param dados     carga extra opcional (ex.: conteúdo de uma notificação)
 */
public record MudancaDominio(String dominio, String operacao, Integer id, Set<String> escopos, Map<String, Object> dados) {
}
