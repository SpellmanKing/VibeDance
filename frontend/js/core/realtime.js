import { API_BASE } from './config.js';
import { Session } from './session.js';

/**
 * Canal de tempo real (Server-Sent Events).
 * O back-end publica um evento "sync" após o COMMIT de qualquer CRUD que afete
 * o usuário logado e "notificacao" para o sininho. As telas assinam domínios e
 * recarregam do banco — nunca de cache local.
 */
const ouvintes = new Set();
const ouvintesStatus = new Set();
let fonte = null;
let tentativas = 0;
let status = 'conectando';

function emitirStatus(novo) {
    status = novo;
    ouvintesStatus.forEach((fn) => fn(status));
}

function despachar(tipo, ev) {
    let dados = {};
    try {
        dados = JSON.parse(ev.data);
    } catch {
        return;
    }
    ouvintes.forEach((fn) => {
        try {
            fn({ tipo, ...dados });
        } catch (e) {
            console.error('[realtime] ouvinte falhou', e);
        }
    });
}

function conectar() {
    const token = Session.token;
    if (!token || typeof EventSource === 'undefined') {
        emitirStatus('offline');
        return;
    }
    fonte?.close();
    fonte = new EventSource(`${API_BASE}/api/stream?access_token=${encodeURIComponent(token)}`);
    fonte.addEventListener('conectado', () => {
        tentativas = 0;
        emitirStatus('ao-vivo');
    });
    fonte.addEventListener('sync', (ev) => despachar('sync', ev));
    fonte.addEventListener('notificacao', (ev) => despachar('notificacao', ev));
    fonte.onerror = () => {
        emitirStatus('offline');
        if (fonte.readyState === EventSource.CLOSED) {
            const espera = Math.min(30000, 1000 * 2 ** tentativas++);
            setTimeout(conectar, espera);
        }
    };
}

export const Realtime = {
    iniciar() {
        conectar();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && (!fonte || fonte.readyState === EventSource.CLOSED)) conectar();
        });
        window.addEventListener('beforeunload', () => fonte?.close());
    },
    assinar(fn) {
        ouvintes.add(fn);
        return () => ouvintes.delete(fn);
    },
    aoMudarStatus(fn) {
        ouvintesStatus.add(fn);
        fn(status);
        return () => ouvintesStatus.delete(fn);
    },
    get status() {
        return status;
    },
};
