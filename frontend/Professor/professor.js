/**
 * Workspace do Professor — Hoje no Estúdio, chamada digital de 1 clique,
 * turmas & avaliações técnicas, diário de classe, reposições e comunicados.
 */
import { api } from '../js/core/api.js';
import { criarPortal } from '../js/core/shell.js';
import { medidor } from '../js/core/charts.js';
import { telaMural, abrirEditor } from '../js/core/mural.js';
import {
    esc, html, raw, pct, data, dataLonga, dataCurta, dataHora, relativo, avatar, badge, toastOk, toast, modal, drawer,
    confirmar, comBotao, vazio, NIVEIS, isoHoje, parseData, heroPalco,
} from '../js/core/ui.js';

const P = '/api/professor/workspace';

// ======================================================================
// 1. Hoje no Estúdio
// ======================================================================
function inicioDaAula(aula) {
    const d = parseData(aula.data);
    const [h, m] = aula.inicio.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
}

function textoContagem(alvo) {
    const s = Math.floor((alvo - Date.now()) / 1000);
    if (s <= 0) return 'Agora';
    const d = Math.floor(s / 86400);
    if (d >= 1) return `${d}d ${String(Math.floor((s % 86400) / 3600)).padStart(2, '0')}h`;
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

async function telaHoje(ctx) {
    const h = await api.get(`${P}/hoje`);
    const prox = h.proxima;
    const situacaoTl = { EM_ANDAMENTO: 'is-live', PROXIMA: 'is-next', ENCERRADA: 'is-done' };

    ctx.el.innerHTML = html`
        ${raw(heroPalco({
            imagem: '../img/hero-professor.jpg',
            eyebrow: `Workspace · ${dataLonga(h.data)}`,
            titulo: 'Hoje no',
            destaque: 'estúdio',
            texto: h.aulas.length ? `Você tem ${h.aulas.length} aula(s) na agenda de hoje. Chamada, diário e reposições a um toque.` : 'Nenhuma aula na sua agenda hoje. Aproveite para revisar diários e avaliações.',
            meta: `<span><i class="fas fa-layer-group"></i> ${h.turmasAtivas} turmas</span><span><i class="fas fa-user-graduate"></i> ${h.alunosTotal} alunos</span><span><i class="fas fa-chart-simple"></i> ${pct(h.frequenciaMedia30d)} de frequência em 30 dias</span>`,
            acoes: `${prox && prox.data === h.data ? `<button class="btn btn-primary" data-chamada="${prox.turma.id}"><i class="fas fa-clipboard-check"></i> Abrir chamada</button>` : ''}
                <button class="btn" data-go="#/reposicoes"><i class="fas fa-rotate"></i> Reposições${h.reposicoesPendentes ? ` <span class="badge magenta plain">${h.reposicoesPendentes}</span>` : ''}</button>`,
        }))}

        <section class="grid grid-main">
            <article class="panel spotlight">
                ${raw(prox ? `
                <div class="row between wrap">
                    <div>
                        <span class="muted">${prox.situacao === 'EM_ANDAMENTO' ? 'Acontecendo agora' : prox.data === h.data ? 'Próxima aula começa em' : `Próxima aula · ${dataLonga(prox.data)}`}</span>
                        <div class="countdown" id="countdown" style="margin-top:6px">${prox.situacao === 'EM_ANDAMENTO' ? 'Em aula' : textoContagem(inicioDaAula(prox))}</div>
                    </div>
                    <div style="text-align:right">
                        <h2>${esc(prox.turma.nome)}</h2>
                        <p class="muted num">${esc(prox.inicio)}–${esc(prox.fim)} · ${esc(prox.turma.salaNome)}</p>
                    </div>
                </div>
                <div class="grid grid-3 mt-5">
                    <div><span class="faint">Alunos ativos</span><div class="kpi-value num">${prox.alunosAtivos}</div></div>
                    <div><span class="faint">Check-ins confirmados</span><div class="kpi-value num">${prox.confirmados}</div></div>
                    <div><span class="faint">Reposições aprovadas</span><div class="kpi-value num">${prox.reposicoes}</div></div>
                </div>
                ${prox.data === h.data ? `<div class="row mt-5"><button class="btn btn-primary" data-chamada="${prox.turma.id}"><i class="fas fa-clipboard-check"></i> Abrir chamada</button><button class="btn" data-diario="${prox.turma.id}"><i class="fas fa-book-open"></i> Registrar no diário</button></div>` : ''}` : vazio('fa-mug-hot', 'Sem aulas nos próximos 7 dias', 'Quando a administração alocar uma turma para você, ela aparece aqui na hora.'))}
            </article>
            <div class="grid grid-2" style="align-content:start">
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-layer-group"></i> Turmas</span><span class="kpi-value num">${h.turmasAtivas}</span></div>
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-user-graduate"></i> Alunos</span><span class="kpi-value num">${h.alunosTotal}</span></div>
                <div class="data-card kpi" style="grid-column:span 2"><span class="kpi-label"><i class="fas fa-chart-simple"></i> Frequência média (30 dias)</span><span class="kpi-value num">${pct(h.frequenciaMedia30d)}</span>${raw(medidor(h.frequenciaMedia30d))}</div>
            </div>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><h3>Linha do tempo de hoje</h3></div>
                ${raw(h.aulas.length ? `<div class="timeline">${h.aulas.map((a) => `
                    <div class="tl-item ${situacaoTl[a.situacao] || ''}">
                        <div class="data-card">
                            <div class="row between wrap">
                                <div><span class="tl-time">${esc(a.inicio)}</span> <span class="faint num">– ${esc(a.fim)}</span></div>
                                ${a.situacao === 'EM_ANDAMENTO' ? badge('PENDENTE', 'Em andamento') : a.situacao === 'ENCERRADA' ? badge(a.chamadaRealizada ? 'PRESENTE' : 'FALTA', a.chamadaRealizada ? `Chamada feita · ${a.presentes} presentes` : 'Chamada pendente') : badge('', 'A seguir')}
                            </div>
                            <div><strong>${esc(a.turma.nome)}</strong><br><small class="faint">${esc(a.turma.salaNome)} · ${a.alunosAtivos} alunos · ${a.confirmados} check-ins${a.reposicoes ? ` · ${a.reposicoes} reposição(ões)` : ''}</small></div>
                            <div class="row"><button class="btn btn-sm ${a.situacao !== 'PROXIMA' && !a.chamadaRealizada ? 'btn-primary' : ''}" data-chamada="${a.turma.id}"><i class="fas fa-clipboard-check"></i> Chamada</button><button class="btn btn-sm btn-ghost" data-diario="${a.turma.id}"><i class="fas fa-book-open"></i> Diário</button></div>
                        </div>
                    </div>`).join('')}</div>` : vazio('fa-calendar-day', 'Dia livre', 'Nenhuma das suas turmas tem aula hoje.'))}
            </article>
            <article class="panel">
                <div class="panel-head"><h3>Próximos 7 dias</h3></div>
                ${raw(h.semana.length ? h.semana.map((d) => `<div class="agenda-day"><h4>${esc(dataLonga(d.data))}</h4>${d.aulas.map((a) => `
                    <div class="agenda-item"><span class="t">${esc(a.inicio)}<small>${esc(a.fim)}</small></span><span><strong>${esc(a.turma.nome)}</strong><br><small class="faint">${esc(a.turma.salaNome)}</small></span><span class="faint num" title="Check-ins confirmados">${a.confirmados}/${a.alunosAtivos}</span></div>`).join('')}</div>`).join('') : vazio('fa-calendar', 'Semana livre'))}
            </article>
        </section>`;

    if (prox && prox.situacao !== 'EM_ANDAMENTO') {
        const alvo = inicioDaAula(prox);
        const timer = setInterval(() => {
            const el = document.getElementById('countdown');
            if (!el) return clearInterval(timer);
            el.textContent = textoContagem(alvo);
            if (alvo - Date.now() <= 0) { clearInterval(timer); ctx.recarregar(); }
            return undefined;
        }, 1000);
        ctx.onCleanup(() => clearInterval(timer));
    }

    ctx.el.onclick = (e) => {
        const c = e.target.closest('[data-chamada]');
        if (c) return ctx.navegar(`#/chamada?turma=${c.dataset.chamada}`);
        const d = e.target.closest('[data-diario]');
        if (d) return ctx.navegar(`#/diario?turma=${d.dataset.diario}`);
        const g = e.target.closest('[data-go]');
        if (g) return ctx.navegar(g.dataset.go);
        return undefined;
    };
}

// ======================================================================
// 2. Chamada digital (1 clique)
// ======================================================================
async function telaChamada(ctx) {
    const turmas = await api.get(`${P}/turmas`);
    if (!turmas.length) {
        ctx.el.innerHTML = vazio('fa-clipboard', 'Você ainda não tem turmas', 'A chamada fica disponível quando uma turma for atribuída a você.');
        return;
    }
    const turmaId = Number(ctx.params.turma) || turmas[0].id;
    const dia = ctx.params.data || isoHoje();
    const c = await api.get(`${P}/turmas/${turmaId}/chamada`, { query: { data: dia } });
    ctx.crumb(c.turma.nome);

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Chamada</h1><p>Um toque por aluno. Cada marcação vai direto para o histórico do aluno e para os relatórios do ADM.</p></div>
            <div class="page-actions">
                <select class="input" id="ch-turma" style="width:auto" aria-label="Turma">${raw(turmas.map((t) => `<option value="${t.id}" ${t.id === turmaId ? 'selected' : ''}>${esc(t.nome)}</option>`).join(''))}</select>
                <input class="input num" type="date" id="ch-data" value="${dia}" max="${isoHoje()}" style="width:auto" aria-label="Data da aula">
            </div>
        </div>
        ${raw(!c.diaDeAula ? `<div class="callout warn" style="margin-bottom:16px"><i class="fas fa-calendar-xmark"></i><span>${esc(c.turma.nome)} não tem aula em ${data(dia)} (${esc(c.turma.diasSemana)}). Você ainda pode registrar uma aula extra.</span></div>` : '')}
        <section class="grid grid-main">
            <article class="panel flush">
                <div class="table-tools">
                    <div><strong>${c.turma.nome}</strong><br><small class="faint num">${dataLonga(dia)} · ${c.turma.horarioInicio}–${c.turma.horarioFim} · ${c.turma.salaNome}</small></div>
                    <span class="topbar-spacer"></span>
                    <button class="btn btn-sm btn-ok" id="ch-todos" ${c.alunos.length ? '' : 'disabled'}><i class="fas fa-check-double"></i> Marcar pendentes como presentes</button>
                </div>
                <div class="roll" id="roll">${raw(c.alunos.map((a) => `
                    <div class="roll-item st-${a.status || 'NONE'}" data-aluno="${a.alunoId}">
                        <div class="cell-user" style="display:flex;align-items:center;gap:12px">${avatar(a, 'sm')}
                            <span><strong>${esc(a.nome)}</strong>
                            <small class="faint" style="display:block">${a.tipo !== 'MATRICULADO' ? `${badge(a.tipo)} ` : ''}${a.checkin ? '<i class="fas fa-circle-check ok"></i> confirmou presença · ' : ''}frequência ${pct(a.frequencia, 0)}${a.justificativa ? ` · “${esc(a.justificativa)}”` : ''}</small></span>
                        </div>
                        <div class="roll-toggle" role="group" aria-label="Presença de ${esc(a.nome)}">
                            <button data-st="PRESENTE" class="${a.status === 'PRESENTE' ? 'is-on' : ''}" title="Presente" aria-pressed="${a.status === 'PRESENTE'}"><i class="fas fa-check"></i></button>
                            <button data-st="FALTA" class="${a.status === 'FALTA' ? 'is-on' : ''}" title="Falta" aria-pressed="${a.status === 'FALTA'}"><i class="fas fa-xmark"></i></button>
                            <button data-st="JUSTIFICADO" class="${a.status === 'JUSTIFICADO' ? 'is-on' : ''}" title="Justificado" aria-pressed="${a.status === 'JUSTIFICADO'}"><i class="fas fa-file-medical"></i></button>
                        </div>
                    </div>`).join('') || vazio('fa-users-slash', 'Nenhum aluno nesta aula'))}</div>
            </article>
            <aside class="stack">
                <article class="panel" style="display:flex;gap:20px;align-items:center">
                    <div class="rate-ring" style="--p:${c.taxa}"><div>${pct(c.taxa, 0)}</div></div>
                    <div><h3>Taxa de presença</h3><p class="muted num">${c.presentes} presentes · ${c.faltas} faltas · ${c.justificados} justificados</p><p class="faint num">${c.pendentes} aluno(s) sem marcação</p></div>
                </article>
                <article class="panel">
                    <h3>Legenda</h3>
                    <ul class="list-plain mt-4">
                        <li><span class="badge ok">Presente</span> conta para a frequência</li>
                        <li><span class="badge danger">Falta</span> reduz a frequência e pode gerar alerta ao aluno</li>
                        <li><span class="badge warn">Justificado</span> não entra no cálculo</li>
                    </ul>
                </article>
            </aside>
        </section>`;

    document.getElementById('ch-turma').onchange = (e) => ctx.navegar(`#/chamada?turma=${e.target.value}&data=${dia}`);
    document.getElementById('ch-data').onchange = (e) => ctx.navegar(`#/chamada?turma=${turmaId}&data=${e.target.value}`);

    document.getElementById('roll').onclick = async (e) => {
        const b = e.target.closest('[data-st]');
        if (!b) return;
        const linha = b.closest('[data-aluno]');
        const alunoId = Number(linha.dataset.aluno);
        let justificativa = null;
        if (b.dataset.st === 'JUSTIFICADO') {
            const r = await confirmar({ titulo: 'Falta justificada', texto: 'Registre o motivo informado pelo aluno.', confirmar: 'Registrar', motivo: true, rotuloMotivo: 'Justificativa (opcional)' });
            if (r === false) return;
            justificativa = r || null;
        }
        // Feedback otimista; o estado definitivo vem do servidor logo em seguida
        linha.className = `roll-item st-${b.dataset.st}`;
        linha.querySelectorAll('[data-st]').forEach((x) => x.classList.toggle('is-on', x === b));
        try {
            await api.put(`${P}/turmas/${turmaId}/chamada/${alunoId}`, { data: dia, status: b.dataset.st, justificativa });
            ctx.recarregar();
        } catch {
            ctx.recarregar();
        }
    };
    document.getElementById('ch-todos').onclick = (e) => comBotao(e.currentTarget, async () => {
        const pendentes = c.alunos.filter((a) => !a.status);
        if (!pendentes.length) {
            toast('Nenhum aluno pendente', { texto: 'Todos já têm marcação nesta aula.' });
            return;
        }
        const r = await api.put(`${P}/turmas/${turmaId}/chamada`, { data: dia, registros: pendentes.map((a) => ({ alunoId: a.alunoId, status: 'PRESENTE' })) });
        toastOk('Chamada registrada', `Presença de ${pct(r.taxa, 0)} em ${c.turma.nome}.`);
        ctx.recarregar();
    });
}

// ======================================================================
// 3. Minhas turmas + avaliações técnicas
// ======================================================================
async function telaTurmas(ctx) {
    const turmas = await api.get(`${P}/turmas`);
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Minhas turmas</h1><p>Alunos, frequência e avaliações técnicas de cada turma.</p></div></div>
        <div class="grid grid-3">${raw(turmas.map((t) => `
            <button class="data-card" data-turma="${t.id}">
                <div class="row between"><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}" style="color:var(--amber);font-size:1.2rem"></i>${badge('', NIVEIS[t.nivel] || t.nivel)}</div>
                <div><h3>${esc(t.nome)}</h3><p class="muted num">${esc(t.diasSemana)} · ${esc(t.horarioInicio)}–${esc(t.horarioFim)}</p><p class="faint">${esc(t.salaNome)}</p></div>
                <div class="row between"><span class="faint">Lotação</span><b class="num">${t.ocupadas}/${t.limiteVagas}</b></div>
                <div class="meter signal"><span style="width:${Math.min(100, (t.ocupadas / t.limiteVagas) * 100)}%"></span></div>
            </button>`).join('') || vazio('fa-layer-group', 'Nenhuma turma atribuída'))}</div>`;
    ctx.el.onclick = (e) => {
        const b = e.target.closest('[data-turma]');
        if (b) abrirTurma(Number(b.dataset.turma));
    };
    if (ctx.params.turma && !ctx.suave) abrirTurma(Number(ctx.params.turma));
}

function abrirTurma(id) {
    drawer({
        titulo: 'Turma',
        largura: 620,
        render: async (body, d) => {
            const [det, avaliacoes] = await Promise.all([api.get(`${P}/turmas/${id}`), api.get(`${P}/turmas/${id}/avaliacoes`)]);
            const t = det.turma;
            d.titulo(t.nome, `${t.diasSemana} · ${t.horarioInicio}–${t.horarioFim} · ${t.salaNome}`);
            body.innerHTML = html`
                <div class="grid grid-2">
                    <div class="data-card kpi"><span class="kpi-label">Frequência da turma</span><span class="kpi-value num">${pct(det.frequenciaMedia)}</span>${raw(medidor(det.frequenciaMedia))}</div>
                    <div class="data-card kpi"><span class="kpi-label">Próximas aulas</span><span class="num" style="font-weight:700">${det.proximasAulas.slice(0, 3).map((x) => dataCurta(x)).join(' · ') || '—'}</span></div>
                </div>
                <section><h4 style="margin-bottom:8px">Alunos</h4>
                <ul class="list-plain">${raw(det.alunos.map((a) => `<li>${avatar(a, 'sm')}<span style="flex:1;min-width:0">${esc(a.nome)}<br><small class="faint">${a.faltas} falta(s)${a.ultimaMedia !== null ? ` · última média ${a.ultimaMedia}` : ''}</small></span><span style="width:90px">${medidor(a.frequencia)}</span><b class="num" style="width:44px;text-align:right">${pct(a.frequencia, 0)}</b><button class="btn btn-sm" data-avaliar="${a.alunoId}" data-nome="${esc(a.nome)}"><i class="fas fa-star-half-stroke"></i> Avaliar</button></li>`).join('') || '<li class="faint">Nenhum aluno matriculado.</li>')}</ul></section>
                <section><h4 style="margin-bottom:8px">Avaliações enviadas</h4>
                <div class="feed">${raw(avaliacoes.map((a) => `<div class="feed-item"><header><strong>${esc(a.alunoNome)}</strong><span class="badge cyan plain num">média ${a.media}</span></header><p class="muted">${esc(a.coreografia)}</p><p class="meta">${dataHora(a.data)}</p></div>`).join('') || '<p class="faint">Nenhuma avaliação ainda.</p>')}</div></section>`;
            d.acoes(`<button class="btn" data-go="#/diario?turma=${t.id}"><i class="fas fa-book-open"></i> Diário</button><button class="btn btn-primary" data-go="#/chamada?turma=${t.id}"><i class="fas fa-clipboard-check"></i> Chamada</button>`);
            body.onclick = (e) => {
                const b = e.target.closest('[data-avaliar]');
                if (b) formAvaliacao(t, Number(b.dataset.avaliar), b.dataset.nome);
            };
            d.foot.onclick = (e) => {
                const g = e.target.closest('[data-go]');
                if (g) { d.fechar(); location.hash = g.dataset.go; }
            };
        },
    });
}

function campoNota(nome, rotulo) {
    return `<div class="field"><label for="n-${nome}">${rotulo} <b class="num" id="v-${nome}">8.0</b></label><input type="range" id="n-${nome}" name="${nome}" min="0" max="10" step="0.5" value="8" style="accent-color:var(--accent)"></div>`;
}

function formAvaliacao(turma, alunoId, alunoNome) {
    modal({
        titulo: `Avaliar ${alunoNome}`,
        subtitulo: turma.nome,
        confirmar: 'Enviar avaliação',
        etapas: [
            { titulo: 'Foco', html: '<div class="field"><label for="av-cor">Coreografia ou sequência avaliada</label><input class="input" id="av-cor" name="coreografiaFoco" required placeholder="Ex.: Bloco A — 16 tempos"></div><div class="field mt-4"><label for="av-link">Vídeo ou referência (opcional)</label><input class="input" id="av-link" name="linkReferencia" type="url" placeholder="https://"></div>' },
            { titulo: 'Notas', html: `<div class="form-grid">${campoNota('notaRitmo', 'Ritmo')}${campoNota('notaTecnica', 'Técnica')}${campoNota('notaExpressao', 'Expressão')}${campoNota('notaCoreografia', 'Coreografia')}</div>` },
            { titulo: 'Feedback', html: '<div class="field"><label for="av-fb">Feedback para o aluno</label><textarea class="input" id="av-fb" name="feedbackTexto" rows="6" required minlength="10" placeholder="O que evoluiu e qual o próximo foco de treino."></textarea></div>' },
        ],
        onAbrir: (form) => form.addEventListener('input', (e) => {
            if (e.target.type === 'range') document.getElementById(`v-${e.target.name}`).textContent = Number(e.target.value).toFixed(1);
        }),
        onSubmit: async (d) => {
            await api.post(`${P}/avaliacoes`, {
                turmaId: turma.id, alunoId, coreografiaFoco: d.coreografiaFoco, linkReferencia: d.linkReferencia || null,
                notaRitmo: Number(d.notaRitmo), notaTecnica: Number(d.notaTecnica), notaExpressao: Number(d.notaExpressao), notaCoreografia: Number(d.notaCoreografia),
                feedbackTexto: d.feedbackTexto,
            }, { silencioso: true });
            toastOk('Avaliação enviada', `${alunoNome} já vê o feedback no Hub de Evolução.`);
        },
    });
}

// ======================================================================
// 4. Diário de classe & repertório
// ======================================================================
async function telaDiario(ctx) {
    const turmas = await api.get(`${P}/turmas`);
    if (!turmas.length) {
        ctx.el.innerHTML = vazio('fa-book', 'Nenhuma turma atribuída');
        return;
    }
    const turmaId = Number(ctx.params.turma) || turmas[0].id;
    const turma = turmas.find((t) => t.id === turmaId) || turmas[0];
    const registros = await api.get(`${P}/turmas/${turma.id}/diario`);
    ctx.crumb(turma.nome);
    const hoje = registros.find((r) => r.data === isoHoje());

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Diário de classe</h1><p>Conteúdo trabalhado, coreografias e referências. Os alunos veem o repertório no Hub de Evolução.</p></div>
            <div class="page-actions"><select class="input" id="di-turma" style="width:auto" aria-label="Turma">${raw(turmas.map((t) => `<option value="${t.id}" ${t.id === turma.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join(''))}</select></div>
        </div>
        <section class="grid grid-main">
            <article class="panel">
                <div class="panel-head"><h3>Registros</h3><span class="muted num">${registros.length}</span></div>
                <div class="feed">${raw(registros.map((r) => `
                    <div class="feed-item">
                        <header><div><strong class="num">${esc(dataLonga(r.data))}</strong>${r.coreografia ? ` · <span class="badge magenta plain">${esc(r.coreografia)}</span>` : ''}</div>
                        <div class="row"><button class="btn btn-sm btn-ghost" data-editar="${r.id}" aria-label="Editar"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-ghost" data-excluir="${r.id}" aria-label="Excluir"><i class="fas fa-trash"></i></button></div></header>
                        <p style="white-space:pre-line">${esc(r.conteudo)}</p>
                        ${r.links.length ? `<p class="meta mt-4">${r.links.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> ${esc(l.replace(/^https?:\/\//, '').slice(0, 48))}</a>`).join(' · ')}</p>` : ''}
                        ${r.observacoes ? `<p class="meta">${esc(r.observacoes)}</p>` : ''}
                    </div>`).join('') || vazio('fa-book-open', 'Nenhum registro ainda', 'Registre a aula de hoje ao lado.'))}</div>
            </article>
            <article class="panel">
                <div class="panel-head"><h3 id="di-form-titulo">${hoje ? 'Editar registro de hoje' : 'Registrar aula'}</h3></div>
                <form id="di-form" class="stack" novalidate>
                    <div class="field"><label for="di-data">Data da aula</label><input class="input num" type="date" id="di-data" name="data" value="${isoHoje()}" max="${isoHoje()}" required></div>
                    <div class="field"><label for="di-cont">Conteúdo trabalhado</label><textarea class="input" id="di-cont" name="conteudo" rows="5" required>${hoje?.conteudo || ''}</textarea></div>
                    <div class="field"><label for="di-cor">Coreografia (repertório)</label><input class="input" id="di-cor" name="coreografia" value="${hoje?.coreografia || ''}" placeholder="Opcional"></div>
                    <div class="field"><label for="di-links">Links de referência</label><textarea class="input" id="di-links" name="links" rows="3" placeholder="Um link por linha (vídeos, playlists)">${(hoje?.links || []).join('\n')}</textarea></div>
                    <div class="field"><label for="di-obs">Observações</label><input class="input" id="di-obs" name="observacoes" value="${hoje?.observacoes || ''}"></div>
                    <button class="btn btn-primary" type="submit">Salvar no diário</button>
                </form>
            </article>
        </section>`;

    document.getElementById('di-turma').onchange = (e) => ctx.navegar(`#/diario?turma=${e.target.value}`);
    const form = document.getElementById('di-form');
    form.onsubmit = (e) => {
        e.preventDefault();
        if (!form.conteudo.value.trim()) {
            form.conteudo.classList.add('is-invalid');
            form.conteudo.focus();
            return;
        }
        comBotao(form.querySelector('[type=submit]'), async () => {
            await api.put(`${P}/turmas/${turma.id}/diario`, {
                data: form.data.value, conteudo: form.conteudo.value, coreografia: form.coreografia.value || null,
                links: form.links.value.split('\n').map((l) => l.trim()).filter(Boolean), observacoes: form.observacoes.value || null,
            });
            toastOk('Diário salvo', `${turma.nome} · ${data(form.data.value)}`);
        });
    };
    ctx.el.querySelector('.feed').onclick = async (e) => {
        const ed = e.target.closest('[data-editar]');
        if (ed) {
            const r = registros.find((x) => String(x.id) === ed.dataset.editar);
            form.data.value = r.data;
            form.conteudo.value = r.conteudo;
            form.coreografia.value = r.coreografia || '';
            form.links.value = r.links.join('\n');
            form.observacoes.value = r.observacoes || '';
            document.getElementById('di-form-titulo').textContent = `Editar registro de ${data(r.data)}`;
            form.conteudo.focus();
        }
        const ex = e.target.closest('[data-excluir]');
        if (ex) {
            const ok = await confirmar({ titulo: 'Excluir registro?', texto: 'O registro sai do repertório visto pelos alunos.', confirmar: 'Excluir', perigo: true });
            if (!ok) return;
            await api.del(`${P}/diario/${ex.dataset.excluir}`);
            toastOk('Registro excluído');
        }
    };
}

// ======================================================================
// 5. Reposições
// ======================================================================
async function telaReposicoes(ctx) {
    const lista = await api.get(`${P}/reposicoes`);
    const pendentes = lista.filter((r) => r.status === 'SOLICITADA');
    const outras = lista.filter((r) => r.status !== 'SOLICITADA');
    const card = (r) => `
        <div class="feed-item">
            <header><div><strong>${esc(r.alunoNome)}</strong> ${badge(r.tipo)}</div>${badge(r.status)}</header>
            <p><span class="num">${esc(dataLonga(r.dataAulaDestino))} · ${esc(r.horario || '')}</span> em <strong>${esc(r.turmaDestinoNome)}</strong></p>
            <p class="meta">${r.turmaOrigemNome ? `Turma de origem: ${esc(r.turmaOrigemNome)}${r.dataFalta ? ` (falta em ${data(r.dataFalta)})` : ''} · ` : ''}solicitado ${relativo(r.solicitadoEm)}</p>
            ${r.motivo ? `<p class="muted mt-4">“${esc(r.motivo)}”</p>` : ''}
            ${r.resposta ? `<p class="meta mt-4">Resposta: ${esc(r.resposta)}</p>` : ''}
            ${r.status === 'SOLICITADA' ? `<div class="row mt-4"><button class="btn btn-sm btn-ok" data-aprovar="${r.id}"><i class="fas fa-check"></i> Aprovar</button><button class="btn btn-sm btn-danger" data-recusar="${r.id}"><i class="fas fa-xmark"></i> Recusar</button></div>` : ''}
        </div>`;
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Reposições e experimentais</h1><p>Alunos que pediram para fazer aula nas suas turmas. Ao aprovar, eles entram na sua chamada daquela data.</p></div></div>
        <section class="grid grid-2">
            <article class="panel"><div class="panel-head"><h3>Aguardando sua decisão</h3><span class="badge magenta plain num">${pendentes.length}</span></div><div class="feed">${raw(pendentes.map(card).join('') || vazio('fa-inbox', 'Nada pendente', 'Novos pedidos aparecem aqui e no sininho.'))}</div></article>
            <article class="panel"><div class="panel-head"><h3>Agendadas e recentes</h3></div><div class="feed">${raw(outras.map(card).join('') || vazio('fa-clock-rotate-left', 'Sem histórico recente'))}</div></article>
        </section>`;
    ctx.el.onclick = async (e) => {
        const ap = e.target.closest('[data-aprovar]');
        const rc = e.target.closest('[data-recusar]');
        if (!ap && !rc) return;
        const id = (ap || rc).dataset.aprovar || (ap || rc).dataset.recusar;
        const resposta = await confirmar({
            titulo: ap ? 'Aprovar solicitação' : 'Recusar solicitação',
            texto: ap ? 'A vaga da data é reservada e o aluno é avisado.' : 'Explique o motivo para o aluno.',
            confirmar: ap ? 'Aprovar' : 'Recusar', perigo: !ap, motivo: true, motivoObrigatorio: !ap,
            rotuloMotivo: ap ? 'Mensagem ao aluno (opcional)' : 'Motivo',
        });
        if (resposta === false) return;
        await api.post(`${P}/reposicoes/${id}/${ap ? 'aprovar' : 'recusar'}`, { resposta: resposta || null });
        toastOk(ap ? 'Solicitação aprovada' : 'Solicitação recusada', 'O aluno foi notificado.');
    };
}

// ======================================================================
// 6. Comunicados
// ======================================================================
const telaComunicados = (ctx) => telaMural(ctx, {
    endpoint: `${P}/comunicados`,
    descricao: 'Comunicados do estúdio e das suas turmas. Publique recados para os seus alunos.',
    publicar: { endpoint: `${P}/comunicados`, turmasUrl: `${P}/turmas` },
});

// ======================================================================
// Portal
// ======================================================================
criarPortal({
    perfis: ['PROFESSOR', 'ADMINISTRADOR'],
    nome: 'Workspace do Professor',
    icone: 'fa-wave-square',
    inicial: 'hoje',
    rotas: [
        { id: 'hoje', titulo: 'Hoje no estúdio', icone: 'fa-sun', grupo: 'Aulas', dominios: ['presencas', 'checkins', 'reposicoes', 'turmas', 'matriculas'], render: telaHoje },
        { id: 'chamada', titulo: 'Chamada', icone: 'fa-clipboard-check', grupo: 'Aulas', dominios: ['presencas', 'checkins', 'reposicoes', 'matriculas'], render: telaChamada },
        { id: 'turmas', titulo: 'Minhas turmas', icone: 'fa-layer-group', grupo: 'Didática', dominios: ['turmas', 'matriculas', 'avaliacoes'], render: telaTurmas },
        { id: 'diario', titulo: 'Diário de classe', icone: 'fa-book-open', grupo: 'Didática', dominios: ['diario'], render: telaDiario },
        { id: 'reposicoes', titulo: 'Reposições', icone: 'fa-rotate', grupo: 'Didática', dominios: ['reposicoes'], render: telaReposicoes },
        { id: 'avisos', titulo: 'Avisos', icone: 'fa-bullhorn', grupo: 'Comunicação', dominios: ['comunicados'], render: telaComunicados },
    ],
    comandos: [
        { titulo: 'Abrir chamada de hoje', icone: 'fa-clipboard-check', acao: () => { location.hash = '#/chamada'; } },
        { titulo: 'Registrar aula no diário', icone: 'fa-book-open', acao: () => { location.hash = '#/diario'; } },
        { titulo: 'Publicar aviso', icone: 'fa-bullhorn', acao: () => abrirEditor({ endpoint: `${P}/comunicados`, turmasUrl: `${P}/turmas` }) },
    ],
    aoIniciar: {
        contadores: async () => {
            const rep = await api.get(`${P}/reposicoes`, { silencioso: true });
            return { reposicoes: rep.filter((r) => r.status === 'SOLICITADA').length };
        },
    },
});
