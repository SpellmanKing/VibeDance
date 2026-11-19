import { API_BASE } from './config.js';
import { Session } from './session.js';

/**
 * Cliente HTTP com interceptors.
 *  - request: injeta JWT, serializa JSON, aplica timeout.
 *  - response: normaliza erros ({codigo, erro, detalhes}) do @ControllerAdvice,
 *    trata 401/403 de domínio/conta suspensa encerrando a sessão.
 * Nenhuma falha é silenciosa: quem chama decide exibir; o interceptor global
 * de erro (onError) mostra toast por padrão.
 */
export class ApiError extends Error {
    constructor({ status, codigo, erro, detalhes }) {
        super(erro || 'Falha na comunicação com o servidor.');
        this.status = status;
        this.codigo = codigo;
        this.detalhes = detalhes;
    }
}

const interceptors = { request: [], response: [], error: [] };

export const api = {
    onRequest(fn) { interceptors.request.push(fn); },
    onResponse(fn) { interceptors.response.push(fn); },
    onError(fn) { interceptors.error.push(fn); },

    async request(method, path, { body, query, silencioso = false, timeout = 20000, raw = false, accept = 'application/json' } = {}) {
        const url = new URL(API_BASE + path, location.href);
        if (query) {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
            });
        }
        let init = { method, headers: { Accept: accept } };
        const token = Session.token;
        if (token) init.headers.Authorization = `Bearer ${token}`;
        if (body instanceof FormData) {
            init.body = body;
        } else if (body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        for (const fn of interceptors.request) init = (await fn(init, url)) || init;

        const controle = new AbortController();
        const timer = setTimeout(() => controle.abort(), timeout);
        init.signal = controle.signal;

        let resp;
        try {
            resp = await fetch(url, init);
        } catch (e) {
            clearTimeout(timer);
            const erro = new ApiError({
                status: 0,
                codigo: e.name === 'AbortError' ? 'TEMPO_ESGOTADO' : 'SEM_CONEXAO',
                erro: e.name === 'AbortError'
                    ? 'O servidor demorou para responder. Tente novamente.'
                    : 'Não foi possível conectar à API do VibeDance. Verifique se o back-end está em execução.',
            });
            return this._falha(erro, silencioso);
        }
        clearTimeout(timer);
        for (const fn of interceptors.response) await fn(resp);

        if (resp.status === 204) return null;
        if (raw && resp.ok) return resp;

        const tipo = resp.headers.get('content-type') || '';
        const dados = tipo.includes('application/json') ? await resp.json().catch(() => null) : await resp.text();

        if (!resp.ok) {
            const corpo = dados && typeof dados === 'object' ? dados : { erro: typeof dados === 'string' && dados ? dados : null };
            const erro = new ApiError({
                status: resp.status,
                codigo: corpo.codigo,
                erro: corpo.erro || corpo.message || `Erro ${resp.status}`,
                detalhes: corpo.detalhes,
            });
            if (resp.status === 401 && !path.startsWith('/api/auth/')) {
                Session.sair('sessao');
            } else if (resp.status === 403 && ['DOMINIO_NAO_AUTORIZADO', 'CONTA_SUSPENSA'].includes(corpo.codigo)) {
                Session.sair(corpo.codigo === 'CONTA_SUSPENSA' ? 'suspensa' : 'dominio');
            }
            return this._falha(erro, silencioso);
        }
        return dados;
    },

    _falha(erro, silencioso) {
        if (!silencioso) interceptors.error.forEach((fn) => fn(erro));
        throw erro;
    },

    /** Baixa um arquivo autenticado e abre (inline) ou salva (download). */
    async arquivo(path, { nome, baixar = false } = {}) {
        // Aceita o tipo do arquivo (PDF, imagem…) e, em erro, ainda lê a mensagem JSON da API
        const resp = await this.request('GET', path, { raw: true, accept: 'application/pdf, image/*, application/json;q=0.9, */*;q=0.8', timeout: 45000 });
        const blob = await resp.blob();
        if (!blob.size) throw this._falha(new ApiError({ status: 0, codigo: 'ARQUIVO_VAZIO', erro: 'O arquivo veio vazio. Tente novamente.' }), false);
        const url = URL.createObjectURL(blob);
        if (baixar) {
            const a = document.createElement('a');
            a.href = url;
            a.download = nome || 'arquivo';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            const janela = window.open(url, '_blank', 'noopener');
            if (!janela) location.assign(url); // bloqueador de pop-up: abre na própria aba
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    get(path, opts) { return this.request('GET', path, opts); },
    post(path, body, opts) { return this.request('POST', path, { ...opts, body }); },
    put(path, body, opts) { return this.request('PUT', path, { ...opts, body }); },
    patch(path, body, opts) { return this.request('PATCH', path, { ...opts, body }); },
    del(path, opts) { return this.request('DELETE', path, opts); },
};
