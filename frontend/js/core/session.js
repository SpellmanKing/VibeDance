import { DOMINIO_REGEX, PORTAIS } from './config.js';

const TOKEN_KEY = 'vd.token';
const USER_KEY = 'vd.user';

/** Sessão do usuário (JWT emitido pelo back-end). Nunca guarda senha. */
export const Session = {
    get token() {
        return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    },

    get user() {
        try {
            return JSON.parse(sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) || 'null');
        } catch {
            return null;
        }
    },

    salvar({ token, id, nome, email, perfil }, lembrar = false) {
        const store = lembrar ? localStorage : sessionStorage;
        this.limpar();
        store.setItem(TOKEN_KEY, token);
        store.setItem(USER_KEY, JSON.stringify({ id, nome, email, perfil }));
    },

    atualizarUsuario(dados) {
        const atual = this.user;
        if (!atual) return;
        const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
        store.setItem(USER_KEY, JSON.stringify({ ...atual, ...dados }));
    },

    limpar() {
        [sessionStorage, localStorage].forEach((s) => {
            s.removeItem(TOKEN_KEY);
            s.removeItem(USER_KEY);
        });
    },

    expirado() {
        const token = this.token;
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return !payload.exp || payload.exp * 1000 < Date.now();
        } catch {
            return true;
        }
    },

    /** Raiz do front (funciona tanto em / quanto em /Admin/...). */
    raiz() {
        return location.pathname.match(/\/(Admin|Professor|Aluno)\//) ? '../' : './';
    },

    sair(motivo) {
        this.limpar();
        const q = motivo ? `?motivo=${encodeURIComponent(motivo)}` : '';
        location.replace(`${this.raiz()}index.html${q}`);
    },

    /**
     * Guarda de rota: exige sessão válida, domínio @vibedance.com e o perfil do portal.
     * O back-end revalida tudo isso em cada requisição — aqui é só UX.
     */
    exigir(perfisPermitidos) {
        const user = this.user;
        if (!user || this.expirado()) {
            this.sair('sessao');
            return null;
        }
        if (!DOMINIO_REGEX.test(user.email || '')) {
            this.sair('dominio');
            return null;
        }
        if (!perfisPermitidos.includes(user.perfil)) {
            location.replace(`${this.raiz()}${PORTAIS[user.perfil] || 'index.html'}`);
            return null;
        }
        return user;
    },
};
