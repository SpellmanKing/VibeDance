/**
 * Configuração do front-end.
 * Servido pelo Spring Boot (porta 8080) a API é a mesma origem; servido pelo
 * server.ps1 / Live Server (5500) aponta para http://localhost:8080.
 */
function resolverBase() {
    if (window.VIBEDANCE_API_BASE !== undefined) return window.VIBEDANCE_API_BASE;
    if (location.protocol === 'file:') return 'http://localhost:8080';
    if (location.port === '8080' || location.port === '') return '';
    return `${location.protocol}//${location.hostname}:8080`;
}

export const API_BASE = resolverBase();

export const DOMINIO_REGEX = /^[a-z0-9._%+-]+@vibedance\.com$/i;
export const MSG_DOMINIO = 'Acesso bloqueado: o VibeDance aceita apenas contas institucionais @vibedance.com.';

export const PORTAIS = {
    ADMINISTRADOR: 'Admin/admin.html',
    PROFESSOR: 'Professor/professor.html',
    ALUNO: 'Aluno/aluno.html',
};
