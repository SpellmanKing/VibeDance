/**
 * Kit de UI: escape seguro, formatadores, toasts, drawers, modais multi-etapas,
 * confirmações, skeletons e badges de status.
 */
import { API_BASE } from './config.js';

// ------------------------------------------------------------------ escape

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

/** Template tag que escapa interpolações (use raw() para HTML confiável). */
export function html(strings, ...valores) {
    return strings.reduce((acc, s, i) => {
        if (i >= valores.length) return acc + s;
        const v = valores[i];
        const txt = Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.v : esc(x))).join('')
            : v && v.__raw ? v.v : esc(v);
        return acc + s + txt;
    }, '');
}
export const raw = (v) => ({ __raw: true, v: v ?? '' });

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ------------------------------------------------------------------ formatadores

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (v) => moedaFmt.format(Number(v || 0));
export const pct = (v, casas = 1) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;
export const num = (v) => Number(v || 0).toLocaleString('pt-BR');

export function parseData(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [a, m, d] = v.split('-').map(Number);
        return new Date(a, m - 1, d);
    }
    return new Date(v);
}
export const data = (v) => (v ? parseData(v).toLocaleDateString('pt-BR') : '—');
export const dataCurta = (v) => (v ? parseData(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—');
export const dataLonga = (v) => (v ? parseData(v).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—');
export const dataHora = (v) => (v ? parseData(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const isoHoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function relativo(v) {
    if (!v) return '';
    const diff = (Date.now() - parseData(v).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
    return data(v);
}
export const iniciais = (nome = '') => nome.replace(/^(Prof(a)?\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
/** URL de arquivo servido pela API (ex.: fotos de perfil), funcionando também com o front em outra porta. */
export const urlArquivo = (caminho) => (caminho && caminho.startsWith('/api/') ? `${API_BASE}${caminho}` : caminho || '');
export const avatar = (u, cls = '') => (u?.avatarUrl
    ? `<span class="avatar has-photo ${cls}" style="background-image:url('${esc(urlArquivo(u.avatarUrl))}')" aria-hidden="true"></span>`
    : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciais(u?.nome))}</span>`);
export const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const NIVEIS = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado', TODOS_OS_NIVEIS: 'Todos os níveis' };

// ------------------------------------------------------------------ status → badge

const STATUS = {
    CONFIRMADO: ['ok', 'Pago'], PAGO: ['ok', 'Pago'], PENDENTE: ['warn', 'Pendente'], VENCIDO: ['danger', 'Atrasado'],
    EM_ANALISE: ['info', 'Em análise'], CANCELADO: ['', 'Cancelado'], RECUSADO: ['danger', 'Recusado'],
    ESTORNADO: ['', 'Estornado'],
    ATIVA: ['ok', 'Ativa'], CANCELADA: ['', 'Cancelada'], TRANCADA: ['warn', 'Trancada'],
    SOLICITADA: ['warn', 'Aguardando'], APROVADA: ['ok', 'Aprovada'], RECUSADA: ['danger', 'Recusada'],
    PRESENTE: ['ok', 'Presente'], FALTA: ['danger', 'Falta'], JUSTIFICADO: ['warn', 'Justificado'],
    EM_DIA: ['ok', 'Em dia'], ATRASADO: ['danger', 'Atrasado'], SEM_MATRICULA: ['', 'Sem matrícula'],
    ATIVO: ['ok', 'Ativo'], SUSPENSO: ['danger', 'Suspenso'],
    ADMINISTRADOR: ['magenta', 'ADM'], PROFESSOR: ['info', 'Professor'], ALUNO: ['cyan', 'Aluno'],
    REPOSICAO: ['info', 'Reposição'], EXPERIMENTAL: ['magenta', 'Experimental'], REGULAR: ['', 'Regular'],
    OK: ['ok', 'Ótima'], ATENCAO: ['warn', 'Atenção'], CRITICO: ['danger', 'Crítica'],
    NOVA: ['info', 'Novo'], EM_CONTATO: ['warn', 'Em contato'], AGENDADA: ['', 'Agendada'], SEM_REGISTRO: ['', 'Sem chamada'],
};
export function badge(status, rotulo) {
    const [cls, txt] = STATUS[status] || ['', status || '—'];
    return `<span class="badge ${cls}">${esc(rotulo || txt)}</span>`;
}
export const rotuloStatus = (s) => (STATUS[s] || [null, s])[1];

// ------------------------------------------------------------------ toasts

let toastBox;
export function toast(titulo, { tipo = 'info', texto = '', duracao = 4200 } = {}) {
    if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.className = 'toasts';
        toastBox.setAttribute('role', 'status');
        toastBox.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastBox);
    }
    const icones = { ok: 'fa-circle-check', error: 'fa-triangle-exclamation', warn: 'fa-bell', info: 'fa-wave-square' };
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.innerHTML = html`<i class="fas ${icones[tipo] || icones.info}"></i><div><strong>${titulo}</strong>${texto ? raw(`<p>${esc(texto)}</p>`) : ''}</div><button class="toast-close" aria-label="Fechar"><i class="fas fa-xmark"></i></button>`;
    const fechar = () => {
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 180);
    };
    el.querySelector('.toast-close').onclick = fechar;
    toastBox.appendChild(el);
    while (toastBox.children.length > 4) toastBox.firstElementChild.remove();
    setTimeout(fechar, duracao);
}
export const toastOk = (t, texto) => toast(t, { tipo: 'ok', texto });
export const toastErro = (t, texto) => toast(t, { tipo: 'error', texto, duracao: 6500 });

// ------------------------------------------------------------------ camadas (drawer/modal)

const pilha = [];

function abrirCamada(el, { onClose } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.append(overlay, el);
    const anterior = document.activeElement;
    const camada = {
        el, overlay,
        fechar() {
            el.classList.remove('is-open');
            overlay.classList.remove('is-open');
            const i = pilha.indexOf(camada);
            if (i >= 0) pilha.splice(i, 1);
            setTimeout(() => { el.remove(); overlay.remove(); }, 260);
            onClose?.();
            anterior?.focus?.();
        },
    };
    overlay.onclick = () => camada.fechar();
    pilha.push(camada);
    requestAnimationFrame(() => {
        el.classList.add('is-open');
        overlay.classList.add('is-open');
        const foco = el.querySelector('[autofocus], input, select, textarea, button:not(.icon-btn)');
        foco?.focus();
    });
    return camada;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pilha.length) {
        e.preventDefault();
        pilha[pilha.length - 1].fechar();
    }
});

/**
 * Drawer lateral de inspeção rápida.
 * render(body, drawer) pode ser async; drawer.recarregar() reexecuta (usado pelo tempo real).
 */
export function drawer({ titulo, subtitulo = '', render, acoes = '', largura }) {
    const el = document.createElement('aside');
    el.className = 'drawer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (largura) el.style.width = `min(${largura}px, 100vw)`;
    el.innerHTML = html`
        <header class="drawer-head">
            <div><h3 class="d-title">${titulo}</h3><p class="d-sub">${subtitulo}</p></div>
            <button class="icon-btn" data-close aria-label="Fechar"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="drawer-body">${raw(skeletonLinhas(6))}</div>
        <footer class="drawer-foot" ${acoes ? '' : 'hidden'}>${raw(acoes)}</footer>`;
    const camada = abrirCamada(el);
    const api = {
        el,
        body: el.querySelector('.drawer-body'),
        foot: el.querySelector('.drawer-foot'),
        fechar: () => camada.fechar(),
        titulo(t, sub) {
            el.querySelector('.d-title').textContent = t;
            if (sub !== undefined) el.querySelector('.d-sub').textContent = sub;
        },
        acoes(htmlAcoes) {
            api.foot.innerHTML = htmlAcoes;
            api.foot.hidden = !htmlAcoes;
        },
        async recarregar() {
            try {
                await render(api.body, api);
            } catch (e) {
                api.body.innerHTML = erroBloco(e);
            }
        },
    };
    el.querySelector('[data-close]').onclick = () => camada.fechar();
    api.recarregar();
    drawerAtivo = api;
    const fecharOriginal = camada.fechar;
    camada.fechar = () => {
        if (drawerAtivo === api) drawerAtivo = null;
        fecharOriginal();
    };
    return api;
}
let drawerAtivo = null;
export const drawerAberto = () => drawerAtivo;

/**
 * Modal com etapas opcionais.
 * etapas: [{ titulo, html, validar?: (form) => bool|string }]
 * onSubmit(dados, form, modal) é chamado na última etapa; lance erro para manter aberto.
 */
export function modal({ titulo, subtitulo = '', etapas, corpo, confirmar = 'Salvar', largo = false, onSubmit, onAbrir, onFechar, perigo = false }) {
    const passos = etapas || [{ titulo: '', html: corpo }];
    const el = document.createElement('div');
    el.className = `modal ${largo ? 'wide' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = html`
        <header class="modal-head">
            <div><h3>${titulo}</h3>${subtitulo ? raw(`<p>${esc(subtitulo)}</p>`) : ''}</div>
            <button class="icon-btn" type="button" data-close aria-label="Fechar"><i class="fas fa-xmark"></i></button>
        </header>
        ${raw(passos.length > 1 ? `<nav class="stepper">${passos.map((p, i) => `<span class="step" data-i="${i}">${i + 1}. ${esc(p.titulo)}</span>`).join('')}</nav>` : '')}
        <form novalidate>
            <div class="modal-body">${raw(passos.map((p, i) => `<section class="step-pane" data-i="${i}">${p.html}</section>`).join(''))}
                <div class="callout danger mt-4" data-form-error hidden><i class="fas fa-circle-exclamation"></i><span></span></div>
            </div>
            <footer class="modal-foot">
                <button type="button" class="btn btn-ghost" data-back>Cancelar</button>
                <span class="grow"></span>
                <button type="submit" class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" data-next>${confirmar}</button>
            </footer>
        </form>`;
    const form = el.querySelector('form');
    const camada = abrirCamada(el, { onClose: onFechar });
    let atual = 0;
    const btnNext = el.querySelector('[data-next]');
    const btnBack = el.querySelector('[data-back]');
    const caixaErro = el.querySelector('[data-form-error]');

    const api = {
        el, form,
        fechar: () => camada.fechar(),
        erro(msg) {
            caixaErro.hidden = !msg;
            caixaErro.querySelector('span').textContent = msg || '';
        },
        irPara(i) {
            atual = i;
            el.querySelectorAll('.step-pane').forEach((p, j) => p.classList.toggle('is-current', j === i));
            el.querySelectorAll('.stepper .step').forEach((s, j) => {
                s.classList.toggle('is-current', j === i);
                s.classList.toggle('is-done', j < i);
            });
            btnBack.textContent = i === 0 ? 'Cancelar' : 'Voltar';
            btnNext.textContent = i === passos.length - 1 ? confirmar : 'Continuar';
            api.erro(null);
            el.querySelector('.step-pane.is-current input, .step-pane.is-current select, .step-pane.is-current textarea')?.focus();
        },
    };

    btnBack.onclick = () => (atual === 0 ? camada.fechar() : api.irPara(atual - 1));
    el.querySelector('[data-close]').onclick = () => camada.fechar();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passo = passos[atual];
        limparErrosCampos(form);
        const pane = el.querySelector(`.step-pane[data-i="${atual}"]`);
        const invalido = [...pane.querySelectorAll('[required]')].find((c) => !c.value?.trim());
        if (invalido) {
            marcarCampo(invalido, 'Campo obrigatório');
            invalido.focus();
            return;
        }
        if (passo.validar) {
            const r = await passo.validar(form, api);
            if (r !== true && r !== undefined) {
                api.erro(typeof r === 'string' ? r : 'Revise os dados desta etapa.');
                return;
            }
        }
        if (atual < passos.length - 1) {
            api.irPara(atual + 1);
            return;
        }
        btnNext.classList.add('is-loading');
        try {
            await onSubmit?.(lerForm(form), form, api);
            camada.fechar();
        } catch (err) {
            api.erro(err.message);
            aplicarErrosCampos(form, err.detalhes);
        } finally {
            btnNext.classList.remove('is-loading');
        }
    });
    api.irPara(0);
    onAbrir?.(form, api);
    return api;
}

export function confirmar({ titulo, texto, confirmar: rotulo = 'Confirmar', perigo = false, motivo = false, motivoObrigatorio = false, rotuloMotivo = 'Motivo' }) {
    return new Promise((resolve) => {
        let resposta = false;
        modal({
            titulo,
            perigo,
            confirmar: rotulo,
            corpo: html`<p class="muted">${texto}</p>${raw(motivo ? `<div class="field mt-4"><label for="cf-motivo">${esc(rotuloMotivo)}</label><textarea class="input" id="cf-motivo" name="motivo" ${motivoObrigatorio ? 'required' : ''}></textarea></div>` : '')}`,
            onSubmit: (dados) => {
                resposta = motivo ? (dados.motivo || '') : true;
            },
            onFechar: () => resolve(resposta),
        });
    });
}

// ------------------------------------------------------------------ formulários

export function lerForm(form) {
    const dados = {};
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
        if (k in dados) {
            dados[k] = [].concat(dados[k], v);
        } else {
            dados[k] = typeof v === 'string' ? v.trim() : v;
        }
    }
    form.querySelectorAll('input[type=checkbox][data-array]').forEach((c) => {
        if (!(c.name in dados)) dados[c.name] = [];
        else if (!Array.isArray(dados[c.name])) dados[c.name] = [dados[c.name]];
    });
    return dados;
}

function marcarCampo(campo, msg) {
    campo.classList.add('is-invalid');
    const field = campo.closest('.field');
    let el = field?.querySelector('.error-msg');
    if (field && !el) {
        el = document.createElement('span');
        el.className = 'error-msg';
        field.appendChild(el);
    }
    if (el) el.textContent = msg;
}
function limparErrosCampos(form) {
    form.querySelectorAll('.is-invalid').forEach((c) => c.classList.remove('is-invalid'));
    form.querySelectorAll('.error-msg').forEach((c) => { c.textContent = ''; });
}
function aplicarErrosCampos(form, detalhes) {
    if (!detalhes || Array.isArray(detalhes) || typeof detalhes !== 'object') return;
    Object.entries(detalhes).forEach(([campo, msg]) => {
        const c = form.querySelector(`[name="${campo}"]`);
        if (c) marcarCampo(c, msg);
    });
}

export async function comBotao(botao, fn) {
    botao?.classList.add('is-loading');
    try {
        return await fn();
    } finally {
        botao?.classList.remove('is-loading');
    }
}

// ------------------------------------------------------------------ estados

export const skeletonLinhas = (n = 5) => Array.from({ length: n }, (_, i) => `<div class="skeleton line" style="width:${92 - (i % 3) * 18}%"></div>`).join('');
export const skeletonKpis = (n = 4) => `<div class="grid grid-4">${'<div class="skeleton kpi-sk"></div>'.repeat(n)}</div>`;
export const skeletonPagina = () => `${skeletonKpis()}<div class="grid grid-main mt-4"><div class="skeleton block"></div><div class="skeleton block"></div></div>`;

/**
 * Herói de palco da tela inicial de cada portal: foto de dança, título editorial
 * e a "contagem de 8" acendendo em sequência.
 * `titulo` e `destaque` são texto (escapados); `acoes` e `meta` são HTML confiável.
 */
export function heroPalco({ imagem, eyebrow, titulo, destaque = '', texto = '', acoes = '', meta = '' }) {
    const contagem = Array.from({ length: 8 }, (_, i) => `<span>${i + 1}</span>`).join('');
    return `<section class="stage-hero">
        <img class="stage-hero-img" src="${esc(imagem)}" alt="" decoding="async" fetchpriority="high">
        <div class="stage-hero-copy">
            <span class="eyebrow">${esc(eyebrow)}</span>
            <h1>${esc(titulo)}${destaque ? ` <em>${esc(destaque)}</em>` : ''}</h1>
            ${texto ? `<p>${esc(texto)}</p>` : ''}
            ${meta ? `<div class="stage-meta">${meta}</div>` : ''}
            ${acoes ? `<div class="page-actions">${acoes}</div>` : ''}
        </div>
        <div class="stage-count" aria-hidden="true">${contagem}</div>
    </section>`;
}

export const vazio = (icone, titulo, texto = '', acao = '') => `<div class="empty"><i class="fas ${icone}"></i><h4>${esc(titulo)}</h4>${texto ? `<p>${esc(texto)}</p>` : ''}${acao}</div>`;

export function erroBloco(e) {
    return `<div class="empty"><i class="fas fa-plug-circle-xmark"></i><h4>Não foi possível carregar</h4><p>${esc(e?.message || e)}</p><button class="btn btn-sm" data-retry>Tentar novamente</button></div>`;
}

export function debounce(fn, ms = 300) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}
