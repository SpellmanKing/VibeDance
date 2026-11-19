/**
 * Mural de avisos — a mesma tela em todos os portais (Aluno, Professor e ADM).
 * Quem pode publicar ganha o botão "Publicar aviso" e o editor com prévia ao vivo.
 */
import { api } from './api.js';
import { Session } from './session.js';
import { $, esc, html, raw, relativo, avatar, toastOk, modal, vazio } from './ui.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const chaveVistos = () => `vd-avisos-vistos-${Session.user?.id || 0}`;
function lerVistos() {
    try { return localStorage.getItem(chaveVistos()) || ''; } catch { return ''; }
}
function grupoData(v) {
    const d = new Date(v);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.floor((hoje - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    return dias <= 0 ? 'Hoje' : dias < 7 ? 'Esta semana' : dias < 31 ? 'Este mês' : 'Anteriores';
}

const tipo = (c) => (c.urgente ? 'urgente' : c.oficial ? 'estudio' : 'turma');
const ehMeu = (c) => !!Session.user?.nome && c.autorNome === Session.user.nome;
const etiqueta = (c) => (c.oficial && !c.turmaId
    ? '<span class="aviso-tag estudio"><i class="fas fa-building-columns"></i> Todo o estúdio</span>'
    : `<span class="aviso-tag ${c.oficial ? 'estudio' : 'turma'}"><i class="fas fa-music"></i> ${esc(c.turmaNome)}</span>`);
const perfilAutor = (p) => (p === 'ADMINISTRADOR' ? 'Administração' : p === 'PROFESSOR' ? 'Professor(a)' : 'Estúdio');
const autor = (c) => `<span class="aviso-autor">${avatar({ nome: c.autorNome }, 'sm')}<span><strong>${esc(c.autorNome)}</strong><small>${perfilAutor(c.autorPerfil)} · ${c.dataPostagem ? relativo(c.dataPostagem) : 'agora'}</small></span></span>`;
const anexo = (c) => (c.linkAnexo ? `<a class="aviso-anexo" href="${esc(c.linkAnexo)}" target="_blank" rel="noopener"><i class="fas fa-paperclip"></i> Abrir anexo</a>` : '');
const tags = (c, { destaque = false, novo = false } = {}) => `<div class="aviso-tags">${
    c.urgente ? '<span class="aviso-tag urgente"><i class="fas fa-bolt"></i> Urgente</span>' : destaque ? '<span class="aviso-tag">Mais recente</span>' : ''}${
    etiqueta(c)}${ehMeu(c) ? '<span class="aviso-tag meu"><i class="fas fa-pen-nib"></i> Publicado por você</span>' : ''}${
    novo ? '<span class="aviso-novo">Novo</span>' : ''}</div>`;

/** Cartão grande do topo (também usado na prévia do editor). */
export const cartaoDestaque = (c, novo = false) => `
    <article class="aviso-destaque is-${tipo(c)}">
        <div class="aviso-destaque-icone" aria-hidden="true"><i class="fas ${c.urgente ? 'fa-bullhorn' : c.oficial ? 'fa-star' : 'fa-music'}"></i></div>
        <div class="aviso-destaque-corpo">
            ${tags(c, { destaque: true, novo })}
            <h2>${esc(c.titulo)}</h2>
            <p class="aviso-texto">${esc(c.conteudo)}</p>
            <footer>${autor(c)}${anexo(c)}</footer>
        </div>
    </article>`;

/**
 * @param ctx      contexto da rota (el, params, navegar)
 * @param opcoes   { endpoint, rota, rotuloTurmas, descricao, publicar: { endpoint, turmasUrl, permiteEstudio } | null }
 */
export async function telaMural(ctx, { endpoint, rota = 'avisos', rotuloTurmas = 'Minhas turmas', descricao = '', publicar = null }) {
    const lista = await api.get(endpoint);
    const visto = lerVistos();
    const filtro = ctx.params.filtro || 'todos';
    const contagem = {
        todos: lista.length,
        urgente: lista.filter((c) => c.urgente).length,
        estudio: lista.filter((c) => c.oficial).length,
        turma: lista.filter((c) => !c.oficial).length,
    };
    const filtrados = lista.filter((c) => filtro === 'todos' || (filtro === 'urgente' ? c.urgente : filtro === 'estudio' ? c.oficial : !c.oficial));
    const destaque = filtrados.find((c) => c.urgente) || filtrados[0];
    const resto = filtrados.filter((c) => c !== destaque);
    const novo = (c) => !ehMeu(c) && c.dataPostagem && (!visto || String(c.dataPostagem) > visto);
    const novos = lista.filter(novo).length;
    const grupos = resto.reduce((acc, c) => ((acc[grupoData(c.dataPostagem)] ||= []).push(c), acc), {});
    const filtros = [
        ['todos', 'Todos', 'fa-layer-group'],
        ['urgente', 'Urgentes', 'fa-bolt'],
        ['estudio', 'Do estúdio', 'fa-building-columns'],
        ['turma', rotuloTurmas, 'fa-music'],
    ];

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Avisos</h1><p>${novos ? `${novos} novidade(s) desde a sua última visita.` : descricao}</p></div>
            ${raw(publicar ? '<div class="page-actions"><button class="btn btn-primary" data-publicar><i class="fas fa-bullhorn"></i> Publicar aviso</button></div>' : '')}
        </div>
        <nav class="mural-filtros" id="av-filtro" aria-label="Filtrar avisos">${raw(filtros.map(([v, l, i]) => `
            <button type="button" data-f="${v}" class="mural-filtro is-${v} ${filtro === v ? 'is-active' : ''}" aria-pressed="${filtro === v}">
                <i class="fas ${i}" aria-hidden="true"></i><span>${esc(l)}</span><b class="num">${contagem[v]}</b>
            </button>`).join(''))}</nav>
        ${raw(destaque ? cartaoDestaque(destaque, novo(destaque)) : `<div class="panel">${vazio('fa-bullhorn', filtro === 'todos' ? 'Nenhum aviso por enquanto' : 'Nada neste filtro',
            publicar ? 'Publique o primeiro aviso: ele aparece aqui e no sininho de quem recebe.' : 'Quando o estúdio ou seus professores publicarem algo, aparece aqui e no sininho.',
            publicar ? '<button class="btn btn-primary mt-4" data-publicar><i class="fas fa-bullhorn"></i> Publicar aviso</button>' : '')}</div>`)}
        ${raw(Object.entries(grupos).map(([g, itens]) => `
            <section class="aviso-grupo">
                <h4 class="aviso-grupo-titulo">${g}<span class="num">${itens.length}</span></h4>
                <div class="aviso-lista">${itens.map((c) => {
                    const d = new Date(c.dataPostagem);
                    return `<article class="aviso is-${tipo(c)} ${novo(c) ? 'is-novo' : ''}">
                        <time class="aviso-data" datetime="${esc(c.dataPostagem)}"><b class="num">${String(d.getDate()).padStart(2, '0')}</b><small>${MESES[d.getMonth()]}</small></time>
                        <div class="aviso-corpo">
                            ${tags(c, { novo: novo(c) })}
                            <h3>${esc(c.titulo)}</h3>
                            <p class="aviso-texto is-clamp">${esc(c.conteudo)}</p>
                            <footer>${autor(c)}<span class="row">${anexo(c)}<button type="button" class="aviso-mais" data-mais hidden>Ler mais</button></span></footer>
                        </div>
                    </article>`;
                }).join('')}</div>
            </section>`).join(''))}`;

    // "Ler mais" só onde o texto foi cortado
    ctx.el.querySelectorAll('.aviso-texto.is-clamp').forEach((p) => {
        if (p.scrollHeight > p.clientHeight + 2) p.closest('.aviso').querySelector('[data-mais]').hidden = false;
    });
    ctx.el.onclick = (e) => {
        if (publicar && e.target.closest('[data-publicar]')) return abrirEditor(publicar);
        const f = e.target.closest('#av-filtro [data-f]');
        if (f) return ctx.navegar(`#/${rota}${f.dataset.f === 'todos' ? '' : `?filtro=${f.dataset.f}`}`);
        const m = e.target.closest('[data-mais]');
        if (m) {
            const p = m.closest('.aviso').querySelector('.aviso-texto');
            const fechado = p.classList.toggle('is-clamp');
            m.textContent = fechado ? 'Ler mais' : 'Mostrar menos';
        }
        return undefined;
    };
    // Marca como visto depois que a pessoa teve tempo de ver as novidades
    const maisRecente = lista.reduce((a, c) => (String(c.dataPostagem) > a ? String(c.dataPostagem) : a), '');
    if (maisRecente && maisRecente > visto) {
        setTimeout(() => { try { localStorage.setItem(chaveVistos(), maisRecente); } catch { /* sem armazenamento */ } }, 2500);
    }
}

/** Editor de aviso com prévia ao vivo. */
export async function abrirEditor({ endpoint, turmasUrl, permiteEstudio = false }) {
    const turmas = await api.get(turmasUrl);
    const destinos = [
        ...(permiteEstudio ? [{ v: '', l: 'Todo o estúdio', s: 'Alunos, professores e equipe', i: 'fa-building-columns' }] : []),
        ...turmas.map((t) => ({ v: String(t.id), l: t.nome, s: 'Alunos com matrícula ativa', i: 'fa-music' })),
    ];
    if (!destinos.length) {
        modal({ titulo: 'Publicar aviso', confirmar: 'Fechar', corpo: vazio('fa-music', 'Você ainda não tem turmas', 'Os avisos de professor são enviados para uma das suas turmas.'), onSubmit: async () => {} });
        return;
    }
    const eu = Session.user || {};
    const m = modal({
        titulo: 'Publicar aviso',
        subtitulo: 'Quem recebe é avisado na hora pelo sininho.',
        confirmar: 'Publicar agora',
        largo: true,
        corpo: `<div class="mural-editor">
            <div class="mural-editor-campos">
                <fieldset class="field">
                    <legend>Para quem</legend>
                    <div class="mural-destinos">${destinos.map((d, i) => `
                        <label class="mural-destino"><input type="radio" name="turmaId" value="${esc(d.v)}" ${i === 0 ? 'checked' : ''}>
                            <i class="fas ${d.i}" aria-hidden="true"></i><span><strong>${esc(d.l)}</strong><small>${esc(d.s)}</small></span></label>`).join('')}</div>
                </fieldset>
                <div class="field"><label for="av-titulo">Título <small class="faint num" data-conta="titulo">0/150</small></label>
                    <input class="input" id="av-titulo" name="titulo" required maxlength="150" placeholder="Ex.: Ensaio extra no sábado"></div>
                <div class="field"><label for="av-texto">Mensagem</label>
                    <textarea class="input" id="av-texto" name="conteudo" rows="6" required placeholder="Escreva o recado com data, horário e o que levar, se for o caso."></textarea></div>
                <div class="field"><label for="av-link">Link de anexo <small class="faint">opcional</small></label>
                    <input class="input" id="av-link" name="linkAnexo" type="url" placeholder="https:// (playlist, vídeo, documento)"></div>
                <label class="check-item mural-urgente"><input type="checkbox" name="urgente" value="true">
                    <span class="grow"><strong>Marcar como urgente</strong><small>Fica no topo do mural e chega como alerta.</small></span><i class="fas fa-bolt" aria-hidden="true"></i></label>
            </div>
            <aside class="mural-previa" aria-live="polite">
                <p class="mural-previa-rotulo"><i class="fas fa-eye" aria-hidden="true"></i> Prévia de como vai aparecer</p>
                <div data-previa></div>
            </aside>
        </div>`,
        onSubmit: async (d) => {
            await api.post(endpoint, {
                titulo: d.titulo, conteudo: d.conteudo, linkAnexo: d.linkAnexo || null,
                urgente: d.urgente === 'true', turmaId: d.turmaId ? Number(d.turmaId) : null,
            }, { silencioso: true });
            toastOk('Aviso publicado', 'Quem recebe já foi notificado.');
        },
    });
    const form = m.form;
    const atualizar = () => {
        const v = Object.fromEntries(new FormData(form));
        const dest = destinos.find((x) => x.v === (v.turmaId ?? '')) || destinos[0];
        const estudio = dest.v === '';
        const previa = {
            titulo: v.titulo?.trim() || 'Título do aviso',
            conteudo: v.conteudo?.trim() || 'A mensagem aparece aqui enquanto você escreve.',
            linkAnexo: /^https?:\/\/\S+/.test(v.linkAnexo || '') ? v.linkAnexo : null,
            urgente: v.urgente === 'true',
            turmaId: estudio ? null : Number(dest.v),
            turmaNome: estudio ? 'Todo o estúdio' : dest.l,
            oficial: estudio || eu.perfil === 'ADMINISTRADOR',
            autorNome: eu.nome || 'Você',
            autorPerfil: eu.perfil,
            dataPostagem: null,
        };
        $('[data-previa]', m.el).innerHTML = cartaoDestaque(previa);
        $('[data-conta="titulo"]', m.el).textContent = `${(v.titulo || '').length}/150`;
    };
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    atualizar();
}
