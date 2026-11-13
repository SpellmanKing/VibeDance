/**
 * VibeDance Application Bridge & Utilities
 * Conecta utilitários globais, suporte a API Spring Boot e VibeStore local
 */

const API_URL = 'http://localhost:8080/api';

/**
 * Busca e exibe as modalidades de dança
 */
async function carregarModalidades() {
    try {
        const response = await fetch(`${API_URL}/modalidades`);
        if (!response.ok) throw new Error('Falha na API');
        const modalidades = await response.json();
        return modalidades;
    } catch (error) {
        // Fallback transparente para o store reativo
        return window.VibeStore ? window.VibeStore.getModalidades() : [];
    }
}

/**
 * Encapsulador de autenticação
 */
async function realizarLogin(email, senha) {
    if (window.VibeAuth) {
        return await window.VibeAuth.login(email, senha);
    }
}

window.carregarModalidades = carregarModalidades;
window.realizarLogin = realizarLogin;