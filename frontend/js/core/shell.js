import { api } from './api.js';
import { Session } from './session.js';
import { Realtime } from './realtime.js';
import { telaConta, pintarAvatarLateral } from './conta.js';
import {
    $, $$, esc, html, raw, toast, toastErro, iniciais, relativo, debounce,
    skeletonPagina, erroBloco, drawerAberto, rotuloStatus,
} from './ui.js';

/**
 * Shell do portal: sidebar colapsável com indicadores, cabeçalho contextual
 * (breadcrumbs, busca global Ctrl+K, sininho em tempo real, contagem de 8),
 * roteamento por hash e recarga automática das telas a cada evento do banco.
 *
 * rotas: [{ id, titulo, icone, grupo, dominios: ['turmas', ...], render(ctx) }]
 */
export function criarPortal({ perfis, nome, icone, rotas: rotasPortal, comandos = [], inicial, aoIniciar }) {
    const user = Session.exigir(perfis);
    if (!user) return null;
    // "Minha conta" existe em todos os portais
    const rotas = [...rotasPortal, {
        id: 'conta', titulo: 'Minha conta', icone: 'fa-user-gear', grupo: 'Conta',
        dominios: ['usuarios', 'matriculas', 'notificacoes'], render: telaConta,
    }];

    // Erros não tratados viram toast (nenhuma falha silenciosa)
    api.onError((e) => {
        if (e.status === 401) return;
        toastErro(e.codigo === 'SEM_CONEXAO' ? 'Sem conexão com a API' : 'Não foi possível concluir', e.message);
    });
    window.addEventListener('unhandledrejection', (ev) => {
        if (ev.reason?.name === 'ApiError' || ev.reason?.status !== undefined) {
            ev.preventDefault();
        }
    });

    document.body.innerHTML = html`
        <div class="app" id="app">
            <aside class="sidebar" aria-label="Navegação principal">
                <div class="brand">
                    <span class="brand-mark"><img src="../img/vibedance-simbolo.svg" alt="" width="40" height="40"></span>
                    <span class="brand-text">VibeDance<small>${nome}</small></span>
                </div>
                <nav class="nav" id="nav"></nav>
                <div class="sidebar-foot">
                    <a class="me-link" href="#/conta" title="Minha conta">
                        <span class="avatar sm" id="me-avatar">${iniciais(user.nome)}</span>
                        <span class="who"><strong>${user.nome}</strong><small class="faint">${user.email}</small></span>
                    </a>
                    <button class="icon-btn" id="btn-sair" title="Sair" aria-label="Sair"><i class="fas fa-arrow-right-from-bracket"></i></button>
                </div>
            </aside>
            <div class="main">
                <header class="topbar">
                    <button class="icon-btn menu-toggle" id="btn-menu" aria-label="Abrir menu"><i class="fas fa-bars"></i></button>
                    <button class="icon-btn collapse-toggle" id="btn-collapse" aria-label="Recolher menu"><i class="fas fa-angles-left"></i></button>
                    <nav class="crumbs" id="crumbs" aria-label="Você está em"></nav>
                    <span class="topbar-spacer"></span>
                    <button class="search-trigger" id="btn-busca"><i class="fas fa-magnifying-glass"></i><span>Buscar ou executar ação</span><kbd>Ctrl K</kbd></button>
                    <span class="beat" id="beat" title="Sincronização em tempo real" role="status" aria-live="polite"><i class="beat-dot" aria-hidden="true"></i><span class="beat-bars" aria-hidden="true">${raw('<span></span>'.repeat(8))}</span><span class="beat-label" id="beat-label">Conectando</span></span>
                    <button class="icon-btn" id="btn-sino" aria-label="Notificações" aria-haspopup="true"><i class="fas fa-bell"></i><span class="dot" id="sino-dot" data-n="0"></span></button>
                </header>
                <main class="content" id="view" tabindex="-1"></main>
            </div>
        </div>
        <div class="popover" id="pop-notif" role="dialog" aria-label="Notificações">
            <div class="popover-head"><h4>Notificações</h4><button class="btn btn-sm btn-ghost" id="btn-lidas">Marcar todas como lidas</button></div>
            <div class="notif-list" id="notif-list"></div>
        </div>`;

    const app = $('#app');
    const view = $('#view');
    const estado = { rota: null, params: {}, cleanup: [], ultimaCarga: 0, contadores: {}, sub: null };

    // ------------------------------------------------------------ navegação
    function montarNav() {
        let grupo = null;
        $('#nav').innerHTML = rotas.filter((r) => !r.oculta).map((r) => {
            const cab = r.grupo && r.grupo !== grupo ? `<div class="nav-group">${esc(r.grupo)}</div>` : '';
            grupo = r.grupo;
            const n = estado.contadores[r.id];
            return `${cab}<a href="#/${r.id}" data-rota="${r.id}" title="${esc(r.titulo)}"><i class="fas ${r.icone}"></i><span class="nav-label">${esc(r.titulo)}</span>${n ? `<span class="count">${n}</span>` : ''}</a>`;
        }).join('');
        marcarAtivo();
    }
    function marcarAtivo() {
        $$('#nav a').forEach((a) => {
            const ativo = a.dataset.rota === estado.rota?.id;
            a.classList.toggle('is-active', ativo);
            if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
    }
    function crumbs() {
        const partes = [nome, estado.rota?.titulo, estado.sub].filter(Boolean);
        $('#crumbs').innerHTML = partes.map((p, i) => (i === partes.length - 1 ? `<strong>${esc(p)}</strong>` : `<span>${esc(p)}</span><i class="fas fa-chevron-right"></i>`)).join('');
        document.title = `${estado.sub || estado.rota?.titulo || ''} · VibeDance`;
    }

    function lerHash() {
        const [caminho, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
        return { id: caminho || inicial || rotas[0].id, params: Object.fromEntries(new URLSearchParams(query)) };
    }

    async function renderizar({ suave = false } = {}) {
        const { id, params } = lerHash();
        const rota = rotas.find((r) => r.id === id) || rotas[0];
        const trocou = estado.rota !== rota;
        if (trocou) {
            estado.cleanup.forEach((fn) => fn());
            estado.cleanup = [];
            estado.sub = null;
        }
        estado.rota = rota;
        estado.params = params;
        marcarAtivo();
        crumbs();
        app.classList.remove('is-mobile-open');

        const scroll = window.scrollY;
        if (!suave) {
            view.innerHTML = rota.skeleton || skeletonPagina();
            if (trocou) window.scrollTo(0, 0);
        }
        const ctx = {
            el: view, params, user, suave,
            crumb(t) { estado.sub = t; crumbs(); },
            onCleanup(fn) { estado.cleanup.push(fn); },
            recarregar: () => renderizar({ suave: true }),
            navegar,
        };
        try {
            await rota.render(ctx);
            if (!suave) view.classList.add('reveal');
            else view.classList.remove('reveal');
            estado.ultimaCarga = Date.now();
            if (suave) window.scrollTo(0, scroll);
        } catch (e) {
            console.error(e);
            view.innerHTML = erroBloco(e);
            view.querySelector('[data-retry]')?.addEventListener('click', () => renderizar());
        }
    }

    function navegar(hash) {
        if (location.hash === hash) renderizar(); else location.hash = hash;
    }

    window.addEventListener('hashchange', () => renderizar());

    // ------------------------------------------------------------ sidebar
    if (localStorage.getItem('vd.sidebar') === 'collapsed') app.classList.add('is-collapsed');
    $('#btn-collapse').onclick = () => {
        app.classList.toggle('is-collapsed');
        localStorage.setItem('vd.sidebar', app.classList.contains('is-collapsed') ? 'collapsed' : 'open');
    };
    $('#btn-menu').onclick = () => app.classList.toggle('is-mobile-open');
    $('#btn-sair').onclick = () => Session.sair();

    // ------------------------------------------------------------ tempo real
    const beat = $('#beat');
    const beatLabel = $('#beat-label');
    let statusRT = 'conectando';
    let timerSync = null;
    const rotuloStatus = () => (statusRT === 'ao-vivo' ? 'Ao vivo' : statusRT === 'offline' ? 'Reconectando' : 'Conectando');
    Realtime.aoMudarStatus((s) => {
        statusRT = s;
        beat.classList.toggle('is-live', s === 'ao-vivo');
        beat.classList.toggle('is-offline', s === 'offline');
        beat.title = s === 'ao-vivo' ? 'Sincronizado em tempo real com o banco' : s === 'offline' ? 'Reconectando ao canal em tempo real…' : 'Conectando…';
        if (!beat.classList.contains('is-pulse')) beatLabel.textContent = rotuloStatus();
    });
    const pulsar = () => {
        beat.classList.remove('is-pulse');
        void beat.offsetWidth;
        beat.classList.add('is-pulse');
        beatLabel.textContent = 'Sincronizado';
        clearTimeout(timerSync);
        timerSync = setTimeout(() => { beat.classList.remove('is-pulse'); beatLabel.textContent = rotuloStatus(); }, 1600);
    };
    const recarregarSuave = debounce(() => renderizar({ suave: true }), 350);
    const recarregarDrawer = debounce(() => drawerAberto()?.recarregar(), 400);
    Realtime.assinar((ev) => {
        if (ev.tipo === 'notificacao') {
            receberNotificacao(ev);
            return;
        }
        pulsar();
        const dominios = estado.rota?.dominios || [];
        if (dominios.includes('*') || dominios.includes(ev.dominio)) recarregarSuave();
        recarregarDrawer();
        atualizarContadores();
    });
    Realtime.iniciar();

    // Rede de segurança: ao voltar para a aba após 60s, recarrega a tela
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - estado.ultimaCarga > 60000) renderizar({ suave: true });
    });

    // ------------------------------------------------------------ notificações
    const pop = $('#pop-notif');
    let notificacoes = { naoLidas: 0, itens: [] };

    function pintarSino() {
        const dot = $('#sino-dot');
        dot.dataset.n = notificacoes.naoLidas;
        dot.textContent = notificacoes.naoLidas > 9 ? '9+' : notificacoes.naoLidas || '';
        const icones = { ALERTA: 'fa-triangle-exclamation', SUCESSO: 'fa-circle-check', FINANCEIRO: 'fa-wallet', AGENDA: 'fa-calendar-check', INFO: 'fa-bell' };
        $('#notif-list').innerHTML = notificacoes.itens.length
            ? notificacoes.itens.map((n) => html`
                <button class="notif t-${n.tipo} ${n.lida ? '' : 'is-unread'}" data-id="${n.id}" data-link="${n.link || ''}">
                    <span class="ico"><i class="fas ${icones[n.tipo] || icones.INFO}"></i></span>
                    <span><strong>${n.titulo}</strong><p>${n.mensagem || ''}</p><time>${relativo(n.criadaEm)}</time></span>
                </button>`).join('')
            : '<div class="empty"><i class="fas fa-bell-slash"></i><p>Nenhuma notificação por enquanto.</p></div>';
    }
    async function carregarNotificacoes() {
        try {
            notificacoes = await api.get('/api/notificacoes', { silencioso: true });
            pintarSino();
        } catch { /* sino permanece com o último estado */ }
    }
    function receberNotificacao(ev) {
        const d = ev.dados || {};
        notificacoes.itens.unshift({ id: ev.id, titulo: d.titulo, mensagem: d.mensagem, tipo: d.tipo, link: d.link, lida: false, criadaEm: new Date().toISOString() });
        notificacoes.naoLidas += 1;
        pintarSino();
        toast(d.titulo || 'Nova notificação', { tipo: d.tipo === 'ALERTA' ? 'warn' : d.tipo === 'SUCESSO' ? 'ok' : 'info', texto: d.mensagem });
    }
    $('#btn-sino').onclick = (e) => {
        e.stopPropagation();
        pop.classList.toggle('is-open');
    };
    document.addEventListener('click', (e) => {
        if (!pop.contains(e.target) && e.target.closest('#btn-sino') === null) pop.classList.remove('is-open');
    });
    $('#notif-list').addEventListener('click', async (e) => {
        const item = e.target.closest('.notif');
        if (!item) return;
        const n = notificacoes.itens.find((x) => String(x.id) === item.dataset.id);
        if (n && !n.lida) {
            n.lida = true;
            notificacoes.naoLidas = Math.max(0, notificacoes.naoLidas - 1);
            pintarSino();
            api.post(`/api/notificacoes/${n.id}/lida`, undefined, { silencioso: true }).catch(() => {});
        }
        pop.classList.remove('is-open');
        if (item.dataset.link) navegar(item.dataset.link);
    });
    $('#btn-lidas').onclick = async () => {
        await api.post('/api/notificacoes/lidas');
        notificacoes.itens.forEach((n) => { n.lida = true; });
        notificacoes.naoLidas = 0;
        pintarSino();
    };

    // ------------------------------------------------------------ contadores de navegação
    const atualizarContadores = debounce(async () => {
        if (!aoIniciar?.contadores) return;
        try {
            estado.contadores = await aoIniciar.contadores();
            montarNav();
        } catch { /* indicadores são opcionais */ }
    }, 600);

    // ------------------------------------------------------------ Ctrl+K
    criarPaletaComandos({ rotas, comandos, navegar });

    // Foto de perfil no rodapé da barra lateral (dados frescos do banco)
    pintarAvatarLateral(user);
    api.get('/api/me', { silencioso: true }).then((eu) => {
        Session.atualizarUsuario({ avatarUrl: eu.avatarUrl || null, nome: eu.nome });
        pintarAvatarLateral(eu);
    }).catch(() => {});

    montarNav();
    carregarNotificacoes();
    atualizarContadores();
    renderizar();
    aoIniciar?.depois?.();

    return { navegar, recarregar: () => renderizar({ suave: true }), user };
}

function criarPaletaComandos({ rotas, comandos, navegar }) {
    let el = null;
    let itens = [];
    let ativo = 0;

    const locais = () => [
        ...rotas.filter((r) => !r.oculta).map((r) => ({ grupo: 'Ir para', titulo: r.titulo, icone: r.icone, acao: () => navegar(`#/${r.id}`) })),
        ...comandos.map((c) => ({ grupo: 'Ações', ...c })),
    ];

    function fechar() {
        if (!el) return;
        el.overlay.remove();
        el.box.remove();
        el = null;
    }

    function pintar() {
        const lista = el.box.querySelector('.cmdk-list');
        if (!itens.length) {
            lista.innerHTML = '<div class="empty"><i class="fas fa-magnifying-glass"></i><p>Nenhum resultado. Tente o nome de um aluno, turma ou ação.</p></div>';
            return;
        }
        let grupo = null;
        lista.innerHTML = itens.map((it, i) => {
            const cab = it.grupo !== grupo ? `<div class="cmdk-group">${esc(it.grupo)}</div>` : '';
            grupo = it.grupo;
            return `${cab}<button class="cmdk-item ${i === ativo ? 'is-active' : ''}" data-i="${i}" role="option" aria-selected="${i === ativo}"><i class="fas ${it.icone || 'fa-arrow-right'}"></i><span>${esc(it.titulo)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`;
        }).join('');
        lista.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    }

    const buscarRemoto = debounce(async (q, base) => {
        if (q.length < 2 || !el) return;
        try {
            const res = await api.get('/api/busca', { query: { q }, silencioso: true });
            if (!el || el.box.querySelector('input').value.trim() !== q) return;
            const tipos = { TURMA: 'Turmas', USUARIO: 'Pessoas', ALUNO: 'Alunos', FATURA: 'Faturas' };
            itens = [...base, ...res.map((r) => ({ grupo: tipos[r.tipo] || r.tipo, titulo: r.titulo, sub: r.subtitulo?.replace(/\b(CONFIRMADO|PENDENTE|VENCIDO|EM_ANALISE|CANCELADO|ADMINISTRADOR|PROFESSOR|ALUNO)\b/g, (s) => rotuloStatus(s)), icone: r.icone, acao: () => navegar(r.rota) }))];
            pintar();
        } catch { /* busca local continua disponível */ }
    }, 220);

    function filtrar(q) {
        const termo = q.toLowerCase().trim();
        const base = locais().filter((c) => !termo || c.titulo.toLowerCase().includes(termo));
        itens = base;
        ativo = 0;
        pintar();
        buscarRemoto(q.trim(), base);
    }

    function abrir() {
        if (el) return;
        const overlay = document.createElement('div');
        overlay.className = 'overlay is-open';
        const box = document.createElement('div');
        box.className = 'cmdk';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Busca global');
        box.innerHTML = `<div class="cmdk-input"><i class="fas fa-magnifying-glass"></i><input type="text" placeholder="Buscar pessoas, turmas, faturas ou ações…" aria-label="Buscar" role="combobox" aria-expanded="true"><kbd>Esc</kbd></div>
            <div class="cmdk-list" role="listbox"></div>
            <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></div>`;
        document.body.append(overlay, box);
        el = { overlay, box };
        overlay.onclick = fechar;
        requestAnimationFrame(() => box.classList.add('is-open'));
        const input = box.querySelector('input');
        input.focus();
        input.addEventListener('input', () => filtrar(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { ativo = Math.min(itens.length - 1, ativo + 1); pintar(); e.preventDefault(); }
            if (e.key === 'ArrowUp') { ativo = Math.max(0, ativo - 1); pintar(); e.preventDefault(); }
            if (e.key === 'Enter' && itens[ativo]) { const it = itens[ativo]; fechar(); it.acao(); }
            if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
        });
        box.querySelector('.cmdk-list').addEventListener('click', (e) => {
            const b = e.target.closest('.cmdk-item');
            if (!b) return;
            const it = itens[Number(b.dataset.i)];
            fechar();
            it.acao();
        });
        filtrar('');
    }

    document.getElementById('btn-busca').onclick = abrir;
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (el) fechar(); else abrir();
        }
        if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]')) {
            e.preventDefault();
            abrir();
        }
    });
}
