/**
 * Cockpit do Administrador — dashboard executivo, grade horária, financeiro,
 * usuários & matrículas, reposições, comunicados, catálogo e auditoria.
 * Todos os dados vêm da API; o shell recarrega cada tela quando o banco muda.
 */
import { api } from '../js/core/api.js';
import { criarPortal } from '../js/core/shell.js';
import { SmartTable } from '../js/core/table.js';
import { renderTimetable } from '../js/core/timetable.js';
import { barrasAgrupadas, rosca, medidor } from '../js/core/charts.js';
import { planilhaFinanceira } from '../js/core/planilha.js';
import { telaMural, abrirEditor } from '../js/core/mural.js';
import { formCobranca, formAjuste, valorComDesconto, rotuloMotivo } from './cobranca.js';
import {
    $, esc, html, raw, moeda, pct, num, data, dataHora, relativo, avatar, badge, toastOk, modal, drawer, confirmar,
    comBotao, vazio, DIAS, NIVEIS, debounce, heroPalco,
} from '../js/core/ui.js';

const A = '/api/admin';

// ======================================================================
// Dados de referência (sempre lidos do banco ao abrir formulários)
// ======================================================================
async function referencias() {
    const [modalidades, salas, professores, turmas] = await Promise.all([
        api.get(`${A}/modalidades`), api.get(`${A}/salas`),
        api.get(`${A}/usuarios`, { query: { perfil: 'PROFESSOR', status: 'ATIVO' } }), api.get(`${A}/turmas`),
    ]);
    return { modalidades, salas, professores, turmas };
}

/** Lotação: quanto mais cheia, mais quente a cor (inverso da frequência). */
const lotacao = (p) => `<div class="meter ${p >= 90 ? 'danger' : p >= 70 ? 'warn' : 'ok'}"><span style="width:${Math.min(100, p)}%"></span></div>`;

const opcoes = (lista, valor, rotulo, selecionado, vazioTxt) =>
    (vazioTxt !== undefined ? `<option value="">${esc(vazioTxt)}</option>` : '')
    + lista.map((x) => `<option value="${esc(x[valor])}" ${String(x[valor]) === String(selecionado ?? '') ? 'selected' : ''}>${esc(rotulo(x))}</option>`).join('');

// ======================================================================
// 1. Dashboard executivo
// ======================================================================
async function telaDashboard(ctx) {
    const d = await api.get(`${A}/dashboard`);
    const variacao = d.variacaoMrr === 0 ? '<span class="faint">estável vs. mês anterior</span>'
        : `<span class="${d.variacaoMrr > 0 ? 'trend-up' : 'trend-down'}"><i class="fas fa-arrow-${d.variacaoMrr > 0 ? 'up' : 'down'}"></i> ${pct(Math.abs(d.variacaoMrr))}</span> vs. mês anterior`;
    const totalAlunosMod = d.distribuicaoModalidades.reduce((a, f) => a + f.valor, 0);

    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    ctx.el.innerHTML = html`
        ${raw(heroPalco({
            imagem: '../img/hero-admin.jpg',
            eyebrow: `Cockpit · ${hoje}`,
            titulo: 'Visão do',
            destaque: 'estúdio',
            texto: 'Receita, inadimplência, ocupação e retenção calculadas agora a partir do banco.',
            meta: `<span><i class="fas fa-user-graduate"></i> ${num(d.alunosAtivos)} alunos</span><span><i class="fas fa-chalkboard-user"></i> ${num(d.professoresAtivos)} professores</span><span><i class="fas fa-layer-group"></i> ${num(d.turmasAtivas)} turmas ativas</span>`,
            acoes: `<button class="btn btn-primary" data-acao="nova-turma"><i class="fas fa-plus"></i> Nova turma</button>
                <button class="btn" data-go="#/financeiro"><i class="fas fa-file-invoice-dollar"></i> Gerar mensalidades</button>`,
        }))}

        <section class="grid grid-4">
            <button class="data-card kpi is-hero" data-go="#/financeiro">
                <span class="kpi-label"><i class="fas fa-chart-line"></i> Receita mensal recorrente</span>
                <span class="kpi-value num">${moeda(d.mrr)}</span>
                <span class="kpi-foot">${raw(variacao)}</span>
            </button>
            <button class="data-card kpi" data-go="#/financeiro?status=VENCIDO">
                <span class="kpi-label"><i class="fas fa-triangle-exclamation"></i> Inadimplência</span>
                <span class="kpi-value num ${d.inadimplencia > 15 ? 'danger' : ''}">${pct(d.inadimplencia)}</span>
                <span class="kpi-foot num">${moeda(d.valorEmAberto)} em aberto</span>
            </button>
            <button class="data-card kpi" data-go="#/grade">
                <span class="kpi-label"><i class="fas fa-door-open"></i> Ocupação média das turmas</span>
                <span class="kpi-value num">${pct(d.ocupacaoMedia)}</span>
                ${raw(medidor(d.ocupacaoMedia, { limiteOk: 60, limiteAtencao: 35 }))}
            </button>
            <button class="data-card kpi" data-go="#/usuarios?perfil=ALUNO">
                <span class="kpi-label"><i class="fas fa-heart-pulse"></i> Retenção de alunos</span>
                <span class="kpi-value num">${pct(d.retencao)}</span>
                <span class="kpi-foot num">${num(d.alunosAtivos)} alunos · ${num(d.professoresAtivos)} professores · ${num(d.turmasAtivas)} turmas</span>
            </button>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head">
                    <div><h3>Evolução financeira</h3><span class="muted">Recebido × faturado nos últimos 6 meses</span></div>
                    <div class="legend"><span><i style="background:#E8A653"></i>Recebido</span><span><i style="background:#F4ECE1;opacity:.35"></i>Faturado</span></div>
                </div>
                ${raw(barrasAgrupadas(d.receitaMensal.map((p) => ({ rotulo: p.rotulo, recebido: p.valor, faturado: p.previsto })), {
                    series: [{ chave: 'recebido', rotulo: 'Recebido', cor: '#E8A653' }, { chave: 'faturado', rotulo: 'Faturado', cor: '#F4ECE1', opacidade: 0.35 }],
                }))}
            </article>
            <article class="panel">
                <div class="panel-head"><div><h3>Alunos por modalidade</h3><span class="muted">Matrículas ativas</span></div></div>
                ${raw(d.distribuicaoModalidades.length ? rosca(d.distribuicaoModalidades.map((f) => ({ rotulo: f.rotulo, valor: f.valor })), { valorCentro: String(totalAlunosMod), rotuloCentro: 'matrículas' }) : vazio('fa-chart-pie', 'Sem matrículas ativas'))}
            </article>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><div><h3>Lotação por turma</h3><span class="muted">Clique para inspecionar a turma</span></div></div>
                <div>${raw(d.ocupacaoTurmas.map((o) => `
                    <button class="meter-row btn-ghost" style="width:100%;border:0;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left" data-turma="${o.turmaId}">
                        <span>${esc(o.nome)}</span>${lotacao(o.percentual)}<b>${o.ocupadas}/${o.limite}</b>
                    </button>`).join('') || vazio('fa-layer-group', 'Nenhuma turma ativa'))}</div>
            </article>
            <div class="stack">
                <article class="panel">
                    <div class="panel-head"><h3>Pendências</h3></div>
                    <ul class="list-plain">
                        <li><i class="fas fa-rotate warn"></i><span><b class="num">${d.reposicoesPendentes}</b> reposição(ões) aguardando aprovação</span><button class="btn btn-sm" style="margin-left:auto" data-go="#/reposicoes">Revisar</button></li>
                        <li><i class="fas fa-receipt" style="color:var(--info)"></i><span><b class="num">${d.comprovantesEmAnalise}</b> comprovante(s) para conferir</span><button class="btn btn-sm" style="margin-left:auto" data-go="#/financeiro?aba=comprovantes">Conferir</button></li>
                    </ul>
                </article>
                <article class="panel">
                    <div class="panel-head"><h3>Últimas ações</h3><button class="btn btn-sm btn-ghost" data-go="#/auditoria">Ver log</button></div>
                    <ul class="list-plain">${raw(d.ultimasAcoes.map((a) => `<li><span class="badge plain">${esc(a.acao)}</span><span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.descricao || a.entidade)}</span><small class="faint">${esc(a.usuarioNome || 'Sistema')} · ${relativo(a.dataHora)}</small></span></li>`).join('') || '<li class="faint">Sem registros.</li>')}</ul>
                </article>
            </div>
        </section>`;

    ctx.el.onclick = (e) => {
        const go = e.target.closest('[data-go]');
        if (go) return ctx.navegar(go.dataset.go);
        const t = e.target.closest('[data-turma]');
        if (t) return abrirTurma(Number(t.dataset.turma));
        if (e.target.closest('[data-acao="nova-turma"]')) return formTurma();
        return undefined;
    };
}

// ======================================================================
// 2. Grade horária
// ======================================================================
async function telaGrade(ctx) {
    const g = await api.get(`${A}/grade`);
    const filtroSala = ctx.params.sala || '';
    const turmas = filtroSala ? g.turmas.filter((t) => String(t.salaId) === filtroSala) : g.turmas;
    const idsConflito = new Set(g.conflitos.flatMap((c) => [c.turmaId]));

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Grade horária</h1><p>Matriz semanal de salas, professores e lotação. Conflitos de sala e professor são bloqueados ao salvar.</p></div>
            <div class="page-actions"><button class="btn btn-primary" data-acao="nova"><i class="fas fa-plus"></i> Nova turma</button></div>
        </div>
        ${raw(g.conflitos.length ? `<div class="callout danger" style="margin-bottom:16px"><i class="fas fa-triangle-exclamation"></i><div><strong>${g.conflitos.length} conflito(s) na grade atual</strong><ul class="clean">${g.conflitos.map((c) => `<li>${esc(c.mensagem)}</li>`).join('')}</ul></div></div>` : '')}
        <div class="panel flush">
            <div class="table-tools">
                <div class="segmented" role="group" aria-label="Filtrar por sala">
                    <button class="${!filtroSala ? 'is-active' : ''}" data-sala="">Todas as salas</button>
                    ${raw(g.salas.map((s) => `<button class="${filtroSala === String(s.id) ? 'is-active' : ''}" data-sala="${s.id}">${esc(s.nome)}</button>`).join(''))}
                </div>
                <span class="topbar-spacer"></span>
                <span class="muted num">${turmas.length} turma(s) ativas</span>
            </div>
            <div class="table-wrap" style="max-height:72vh">${raw(turmas.length ? renderTimetable(turmas, { conflitos: idsConflito }) : vazio('fa-calendar-plus', 'Nenhuma turma nesta sala', 'Crie uma turma para preencher a grade.'))}</div>
        </div>
        <div class="panel flush mt-4">
            <div class="panel-head"><h3>Todas as turmas</h3></div>
            <div id="tbl-turmas"></div>
        </div>`;

    const tabela = new SmartTable({
        el: $('#tbl-turmas'),
        colunas: [
            { chave: 'nome', titulo: 'Turma', render: (t) => `<strong>${esc(t.nome)}</strong><br><small class="faint">${esc(t.modalidadeNome)} · ${esc(NIVEIS[t.nivel] || t.nivel)}</small>` },
            { chave: 'diasSemana', titulo: 'Quando', render: (t) => `${esc(t.diasSemana)}<br><small class="faint num">${esc(t.horarioInicio)}–${esc(t.horarioFim)}</small>` },
            { chave: 'professorNome', titulo: 'Professor' },
            { chave: 'salaNome', titulo: 'Sala' },
            { chave: 'ocupadas', titulo: 'Lotação', num: true, valor: (t) => t.ocupadas / t.limiteVagas, render: (t) => `<span class="num">${t.ocupadas}/${t.limiteVagas}</span>` },
            { titulo: '', ordenavel: false, render: () => '<div class="row-actions"><button class="btn btn-sm btn-ghost" data-acao="editar" title="Editar"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-ghost" data-acao="encerrar" title="Encerrar turma"><i class="fas fa-box-archive"></i></button></div>' },
        ],
        porPagina: 8,
        onLinha: (t) => abrirTurma(t.id),
    });
    tabela.setDados(g.turmas);
    tabela.el.addEventListener('acao', (e) => {
        const { acao, item } = e.detail;
        if (acao === 'editar') formTurma(item);
        if (acao === 'encerrar') encerrarTurma(item);
    });

    ctx.el.onclick = (e) => {
        const s = e.target.closest('[data-sala]');
        if (s) return ctx.navegar(`#/grade${s.dataset.sala ? `?sala=${s.dataset.sala}` : ''}`);
        const ev = e.target.closest('.tt-event');
        if (ev) return abrirTurma(Number(ev.dataset.turma));
        if (e.target.closest('[data-acao="nova"]')) return formTurma();
        return undefined;
    };
    if (ctx.params.turma && !ctx.suave) abrirTurma(Number(ctx.params.turma));
}

async function encerrarTurma(t) {
    const ok = await confirmar({ titulo: `Encerrar "${t.nome}"?`, texto: 'A turma sai da grade e alunos e professor são notificados. O histórico de presença e financeiro é preservado.', confirmar: 'Encerrar turma', perigo: true });
    if (!ok) return;
    await api.del(`${A}/turmas/${t.id}`);
    toastOk('Turma encerrada', t.nome);
}

/** Modal multi-etapas de turma com validação de conflito ao vivo. */
async function formTurma(turma = null) {
    const ref = await referencias();
    const t = turma || {};
    const diasSel = new Set(t.dias || []);
    const m = modal({
        titulo: turma ? `Editar ${turma.nome}` : 'Nova turma',
        subtitulo: 'Sala e professor são verificados contra a grade antes de salvar.',
        confirmar: turma ? 'Salvar alterações' : 'Criar turma',
        etapas: [
            {
                titulo: 'Identidade',
                html: `<div class="form-grid">
                    <div class="field span-2"><label for="t-nome">Nome da turma</label><input class="input" id="t-nome" name="nome" value="${esc(t.nome || '')}" required placeholder="Ex.: Hip Hop Iniciante Noite"></div>
                    <div class="field"><label for="t-mod">Modalidade</label><select class="input" id="t-mod" name="modalidadeId" required>${opcoes(ref.modalidades.filter((x) => x.ativo), 'id', (x) => x.nome, t.modalidadeId, 'Selecione')}</select></div>
                    <div class="field"><label for="t-nivel">Nível</label><select class="input" id="t-nivel" name="nivel">${Object.entries(NIVEIS).map(([k, v]) => `<option value="${k}" ${k === (t.nivel || 'TODOS_OS_NIVEIS') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
                </div>`,
            },
            {
                titulo: 'Agenda e sala',
                html: `<div class="form-grid">
                    <div class="field span-2"><label>Dias da semana</label><div class="day-picker">${DIAS.map((d, i) => `<label><input type="checkbox" name="dias" data-array value="${i + 1}" ${diasSel.has(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>
                    <div class="field"><label for="t-ini">Início</label><input class="input" type="time" id="t-ini" name="horarioInicio" value="${esc(t.horarioInicio || '')}" required></div>
                    <div class="field"><label for="t-fim">Término</label><input class="input" type="time" id="t-fim" name="horarioFim" value="${esc(t.horarioFim || '')}" required></div>
                    <div class="field"><label for="t-sala">Sala</label><select class="input" id="t-sala" name="salaId" required>${opcoes(ref.salas.filter((s) => s.ativo), 'id', (s) => `${s.nome} (${s.capacidade} lugares)`, t.salaId, 'Selecione')}</select></div>
                    <div class="field"><label for="t-prof">Professor</label><select class="input" id="t-prof" name="professorId" required>${opcoes(ref.professores, 'id', (p) => p.nome, t.professorId, 'Selecione')}</select></div>
                    <div class="span-2" id="t-conflitos" aria-live="polite"></div>
                </div>`,
                validar: async (form) => {
                    const dados = montarTurma(form);
                    if (!dados.dias.length) return 'Selecione ao menos um dia da semana.';
                    if (dados.horarioFim <= dados.horarioInicio) return 'O término deve ser depois do início.';
                    const r = await api.post(`${A}/turmas/validar`, dados, { query: { ignorar: turma?.id }, silencioso: true });
                    return r.valido ? true : r.conflitos.map((c) => c.mensagem).join(' ');
                },
            },
            {
                titulo: 'Capacidade',
                html: `<div class="form-grid">
                    <div class="field"><label for="t-vagas">Limite de vagas</label><input class="input num" type="number" min="1" id="t-vagas" name="limiteVagas" value="${esc(t.limiteVagas || '')}" required><span class="hint" id="t-cap-hint"></span></div>
                    <div class="field"><label>Resumo</label><div id="t-resumo" class="muted" style="font-size:.875rem"></div></div>
                </div>`,
                validar: (form) => {
                    const sala = ref.salas.find((s) => String(s.id) === form.salaId.value);
                    const vagas = Number(form.limiteVagas.value);
                    if (sala && vagas > sala.capacidade) return `A sala ${sala.nome} comporta no máximo ${sala.capacidade} alunos.`;
                    return vagas > 0 ? true : 'Informe um limite de vagas válido.';
                },
            },
        ],
        onAbrir: (form) => {
            const checar = debounce(async () => {
                const box = form.querySelector('#t-conflitos');
                const dados = montarTurma(form);
                if (!dados.dias.length || !dados.horarioInicio || !dados.horarioFim || (!dados.salaId && !dados.professorId)) {
                    box.innerHTML = '';
                    return;
                }
                try {
                    const r = await api.post(`${A}/turmas/validar`, dados, { query: { ignorar: turma?.id }, silencioso: true });
                    box.innerHTML = r.valido
                        ? '<div class="callout ok"><i class="fas fa-circle-check"></i><span>Horário livre para esta sala e professor.</span></div>'
                        : `<div class="callout danger"><i class="fas fa-triangle-exclamation"></i><span>${r.conflitos.map((c) => esc(c.mensagem)).join('<br>')}</span></div>`;
                } catch { box.innerHTML = ''; }
            }, 300);
            form.addEventListener('change', () => {
                checar();
                const sala = ref.salas.find((s) => String(s.id) === form.salaId.value);
                const hint = form.querySelector('#t-cap-hint');
                if (hint) hint.textContent = sala ? `Capacidade da sala: ${sala.capacidade}` : '';
                const r = form.querySelector('#t-resumo');
                const d = montarTurma(form);
                if (r) r.innerHTML = `${esc(form.nome.value || '—')}<br>${d.dias.map((x) => DIAS[x - 1]).join(', ') || '—'} · ${esc(d.horarioInicio || '--:--')}–${esc(d.horarioFim || '--:--')}<br>${esc(sala?.nome || 'Sem sala')}`;
            });
            form.dispatchEvent(new Event('change'));
        },
        onSubmit: async (_, form) => {
            const dados = { ...montarTurma(form), limiteVagas: Number(form.limiteVagas.value), ativo: true };
            if (turma) await api.put(`${A}/turmas/${turma.id}`, dados, { silencioso: true });
            else await api.post(`${A}/turmas`, dados, { silencioso: true });
            toastOk(turma ? 'Turma atualizada' : 'Turma criada', `${dados.nome} já aparece na grade de todos os perfis.`);
        },
    });
    return m;
}

function montarTurma(form) {
    return {
        nome: form.nome.value.trim(),
        modalidadeId: Number(form.modalidadeId.value) || null,
        nivel: form.nivel.value,
        dias: [...form.querySelectorAll('input[name=dias]:checked')].map((c) => Number(c.value)),
        horarioInicio: form.horarioInicio.value,
        horarioFim: form.horarioFim.value,
        salaId: Number(form.salaId.value) || null,
        professorId: Number(form.professorId.value) || null,
    };
}

function abrirTurma(id) {
    drawer({
        titulo: 'Turma',
        render: async (body, d) => {
            const det = await api.get(`${A}/turmas/${id}/detalhe`);
            const t = det.turma;
            d.titulo(t.nome, `${t.modalidadeNome} · ${t.diasSemana} ${t.horarioInicio}–${t.horarioFim}`);
            body.innerHTML = html`
                <div class="grid grid-3">
                    <div class="data-card kpi"><span class="kpi-label">Lotação</span><span class="kpi-value num">${t.ocupadas}/${t.limiteVagas}</span></div>
                    <div class="data-card kpi"><span class="kpi-label">Frequência média</span><span class="kpi-value num">${pct(det.frequenciaMedia)}</span></div>
                    <div class="data-card kpi"><span class="kpi-label">Sala</span><span style="font-weight:700">${t.salaNome}</span></div>
                </div>
                <dl class="kv"><dt>Professor</dt><dd>${t.professorNome}</dd><dt>Nível</dt><dd>${NIVEIS[t.nivel] || t.nivel}</dd><dt>Próximas aulas</dt><dd class="num">${det.proximasAulas.map((x) => data(x)).join(' · ') || '—'}</dd></dl>
                <section><h4 style="margin-bottom:8px">Alunos (${det.alunos.length})</h4>
                <ul class="list-plain">${raw(det.alunos.map((a) => `<li>${avatar(a, 'sm')}<span style="flex:1">${esc(a.nome)}<br><small class="faint">${esc(a.email)}</small></span><span style="width:120px">${medidor(a.frequencia)}</span><b class="num" style="width:52px;text-align:right">${pct(a.frequencia, 0)}</b></li>`).join('') || '<li class="faint">Nenhum aluno matriculado.</li>')}</ul></section>`;
            d.acoes('<button class="btn btn-ghost" data-d="encerrar"><i class="fas fa-box-archive"></i> Encerrar</button><button class="btn btn-primary" data-d="editar"><i class="fas fa-pen"></i> Editar turma</button>');
            d.foot.onclick = (e) => {
                const b = e.target.closest('[data-d]');
                if (!b) return;
                if (b.dataset.d === 'editar') formTurma(t);
                if (b.dataset.d === 'encerrar') encerrarTurma(t).then(() => d.fechar());
            };
        },
    });
}

// ======================================================================
// 3. Financeiro
// ======================================================================
async function telaFinanceiro(ctx) {
    const aba = ctx.params.aba || 'mensalidades';
    const status = ctx.params.status || '';
    const [painel, emAnalise] = await Promise.all([
        api.get(`${A}/financeiro`),
        api.get(`${A}/financeiro/transacoes`, { query: { status: 'EM_ANALISE' } }),
    ]);
    const r = painel.resumo;
    const meses = [...new Set(painel.faturas.map((f) => f.mesReferencia))].sort().reverse();

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Financeiro</h1><p>Mensalidades, baixas e conferência de comprovantes. Cada baixa aparece na hora no portal do aluno.</p></div>
            <div class="page-actions">
                <button class="btn" data-acao="vencidas"><i class="fas fa-clock-rotate-left"></i> Atualizar atrasadas</button>
                <button class="btn" data-acao="lote"><i class="fas fa-layer-group"></i> Gerar em lote</button>
                <button class="btn btn-primary" data-acao="individual"><i class="fas fa-user-tag"></i> Nova cobrança</button>
            </div>
        </div>
        <section class="grid grid-4">
            <div class="data-card kpi is-hero"><span class="kpi-label"><i class="fas fa-circle-check"></i> Recebido no mês</span><span class="kpi-value num">${moeda(r.recebidoMes)}</span><span class="kpi-foot num">${r.pagas} faturas pagas no total</span></div>
            <button class="data-card kpi" data-status="PENDENTE"><span class="kpi-label"><i class="fas fa-hourglass-half"></i> Em aberto</span><span class="kpi-value num">${moeda(r.emAberto)}</span><span class="kpi-foot num">${r.pendentes} pendente(s)</span></button>
            <button class="data-card kpi" data-status="VENCIDO"><span class="kpi-label"><i class="fas fa-triangle-exclamation"></i> Atrasado</span><span class="kpi-value num ${r.atrasadas ? 'danger' : ''}">${moeda(r.vencido)}</span><span class="kpi-foot num">${r.atrasadas} fatura(s)</span></button>
            <button class="data-card kpi" data-aba="comprovantes"><span class="kpi-label"><i class="fas fa-receipt"></i> Comprovantes para conferir</span><span class="kpi-value num">${emAnalise.length}</span><span class="kpi-foot">enviados pelos alunos</span></button>
        </section>

        <div class="panel flush mt-4">
            <div class="tabs" role="tablist" style="padding:0 16px;margin-bottom:0">
                <button class="${aba === 'mensalidades' ? 'is-active' : ''}" data-aba="mensalidades" role="tab">Mensalidades</button>
                <button class="${aba === 'comprovantes' ? 'is-active' : ''}" data-aba="comprovantes" role="tab">Comprovantes ${emAnalise.length ? raw(`<span class="badge info plain">${emAnalise.length}</span>`) : ''}</button>
                <button class="${aba === 'planilha' ? 'is-active' : ''}" data-aba="planilha" role="tab"><i class="fas fa-table-list"></i> Planilha financeira</button>
            </div>
            <div id="fin-conteudo"></div>
        </div>`;

    const alvo = $('#fin-conteudo');
    if (aba === 'mensalidades') {
        alvo.innerHTML = html`
            <div class="table-tools">
                <div class="input-icon"><i class="fas fa-magnifying-glass"></i><input class="input" id="fin-busca" placeholder="Buscar aluno ou cobrança"></div>
                <div class="segmented" id="fin-status">
                    ${raw([['', 'Todas'], ['PENDENTE', 'Pendentes'], ['VENCIDO', 'Atrasadas'], ['EM_ANALISE', 'Em análise'], ['CONFIRMADO', 'Pagas']].map(([v, l]) => `<button data-v="${v}" class="${status === v ? 'is-active' : ''}">${l}</button>`).join(''))}
                </div>
                <select class="input" id="fin-mes" style="width:auto"><option value="">Todos os meses</option>${raw(meses.map((m) => `<option value="${m}">${m}</option>`).join(''))}</select>
            </div>
            <div id="tbl-faturas"></div>`;
        const tabela = new SmartTable({
            el: $('#tbl-faturas'),
            busca: (f) => `${f.alunoNome} ${f.titulo}`,
            colunas: [
                { chave: 'alunoNome', titulo: 'Aluno', render: (f) => `<strong>${esc(f.alunoNome)}</strong><br><small class="faint">${esc(f.titulo)}</small>` },
                { chave: 'mesReferencia', titulo: 'Referência', render: (f) => `<span class="num">${esc(f.mesReferencia)}</span>` },
                { chave: 'dataVencimento', titulo: 'Vencimento', render: (f) => `<span class="num">${data(f.dataVencimento)}</span>${f.diasAtraso ? `<br><small class="danger num">${f.diasAtraso} dia(s) em atraso</small>` : ''}` },
                { chave: 'valor', titulo: 'Valor', num: true, render: (f) => valorComDesconto(f) },
                { chave: 'status', titulo: 'Status', render: (f) => badge(f.status) },
                { titulo: '', ordenavel: false, render: (f) => (['PENDENTE', 'VENCIDO', 'EM_ANALISE'].includes(f.status)
                    ? `<div class="row-actions"><button class="btn btn-sm btn-ok" data-acao="baixa"><i class="fas fa-check"></i> Dar baixa</button>${f.status !== 'EM_ANALISE' ? '<button class="btn btn-sm btn-ghost" data-acao="ajustar" title="Ajustar valor, desconto ou vencimento"><i class="fas fa-tag"></i></button>' : ''}<button class="btn btn-sm btn-ghost" data-acao="cancelar" title="Cancelar cobrança"><i class="fas fa-ban"></i></button></div>` : '') },
            ],
            onLinha: (f) => abrirFatura(f.id),
            vazio: ['fa-file-invoice', 'Nenhuma cobrança encontrada', 'Gere as mensalidades do mês em lote ou lance uma cobrança individual.'],
        });
        tabela.setDados(painel.faturas);
        if (status) tabela.setFiltro('status', (f) => f.status === status);
        $('#fin-busca').addEventListener('input', (e) => tabela.buscar(e.target.value));
        $('#fin-mes').addEventListener('change', (e) => tabela.setFiltro('mes', e.target.value ? (f) => f.mesReferencia === e.target.value : null));
        $('#fin-status').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            $('#fin-status').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
            tabela.setFiltro('status', b.dataset.v ? (f) => f.status === b.dataset.v : null);
        });
        tabela.el.addEventListener('acao', (e) => {
            const { acao, item } = e.detail;
            if (acao === 'baixa') darBaixa(item);
            if (acao === 'cancelar') cancelarFatura(item);
            if (acao === 'ajustar') formAjuste(item);
        });
        if (ctx.params.fatura && !ctx.suave) abrirFatura(Number(ctx.params.fatura));
    } else if (aba === 'comprovantes') {
        alvo.innerHTML = emAnalise.length ? `<div class="roll">${emAnalise.map((p) => html`
            <div class="roll-item">
                <div><strong>${p.alunoNome}</strong> · <span class="num">${moeda(p.valor)}</span><br><small class="faint">${p.faturaTitulo} · ${p.comprovanteNome || 'sem arquivo'} · enviado ${relativo(p.criadoEm)}</small>${p.observacao ? raw(`<br><small class="muted">“${esc(p.observacao)}”</small>`) : ''}</div>
                <div class="row">${raw(p.temComprovante ? `<button class="btn btn-sm btn-ghost" data-ver="${p.id}"><i class="fas fa-eye"></i> Ver arquivo</button>` : '')}<button class="btn btn-sm btn-danger" data-recusar="${p.id}"><i class="fas fa-xmark"></i> Recusar</button><button class="btn btn-sm btn-ok" data-aprovar="${p.id}"><i class="fas fa-check"></i> Aprovar</button></div>
            </div>`).join('')}</div>` : vazio('fa-receipt', 'Nenhum comprovante aguardando', 'Quando um aluno enviar um comprovante, ele aparece aqui na hora.');
        alvo.onclick = async (e) => {
            const ap = e.target.closest('[data-aprovar]');
            const rc = e.target.closest('[data-recusar]');
            const ver = e.target.closest('[data-ver]');
            if (ver) comBotao(ver, () => api.arquivo(`${A}/financeiro/pagamentos/${ver.dataset.ver}/comprovante`));
            if (ap) {
                await comBotao(ap, () => api.post(`${A}/financeiro/pagamentos/${ap.dataset.aprovar}/aprovar`, {}));
                toastOk('Comprovante aprovado', 'A fatura foi quitada no portal do aluno.');
            }
            if (rc) {
                const motivo = await confirmar({ titulo: 'Recusar comprovante', texto: 'O aluno será notificado com o motivo e poderá reenviar.', confirmar: 'Recusar', perigo: true, motivo: true, motivoObrigatorio: true });
                if (motivo === false) return;
                await api.post(`${A}/financeiro/pagamentos/${rc.dataset.recusar}/recusar`, { resposta: motivo });
                toastOk('Comprovante recusado');
            }
        };
    } else {
        alvo.innerHTML = '<div id="planilha-adm"></div>';
        const linhas = await api.get(`${A}/financeiro/planilha`);
        planilhaFinanceira($('#planilha-adm'), linhas, { comAluno: true, nomeArquivo: 'relatorio-financeiro-vibedance', pdfUrl: `${A}/financeiro/planilha/pdf`, onLinha: (l) => abrirFatura(l.faturaId) });
    }

    ctx.el.querySelector('.page-head').onclick = (e) => {
        if (e.target.closest('[data-acao="lote"]')) formLote();
        if (e.target.closest('[data-acao="individual"]')) formCobranca();
        const v = e.target.closest('[data-acao="vencidas"]');
        if (v) comBotao(v, async () => { const res = await api.post(`${A}/financeiro/atualizar-vencidas`); toastOk('Cobranças atualizadas', `${res.atualizadas} fatura(s) marcadas como atrasadas.`); });
    };
    ctx.el.querySelector('.grid-4').onclick = (e) => {
        const s = e.target.closest('[data-status]');
        if (s) ctx.navegar(`#/financeiro?status=${s.dataset.status}`);
        const a = e.target.closest('[data-aba]');
        if (a) ctx.navegar(`#/financeiro?aba=${a.dataset.aba}`);
    };
    ctx.el.querySelector('.tabs').onclick = (e) => {
        const b = e.target.closest('[data-aba]');
        if (b) ctx.navegar(`#/financeiro?aba=${b.dataset.aba}`);
    };
}

function darBaixa(f) {
    modal({
        titulo: 'Dar baixa',
        subtitulo: `${f.alunoNome} · ${f.titulo}`,
        confirmar: 'Confirmar recebimento',
        corpo: `<div class="form-grid">
            <div class="field"><label for="bx-valor">Valor recebido</label><input class="input num" id="bx-valor" name="valor" type="number" step="0.01" min="0.01" value="${Number(f.valor).toFixed(2)}" required></div>
            <div class="field"><label for="bx-forma">Forma</label><select class="input" id="bx-forma" name="forma"><option value="PIX">PIX</option><option value="CARTAO_CREDITO">Cartão de crédito</option><option value="BOLETO">Boleto</option><option value="COMPROVANTE_MANUAL">Dinheiro / outro</option></select></div>
            <div class="field span-2"><label for="bx-obs">Observação</label><input class="input" id="bx-obs" name="observacao" placeholder="Opcional"></div>
        </div>`,
        onSubmit: async (d) => {
            await api.post(`${A}/financeiro/faturas/${f.id}/baixa`, { forma: d.forma, valor: Number(d.valor), observacao: d.observacao || null }, { silencioso: true });
            toastOk('Baixa registrada', `${f.alunoNome} já vê a fatura como paga.`);
        },
    });
}

async function cancelarFatura(f) {
    const motivo = await confirmar({ titulo: 'Cancelar cobrança', texto: `"${f.titulo}" deixará de ser cobrada de ${f.alunoNome}.`, confirmar: 'Cancelar cobrança', perigo: true, motivo: true, motivoObrigatorio: true });
    if (motivo === false) return;
    await api.post(`${A}/financeiro/faturas/${f.id}/cancelar`, { resposta: motivo });
    toastOk('Cobrança cancelada');
}

function abrirFatura(id) {
    drawer({
        titulo: 'Cobrança',
        render: async (body, d) => {
            const painel = await api.get(`${A}/financeiro`);
            const f = painel.faturas.find((x) => x.id === id);
            if (!f) { body.innerHTML = vazio('fa-file-circle-xmark', 'Cobrança não encontrada'); return; }
            const pagamentos = await api.get(`${A}/financeiro/faturas/${id}/pagamentos`);
            d.titulo(f.titulo, `${f.alunoNome} · ${f.turmaNome || 'Sem turma'}`);
            body.innerHTML = html`
                <div class="row between"><span class="kpi-value num">${moeda(f.valor)}</span>${raw(badge(f.status))}</div>
                ${raw(Number(f.desconto) > 0 ? `<div class="cob-drawer-desc"><i class="fas fa-tag" aria-hidden="true"></i><span><strong>${esc(rotuloMotivo(f.motivoDesconto))}</strong><small class="num">Valor cheio ${moeda(f.valorOriginal)} · desconto de ${moeda(f.desconto)}</small></span></div>` : '')}
                ${raw(f.observacao ? `<p class="muted" style="font-size:var(--fs-sm)"><i class="fas fa-note-sticky faint"></i> ${esc(f.observacao)}</p>` : '')}
                <dl class="kv"><dt>Origem</dt><dd>${f.origem === 'INDIVIDUAL' ? 'Cobrança individual' : 'Lote mensal'}</dd><dt>Referência</dt><dd class="num">${f.mesReferencia}</dd><dt>Vencimento</dt><dd class="num">${data(f.dataVencimento)}${f.diasAtraso ? ` · ${f.diasAtraso} dia(s) de atraso` : ''}</dd><dt>Criada em</dt><dd class="num">${dataHora(f.criadoEm)}</dd></dl>
                ${raw(f.pixCopiaCola ? `<div class="field"><label>PIX copia e cola</label><textarea class="input" readonly rows="3" style="font-size:.75rem">${esc(f.pixCopiaCola)}</textarea></div>` : '')}
                <section><h4 class="drawer-sec">Pagamentos</h4><ul class="list-plain">${raw(pagamentos.map((p) => `<li>${badge(p.status)}<span style="flex:1">${moeda(p.valor)} · ${esc((p.forma || '').toLowerCase().replace('_', ' '))}<br><small class="faint">${dataHora(p.criadoEm)}${p.observacao ? ` · ${esc(p.observacao)}` : ''}</small></span>${p.status === 'CONFIRMADO' ? `<button class="btn btn-sm" data-recibo="${p.id}" title="Baixar comprovante em PDF"><i class="fas fa-file-pdf"></i> PDF</button>` : ''}</li>`).join('') || '<li class="faint">Nenhum pagamento registrado.</li>')}</ul></section>`;
            body.onclick = (e) => {
                const rc = e.target.closest('[data-recibo]');
                if (rc) comBotao(rc, () => api.arquivo(`${A}/financeiro/pagamentos/${rc.dataset.recibo}/recibo`, { baixar: true, nome: `comprovante-vibedance-${rc.dataset.recibo}.pdf` }));
            };
            const aberta = ['PENDENTE', 'VENCIDO', 'EM_ANALISE'].includes(f.status);
            d.acoes(aberta ? `<button class="btn btn-ghost" data-d="cancelar"><i class="fas fa-ban"></i> Cancelar</button>${f.status !== 'EM_ANALISE' ? '<button class="btn" data-d="ajustar"><i class="fas fa-tag"></i> Ajustar / desconto</button>' : ''}<button class="btn btn-ok" data-d="baixa"><i class="fas fa-check"></i> Dar baixa</button>` : '');
            d.foot.onclick = (e) => {
                const b = e.target.closest('[data-d]');
                if (b?.dataset.d === 'baixa') darBaixa(f);
                if (b?.dataset.d === 'cancelar') cancelarFatura(f);
                if (b?.dataset.d === 'ajustar') formAjuste(f);
            };
        },
    });
}

async function formLote() {
    const alunos = await api.get(`${A}/usuarios`, { query: { perfil: 'ALUNO', status: 'ATIVO' } });
    const hoje = new Date();
    const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    modal({
        titulo: 'Gerar mensalidades em lote',
        subtitulo: 'Uma cobrança por matrícula ativa. Alunos que já têm cobrança no mês são ignorados.',
        confirmar: 'Gerar cobranças',
        etapas: [
            {
                titulo: 'Referência',
                html: `<div class="form-grid">
                    <div class="field"><label for="lt-mes">Mês de referência</label><input class="input" type="month" id="lt-mes" name="mesReferencia" value="${mes}" required></div>
                    <div class="field"><label for="lt-venc">Vencimento</label><input class="input" type="date" id="lt-venc" name="dataVencimento" value="${mes}-10" required></div>
                    <div class="field"><label for="lt-valor">Valor por matrícula (R$)</label><input class="input num" type="number" step="0.01" min="1" id="lt-valor" name="valor" value="189.90" required></div>
                </div>`,
            },
            {
                titulo: 'Alunos',
                html: `<div class="segmented" id="lt-modo" style="margin-bottom:12px"><button type="button" class="is-active" data-m="todos">Todos com matrícula ativa</button><button type="button" data-m="sel">Selecionar alunos</button></div>
                    <div class="check-list" id="lt-lista" hidden>${alunos.map((a) => `<label class="check-item"><input type="checkbox" name="alunos" data-array value="${a.id}"><span class="grow">${esc(a.nome)}<small>${esc(a.email)}</small></span></label>`).join('')}</div>`,
                validar: (form) => {
                    const sel = form.querySelector('#lt-modo .is-active').dataset.m === 'sel';
                    return !sel || form.querySelectorAll('input[name=alunos]:checked').length ? true : 'Selecione ao menos um aluno.';
                },
            },
            { titulo: 'Revisão', html: '<div id="lt-resumo"></div>' },
        ],
        onAbrir: (form) => {
            form.querySelector('#lt-modo').addEventListener('click', (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                form.querySelectorAll('#lt-modo button').forEach((x) => x.classList.toggle('is-active', x === b));
                form.querySelector('#lt-lista').hidden = b.dataset.m !== 'sel';
            });
            form.addEventListener('click', () => setTimeout(() => {
                const sel = form.querySelector('#lt-modo .is-active').dataset.m === 'sel';
                const qtd = form.querySelectorAll('input[name=alunos]:checked').length;
                form.querySelector('#lt-resumo').innerHTML = `<dl class="kv"><dt>Referência</dt><dd class="num">${esc(form.mesReferencia.value)}</dd><dt>Vencimento</dt><dd class="num">${data(form.dataVencimento.value)}</dd><dt>Valor</dt><dd class="num">${moeda(form.valor.value)} por matrícula</dd><dt>Alcance</dt><dd>${sel ? `${qtd} aluno(s) selecionado(s)` : 'Todos os alunos com matrícula ativa'}</dd></dl><div class="callout mt-4"><i class="fas fa-bell"></i><span>Cada aluno recebe uma notificação e vê a cobrança no portal imediatamente.</span></div>`;
            }));
        },
        onSubmit: async (_, form) => {
            const sel = form.querySelector('#lt-modo .is-active').dataset.m === 'sel';
            const r = await api.post(`${A}/financeiro/lote`, {
                mesReferencia: form.mesReferencia.value,
                dataVencimento: form.dataVencimento.value,
                valor: Number(form.valor.value),
                alunos: sel ? [...form.querySelectorAll('input[name=alunos]:checked')].map((c) => Number(c.value)) : [],
            }, { silencioso: true });
            toastOk(`${r.criadas} cobrança(s) gerada(s)`, r.ignoradas ? `${r.ignoradas} ignorada(s) por já existirem.` : r.avisos?.[0] || '');
        },
    });
}

// ======================================================================
// 4. Usuários & matrículas
// ======================================================================
async function telaUsuarios(ctx) {
    const perfil = ctx.params.perfil || '';
    const lista = await api.get(`${A}/usuarios`);
    const cont = (p) => lista.filter((u) => !p || u.perfil === p).length;

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Usuários e matrículas</h1><p>Contas institucionais @vibedance.com de alunos, professores e administradores.</p></div>
            <div class="page-actions"><button class="btn btn-primary" data-acao="novo"><i class="fas fa-user-plus"></i> Novo usuário</button></div>
        </div>
        <div class="panel flush">
            <div class="table-tools">
                <div class="input-icon"><i class="fas fa-magnifying-glass"></i><input class="input" id="us-busca" placeholder="Nome, e-mail ou CPF"></div>
                <div class="segmented" id="us-perfil">
                    ${raw([['', 'Todos'], ['ALUNO', 'Alunos'], ['PROFESSOR', 'Professores'], ['ADMINISTRADOR', 'ADMs']].map(([v, l]) => `<button data-v="${v}" class="${perfil === v ? 'is-active' : ''}">${l} <span class="faint num">${cont(v)}</span></button>`).join(''))}
                </div>
                <select class="input" id="us-status" style="width:auto"><option value="">Qualquer status</option><option value="ATIVO">Ativos</option><option value="SUSPENSO">Suspensos</option></select>
            </div>
            <div id="tbl-usuarios"></div>
        </div>`;

    const tabela = new SmartTable({
        el: $('#tbl-usuarios'),
        busca: (u) => `${u.nome} ${u.email} ${u.cpf}`,
        colunas: [
            { chave: 'nome', titulo: 'Nome', render: (u) => `<div class="cell-user">${avatar(u, 'sm')}<span><strong>${esc(u.nome)}</strong><small>${esc(u.email)}</small></span></div>` },
            { chave: 'perfil', titulo: 'Perfil', render: (u) => badge(u.perfil) },
            { chave: 'telefone', titulo: 'Telefone', render: (u) => `<span class="num">${esc(u.telefone || '—')}</span>` },
            { chave: 'dataCadastro', titulo: 'Desde', render: (u) => `<span class="num">${data(u.dataCadastro)}</span>` },
            { chave: 'ativo', titulo: 'Status', render: (u) => badge(u.ativo ? 'ATIVO' : 'SUSPENSO') },
            { titulo: '', ordenavel: false, render: (u) => `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-acao="editar" title="Editar"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-ghost" data-acao="status" title="${u.ativo ? 'Suspender' : 'Reativar'}"><i class="fas ${u.ativo ? 'fa-user-lock' : 'fa-user-check'}"></i></button></div>` },
        ],
        porPagina: 12,
        onLinha: (u) => abrirUsuario(u.id),
        vazio: ['fa-users', 'Ninguém encontrado', 'Revise a busca ou crie uma nova conta.'],
    });
    tabela.setDados(lista);
    if (perfil) tabela.setFiltro('perfil', (u) => u.perfil === perfil);

    $('#us-busca').addEventListener('input', (e) => tabela.buscar(e.target.value));
    $('#us-status').addEventListener('change', (e) => tabela.setFiltro('status', e.target.value ? (u) => (e.target.value === 'ATIVO') === u.ativo : null));
    $('#us-perfil').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        $('#us-perfil').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
        tabela.setFiltro('perfil', b.dataset.v ? (u) => u.perfil === b.dataset.v : null);
    });
    tabela.el.addEventListener('acao', (e) => {
        const { acao, item } = e.detail;
        if (acao === 'editar') formUsuario(item);
        if (acao === 'status') alternarStatus(item);
    });
    ctx.el.querySelector('[data-acao="novo"]').onclick = () => formUsuario();
    if (ctx.params.id && !ctx.suave) abrirUsuario(Number(ctx.params.id));
}

async function alternarStatus(u) {
    const ok = await confirmar({
        titulo: u.ativo ? `Suspender ${u.nome}?` : `Reativar ${u.nome}?`,
        texto: u.ativo ? 'O acesso é bloqueado imediatamente em todas as sessões abertas. Dados e histórico são mantidos.' : 'A pessoa volta a acessar o portal com a senha atual.',
        confirmar: u.ativo ? 'Suspender conta' : 'Reativar conta', perigo: u.ativo,
    });
    if (!ok) return;
    await api.patch(`${A}/usuarios/${u.id}/${u.ativo ? 'suspender' : 'reativar'}`);
    toastOk(u.ativo ? 'Conta suspensa' : 'Conta reativada', u.nome);
}

async function formUsuario(u = null) {
    const turmas = u ? [] : await api.get(`${A}/turmas`);
    const etapas = [
        {
            titulo: 'Identidade',
            html: `<div class="form-grid">
                <div class="field span-2"><label for="u-nome">Nome completo</label><input class="input" id="u-nome" name="nome" value="${esc(u?.nome || '')}" required></div>
                <div class="field"><label for="u-cpf">CPF</label><input class="input num" id="u-cpf" name="cpf" value="${esc(u?.cpf || '')}" ${u ? '' : 'required'} placeholder="000.000.000-00" inputmode="numeric"></div>
                <div class="field"><label for="u-tel">Telefone</label><input class="input num" id="u-tel" name="telefone" value="${esc(u?.telefone || '')}" placeholder="(61) 90000-0000"></div>
                <div class="field span-2"><label>Perfil de acesso</label><div class="segmented" id="u-perfil">${['ALUNO', 'PROFESSOR', 'ADMINISTRADOR'].map((p) => `<button type="button" data-v="${p}" class="${(u?.perfil || 'ALUNO') === p ? 'is-active' : ''}">${p === 'ADMINISTRADOR' ? 'Administrador' : p === 'PROFESSOR' ? 'Professor' : 'Aluno'}</button>`).join('')}</div><input type="hidden" name="perfil" value="${u?.perfil || 'ALUNO'}"></div>
            </div>`,
        },
        {
            titulo: 'Acesso',
            html: `<div class="form-grid">
                <div class="field span-2"><label for="u-email">E-mail institucional</label><input class="input" id="u-email" name="email" type="email" value="${esc(u?.email || '')}" required placeholder="nome@vibedance.com"><span class="hint">Apenas @vibedance.com é aceito pelo sistema.</span></div>
                <div class="field span-2"><label for="u-senha">${u ? 'Nova senha (opcional)' : 'Senha inicial'}</label><input class="input" id="u-senha" name="senha" type="password" minlength="6" ${u ? '' : 'required'} autocomplete="new-password"><span class="hint">Mínimo de 6 caracteres.</span></div>
            </div>`,
            validar: (form) => (/^[a-z0-9._%+-]+@vibedance\.com$/i.test(form.email.value.trim()) ? true : 'O e-mail precisa terminar em @vibedance.com.'),
        },
    ];
    if (!u) {
        etapas.push({
            titulo: 'Matrículas',
            html: `<p class="muted" style="margin-bottom:12px">Para alunos: escolha as turmas iniciais (opcional).</p><div class="check-list" id="u-turmas">${turmas.map((t) => `<label class="check-item"><input type="checkbox" name="turmas" data-array value="${t.id}" ${t.ocupadas >= t.limiteVagas ? 'disabled' : ''}><span class="grow">${esc(t.nome)}<small>${esc(t.diasSemana)} · ${esc(t.horarioInicio)} · ${esc(t.professorNome)}</small></span><span class="num faint">${t.ocupadas}/${t.limiteVagas}</span></label>`).join('')}</div>`,
        });
    }
    modal({
        titulo: u ? `Editar ${u.nome}` : 'Novo usuário',
        confirmar: u ? 'Salvar alterações' : 'Criar conta',
        etapas,
        onAbrir: (form) => {
            form.querySelector('#u-perfil').addEventListener('click', (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                form.querySelectorAll('#u-perfil button').forEach((x) => x.classList.toggle('is-active', x === b));
                form.perfil.value = b.dataset.v;
            });
        },
        onSubmit: async (d, form) => {
            const corpo = { nome: d.nome, cpf: d.cpf, telefone: d.telefone, perfil: d.perfil, email: d.email, senha: d.senha || null };
            if (u) {
                await api.put(`${A}/usuarios/${u.id}`, corpo, { silencioso: true });
                toastOk('Usuário atualizado', d.nome);
                return;
            }
            const criado = await api.post(`${A}/usuarios`, corpo, { silencioso: true });
            const turmasSel = [...form.querySelectorAll('input[name=turmas]:checked')].map((c) => Number(c.value));
            if (criado.perfil === 'ALUNO' && turmasSel.length) {
                await api.post(`${A}/usuarios/${criado.id}/matriculas`, { turmas: turmasSel }, { silencioso: true });
            }
            toastOk('Conta criada', `${criado.nome} já pode entrar com ${criado.email}.`);
        },
    });
}

function abrirUsuario(id) {
    drawer({
        titulo: 'Usuário',
        largura: 600,
        render: async (body, d) => {
            const det = await api.get(`${A}/usuarios/${id}`);
            const u = det.usuario;
            d.titulo(u.nome, `${u.email}`);
            body.innerHTML = html`
                <div class="row">${raw(avatar(u, 'lg'))}<div><div class="row wrap">${raw(badge(u.perfil))}${raw(badge(u.ativo ? 'ATIVO' : 'SUSPENSO'))}</div><p class="muted num" style="margin-top:6px">CPF ${u.cpf || '—'} · ${u.telefone || 'sem telefone'}</p></div></div>
                ${raw(u.perfil === 'ALUNO' ? `
                <div class="grid grid-2">
                    <div class="data-card kpi"><span class="kpi-label">Frequência geral</span><span class="kpi-value num">${pct(det.frequencia)}</span>${medidor(det.frequencia)}</div>
                    <div class="data-card kpi"><span class="kpi-label">Faturas em aberto</span><span class="kpi-value num ${det.faturasEmAberto ? 'warn' : ''}">${det.faturasEmAberto}</span></div>
                </div>
                <section>
                    <div class="row between" style="margin-bottom:8px"><h4>Matrículas</h4><button class="btn btn-sm" data-d="vincular"><i class="fas fa-link"></i> Vincular turmas</button></div>
                    <ul class="list-plain">${det.matriculas.map((m) => `<li><span style="flex:1">${esc(m.turmaNome)}<br><small class="faint">${esc(m.horario || '')}</small></span><select class="input" style="width:auto;min-height:32px;padding:4px 8px" data-matricula="${m.id}" aria-label="Status da matrícula">${['ATIVA', 'TRANCADA', 'CANCELADA'].map((s) => `<option value="${s}" ${s === m.status ? 'selected' : ''}>${s.charAt(0) + s.slice(1).toLowerCase()}</option>`).join('')}</select></li>`).join('') || '<li class="faint">Sem matrículas.</li>'}</ul>
                </section>` : '')}
                ${raw(det.turmasLecionadas.length ? `<section><h4 style="margin-bottom:8px">Turmas lecionadas</h4><ul class="list-plain">${det.turmasLecionadas.map((t) => `<li><span style="flex:1">${esc(t.nome)}<br><small class="faint">${esc(t.diasSemana)} · ${esc(t.horarioInicio)}</small></span><span class="num faint">${t.ocupadas}/${t.limiteVagas}</span></li>`).join('')}</ul></section>` : '')}
                <section><h4 style="margin-bottom:8px">Histórico da conta</h4><ul class="list-plain">${raw(det.historico.map((a) => `<li><span class="badge plain">${esc(a.acao)}</span><span style="flex:1">${esc(a.descricao)}<br><small class="faint">${esc(a.usuarioNome || 'Sistema')} · ${dataHora(a.dataHora)}</small></span></li>`).join('') || '<li class="faint">Sem alterações registradas.</li>')}</ul></section>`;
            d.acoes(`<button class="btn btn-ghost" data-d="excluir"><i class="fas fa-trash"></i> Excluir</button><button class="btn" data-d="status"><i class="fas ${u.ativo ? 'fa-user-lock' : 'fa-user-check'}"></i> ${u.ativo ? 'Suspender' : 'Reativar'}</button><button class="btn btn-primary" data-d="editar"><i class="fas fa-pen"></i> Editar</button>`);

            body.onchange = async (e) => {
                const sel = e.target.closest('[data-matricula]');
                if (!sel) return;
                await api.patch(`${A}/matriculas/${sel.dataset.matricula}`, { status: sel.value });
                toastOk('Matrícula atualizada');
            };
            body.onclick = (e) => {
                if (e.target.closest('[data-d="vincular"]')) vincularTurmas(u, det.matriculas);
            };
            d.foot.onclick = async (e) => {
                const b = e.target.closest('[data-d]');
                if (!b) return;
                if (b.dataset.d === 'editar') formUsuario(u);
                if (b.dataset.d === 'status') alternarStatus(u);
                if (b.dataset.d === 'excluir') {
                    const ok = await confirmar({ titulo: `Excluir ${u.nome}?`, texto: 'Contas com histórico financeiro ou turmas não podem ser excluídas — nesse caso, use a suspensão.', confirmar: 'Excluir definitivamente', perigo: true });
                    if (!ok) return;
                    await api.del(`${A}/usuarios/${u.id}`);
                    toastOk('Conta excluída');
                    d.fechar();
                }
            };
        },
    });
}

async function vincularTurmas(u, matriculas) {
    const turmas = await api.get(`${A}/turmas`);
    const ativas = new Set(matriculas.filter((m) => m.status === 'ATIVA').map((m) => m.turmaId));
    modal({
        titulo: `Matricular ${u.nome}`,
        subtitulo: 'Selecione uma ou mais turmas. Turmas lotadas ficam indisponíveis.',
        confirmar: 'Vincular turmas',
        corpo: `<div class="check-list">${turmas.filter((t) => !ativas.has(t.id)).map((t) => `<label class="check-item"><input type="checkbox" name="turmas" data-array value="${t.id}" ${t.ocupadas >= t.limiteVagas ? 'disabled' : ''}><span class="grow">${esc(t.nome)}<small>${esc(t.diasSemana)} · ${esc(t.horarioInicio)} · ${esc(t.professorNome)}</small></span><span class="num faint">${t.ocupadas}/${t.limiteVagas}</span></label>`).join('') || vazio('fa-layer-group', 'Já matriculado em todas as turmas disponíveis')}</div>`,
        onSubmit: async (_, form) => {
            const ids = [...form.querySelectorAll('input[name=turmas]:checked')].map((c) => Number(c.value));
            if (!ids.length) throw new Error('Selecione ao menos uma turma.');
            await api.post(`${A}/usuarios/${u.id}/matriculas`, { turmas: ids }, { silencioso: true });
            toastOk('Matrículas vinculadas', `${ids.length} turma(s) para ${u.nome}.`);
        },
    });
}

// ======================================================================
// 5. Reposições (visão geral)
// ======================================================================
async function telaReposicoes(ctx) {
    const lista = await api.get(`${A}/reposicoes`);
    const pendentes = lista.filter((r) => r.status === 'SOLICITADA');
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Reposições e aulas experimentais</h1><p>Solicitações de todos os professores. Ao aprovar, o aluno entra na chamada daquela data.</p></div></div>
        <div class="panel flush"><div id="tbl-rep"></div></div>`;
    const t = new SmartTable({
        el: $('#tbl-rep'),
        colunas: [
            { chave: 'alunoNome', titulo: 'Aluno', render: (r) => `<strong>${esc(r.alunoNome)}</strong>${r.motivo ? `<br><small class="faint">“${esc(r.motivo)}”</small>` : ''}` },
            { chave: 'tipo', titulo: 'Tipo', render: (r) => badge(r.tipo) },
            { chave: 'turmaDestinoNome', titulo: 'Turma de destino', render: (r) => `${esc(r.turmaDestinoNome)}<br><small class="faint">${r.turmaOrigemNome ? `origem: ${esc(r.turmaOrigemNome)}` : ''}</small>` },
            { chave: 'dataAulaDestino', titulo: 'Aula', render: (r) => `<span class="num">${data(r.dataAulaDestino)} · ${esc(r.horario || '')}</span>` },
            { chave: 'status', titulo: 'Status', render: (r) => badge(r.status) },
            { titulo: '', ordenavel: false, render: (r) => (r.status === 'SOLICITADA' ? '<div class="row-actions"><button class="btn btn-sm btn-danger" data-acao="recusar">Recusar</button><button class="btn btn-sm btn-ok" data-acao="aprovar">Aprovar</button></div>' : '') },
        ],
        vazio: ['fa-rotate', 'Nenhuma solicitação', 'Pedidos de reposição dos alunos aparecem aqui na hora.'],
    });
    t.setDados([...pendentes, ...lista.filter((r) => r.status !== 'SOLICITADA')]);
    t.el.addEventListener('acao', (e) => decidirReposicao(e.detail.item, e.detail.acao === 'aprovar'));
}

async function decidirReposicao(r, aprovar) {
    const resposta = await confirmar({
        titulo: aprovar ? 'Aprovar solicitação' : 'Recusar solicitação',
        texto: `${r.alunoNome} → ${r.turmaDestinoNome} em ${data(r.dataAulaDestino)}.`,
        confirmar: aprovar ? 'Aprovar' : 'Recusar', perigo: !aprovar,
        motivo: true, motivoObrigatorio: !aprovar, rotuloMotivo: aprovar ? 'Mensagem ao aluno (opcional)' : 'Motivo da recusa',
    });
    if (resposta === false) return;
    await api.post(`/api/professor/workspace/reposicoes/${r.id}/${aprovar ? 'aprovar' : 'recusar'}`, { resposta: resposta || null });
    toastOk(aprovar ? 'Solicitação aprovada' : 'Solicitação recusada', 'O aluno foi notificado.');
}

// ======================================================================
// 5b. Cancelamentos de matrícula
// ======================================================================
const MOTIVOS_CANCEL = {
    HORARIO: 'Incompatibilidade de horário', FINANCEIRO: 'Motivos financeiros', MUDANCA: 'Mudança de cidade',
    SAUDE: 'Saúde ou lesão', INSATISFACAO: 'Insatisfação com as aulas', OUTRO: 'Outro motivo',
};
const statusCancel = (s) => (s === 'SOLICITADA' ? badge('EM_ANALISE', 'Em análise') : badge(s));
const diagBadge = (d) => (d.adimplente
    ? `<span class="badge ok">Adimplente${Number(d.totalEmAberto) ? ` · ${moeda(d.totalEmAberto)} a vencer` : ''}</span>`
    : `<span class="badge danger">Pendência · ${moeda(d.totalAtrasado)} em atraso</span>`);

async function telaCancelamentos(ctx) {
    const filtro = ctx.params.status ?? 'SOLICITADA';
    const lista = await api.get(`${A}/cancelamentos`);
    const pendentes = lista.filter((s) => s.status === 'SOLICITADA');
    const visiveis = filtro ? lista.filter((s) => s.status === filtro) : lista;
    const filtros = [['SOLICITADA', 'Em análise', pendentes.length], ['APROVADA', 'Aprovadas'], ['RECUSADA', 'Recusadas'], ['', 'Todas']];

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Cancelamentos de matrícula</h1><p>Pedidos enviados pelos alunos. Aprovar desvincula as turmas e libera as vagas na hora; recusar exige um parecer, que o aluno vê no portal.</p></div>
            <div class="segmented" id="cc-filtro">${raw(filtros.map(([v, l, n]) => `<button data-v="${v}" class="${filtro === v ? 'is-active' : ''}">${l}${n ? ` <span class="badge danger plain">${n}</span>` : ''}</button>`).join(''))}</div>
        </div>
        ${raw(visiveis.length ? `<div class="cancel-list">${visiveis.map((s) => `
            <button class="cancel-card ${s.status === 'SOLICITADA' ? 'is-pending' : ''}" data-id="${s.id}">
                <div class="cancel-who">${avatar({ nome: s.alunoNome })}<div><strong>${esc(s.alunoNome)}</strong><small class="faint num">${esc(s.matricula)} · ${esc(s.alunoEmail || '')}</small></div></div>
                <div class="cancel-turmas">${s.turmas.map((t) => `<span class="chip-turma"><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}"></i>${esc(t.nome)}</span>`).join('') || '<span class="faint">Turmas já encerradas</span>'}</div>
                <div class="cancel-meta"><span>${esc(MOTIVOS_CANCEL[s.motivo] || s.motivo)}</span><small class="faint">${relativo(s.solicitadoEm)}</small></div>
                <div class="cancel-status">${statusCancel(s.status)}${s.diagnostico ? diagBadge(s.diagnostico) : ''}</div>
            </button>`).join('')}</div>`
            : `<div class="panel">${vazio('fa-user-check', filtro === 'SOLICITADA' ? 'Nenhum pedido aguardando' : 'Nada por aqui', filtro === 'SOLICITADA' ? 'Quando um aluno solicitar cancelamento, o pedido aparece aqui na hora.' : 'Nenhuma solicitação com este status.')}</div>`)}`;

    $('#cc-filtro').onclick = (e) => {
        const b = e.target.closest('[data-v]');
        if (b) ctx.navegar(`#/cancelamentos?status=${b.dataset.v}`);
    };
    ctx.el.querySelector('.cancel-list')?.addEventListener('click', (e) => {
        const c = e.target.closest('[data-id]');
        if (c) abrirCancelamento(Number(c.dataset.id));
    });
    if (ctx.params.id && !ctx.suave) abrirCancelamento(Number(ctx.params.id));
}

function abrirCancelamento(id) {
    drawer({
        titulo: 'Solicitação de cancelamento',
        largura: 620,
        render: async (body, d) => {
            const s = await api.get(`${A}/cancelamentos/${id}`);
            const g = s.diagnostico;
            d.titulo(s.alunoNome, `${s.matricula} · solicitada em ${dataHora(s.solicitadoEm)}`);
            body.innerHTML = html`
                <div class="row between wrap">${raw(statusCancel(s.status))}<span class="faint num">${relativo(s.solicitadoEm)}</span></div>
                <section>
                    <h4 class="drawer-sec">Aluno</h4>
                    <dl class="kv"><dt>Nome</dt><dd>${s.alunoNome}</dd><dt>E-mail</dt><dd>${s.alunoEmail || '—'}</dd><dt>Matrícula</dt><dd class="num">${s.matricula}</dd></dl>
                </section>
                <section>
                    <h4 class="drawer-sec">Turmas a cancelar</h4>
                    ${raw(s.turmas.length ? `<ul class="list-plain">${s.turmas.map((t) => `<li><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}" style="color:var(--amber);width:20px"></i><span style="flex:1"><strong>${esc(t.nome)}</strong><br><small class="faint">${esc(t.professorNome)} · ${(t.dias || []).map((x) => DIAS[x - 1]).join(' · ')} · ${esc(t.horarioInicio)}–${esc(t.horarioFim)}</small></span><span class="faint num" title="Ocupação">${t.ocupadas}/${t.limiteVagas}</span></li>`).join('')}</ul>` : '<p class="faint">As turmas desta solicitação já foram encerradas.</p>')}
                </section>
                <section>
                    <h4 class="drawer-sec">Diagnóstico financeiro</h4>
                    ${raw(g.adimplente
                        ? `<div class="diag ok"><i class="fas fa-circle-check"></i><div><strong>Adimplente</strong><p>${Number(g.totalEmAberto) ? `${moeda(g.totalEmAberto)} em aberto ainda a vencer (${g.faturasPendentes + g.faturasEmAnalise} cobrança(s)).` : 'Nenhuma cobrança em aberto.'}</p></div></div>`
                        : `<div class="diag danger"><i class="fas fa-triangle-exclamation"></i><div><strong>Pendência financeira: ${moeda(g.totalAtrasado)} em atraso</strong><p>${g.faturasAtrasadas} parcela(s) vencida(s) · ${moeda(g.totalEmAberto)} em aberto no total.</p></div></div>`)}
                    ${raw(g.abertas.length ? `<ul class="list-plain mt-4">${g.abertas.map((f) => `<li>${badge(f.status)}<span style="flex:1">${esc(f.titulo)}<br><small class="faint num">vence ${data(f.dataVencimento)}${f.diasAtraso ? ` · ${f.diasAtraso} dia(s) em atraso` : ''}</small></span><b class="num">${moeda(f.valor)}</b></li>`).join('')}</ul>` : '')}
                </section>
                <section>
                    <h4 class="drawer-sec">Justificativa do aluno</h4>
                    <p><span class="badge plain">${MOTIVOS_CANCEL[s.motivo] || s.motivo}</span></p>
                    <blockquote class="quote">${s.justificativa}</blockquote>
                </section>
                ${raw(s.resposta || s.avaliadoEm ? `<section><h4 class="drawer-sec">Parecer</h4><div class="parecer"><i class="fas fa-comment"></i><span>${esc(s.resposta || 'Sem mensagem.')}<br><small class="faint">${esc(s.avaliadoPorNome || '')} · ${dataHora(s.avaliadoEm)}</small></span></div></section>` : '')}`;
            d.acoes(s.status === 'SOLICITADA'
                ? '<button class="btn btn-ghost" data-d="recusar"><i class="fas fa-hand"></i> Recusar / reter</button><button class="btn btn-danger" data-d="aprovar"><i class="fas fa-user-xmark"></i> Aprovar cancelamento</button>'
                : '');
            d.foot.onclick = async (e) => {
                const b = e.target.closest('[data-d]');
                if (!b) return;
                if (b.dataset.d === 'aprovar') {
                    const msg = await confirmar({
                        titulo: 'Aprovar cancelamento',
                        texto: `${s.alunoNome} será desvinculado(a) de ${s.turmas.map((t) => t.nome).join(', ') || 'nenhuma turma ativa'}. As vagas são liberadas na hora.${g.adimplente ? '' : ' Atenção: há pendência financeira, que continua devida.'}`,
                        confirmar: 'Aprovar cancelamento', perigo: true, motivo: true, rotuloMotivo: 'Mensagem ao aluno (opcional)',
                    });
                    if (msg === false) return;
                    await api.post(`${A}/cancelamentos/${s.id}/aprovar`, { resposta: msg || null });
                    toastOk('Cancelamento aprovado', 'Turmas desvinculadas e vagas liberadas. O aluno foi notificado.');
                    d.recarregar();
                } else {
                    const parecer = await confirmar({
                        titulo: 'Recusar / reter solicitação',
                        texto: 'A matrícula continua ativa. Escreva o parecer que o aluno verá no histórico da solicitação.',
                        confirmar: 'Enviar parecer', motivo: true, motivoObrigatorio: true, rotuloMotivo: 'Parecer ao aluno',
                    });
                    if (parecer === false) return;
                    await api.post(`${A}/cancelamentos/${s.id}/recusar`, { resposta: parecer });
                    toastOk('Solicitação respondida', 'A matrícula foi mantida e o aluno recebeu seu parecer.');
                    d.recarregar();
                }
            };
        },
    });
}

// ======================================================================
// 6. Comunicados
// ======================================================================
const PUBLICAR_ADM = { endpoint: `${A}/comunicados`, turmasUrl: `${A}/turmas`, permiteEstudio: true };
const telaComunicados = (ctx) => telaMural(ctx, {
    endpoint: `${A}/comunicados`,
    rotuloTurmas: 'Turmas',
    descricao: 'Tudo o que foi publicado no estúdio, pela administração e pelos professores.',
    publicar: PUBLICAR_ADM,
});
const formComunicado = () => abrirEditor(PUBLICAR_ADM);

// ======================================================================
// 7. Salas & modalidades
// ======================================================================
async function telaCatalogo(ctx) {
    const [salas, modalidades] = await Promise.all([api.get(`${A}/salas`), api.get(`${A}/modalidades`)]);
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Salas e modalidades</h1><p>Espaços físicos e estilos oferecidos. A capacidade da sala limita as vagas das turmas.</p></div></div>
        <div class="grid grid-2">
            <section class="panel flush"><div class="panel-head"><h3>Salas</h3><button class="btn btn-sm btn-primary" data-acao="sala"><i class="fas fa-plus"></i> Nova sala</button></div><div id="tbl-salas"></div></section>
            <section class="panel flush"><div class="panel-head"><h3>Modalidades</h3><button class="btn btn-sm btn-primary" data-acao="mod"><i class="fas fa-plus"></i> Nova modalidade</button></div><div id="tbl-mods"></div></section>
        </div>`;
    const ts = new SmartTable({
        el: $('#tbl-salas'),
        colunas: [
            { chave: 'nome', titulo: 'Sala', render: (s) => `<strong>${esc(s.nome)}</strong><br><small class="faint">${esc(s.recursos || '')}</small>` },
            { chave: 'capacidade', titulo: 'Capacidade', num: true },
            { chave: 'ativo', titulo: 'Status', render: (s) => badge(s.ativo ? 'ATIVO' : 'SUSPENSO', s.ativo ? 'Ativa' : 'Inativa') },
        ],
        onLinha: (s) => formSala(s),
    });
    ts.setDados(salas);
    const tm = new SmartTable({
        el: $('#tbl-mods'),
        colunas: [
            { chave: 'nome', titulo: 'Modalidade', render: (m) => `<i class="fas ${esc(m.icone)}" style="color:var(--amber);width:20px"></i> <strong>${esc(m.nome)}</strong><br><small class="faint">${esc(m.categoria || '')}</small>` },
            { chave: 'turmas', titulo: 'Turmas', num: true },
            { chave: 'alunos', titulo: 'Alunos', num: true },
        ],
        onLinha: (m) => formModalidade(m),
    });
    tm.setDados(modalidades);
    ctx.el.querySelector('[data-acao="sala"]').onclick = () => formSala();
    ctx.el.querySelector('[data-acao="mod"]').onclick = () => formModalidade();
}

function formSala(s = null) {
    modal({
        titulo: s ? `Editar ${s.nome}` : 'Nova sala',
        corpo: `<div class="form-grid">
            <div class="field"><label for="s-nome">Nome</label><input class="input" id="s-nome" name="nome" value="${esc(s?.nome || '')}" required></div>
            <div class="field"><label for="s-cap">Capacidade</label><input class="input num" type="number" min="1" id="s-cap" name="capacidade" value="${esc(s?.capacidade || '')}" required></div>
            <div class="field span-2"><label for="s-rec">Recursos</label><textarea class="input" id="s-rec" name="recursos" rows="3">${esc(s?.recursos || '')}</textarea></div>
            <label class="check-item span-2"><input type="checkbox" name="ativo" value="true" ${s?.ativo === false ? '' : 'checked'}><span class="grow">Sala disponível para novas turmas</span></label>
        </div>`,
        onSubmit: async (d) => {
            const corpo = { nome: d.nome, capacidade: Number(d.capacidade), recursos: d.recursos, ativo: d.ativo === 'true' };
            if (s) await api.put(`${A}/salas/${s.id}`, corpo, { silencioso: true }); else await api.post(`${A}/salas`, corpo, { silencioso: true });
            toastOk(s ? 'Sala atualizada' : 'Sala criada', d.nome);
        },
    });
}

function formModalidade(m = null) {
    modal({
        titulo: m ? `Editar ${m.nome}` : 'Nova modalidade',
        corpo: `<div class="form-grid">
            <div class="field"><label for="m-nome">Nome</label><input class="input" id="m-nome" name="nome" value="${esc(m?.nome || '')}" required></div>
            <div class="field"><label for="m-cat">Categoria</label><input class="input" id="m-cat" name="categoria" value="${esc(m?.categoria || '')}" placeholder="Urbanas, Clássicas…"></div>
            <div class="field span-2"><label for="m-desc">Descrição</label><textarea class="input" id="m-desc" name="descricao" rows="3">${esc(m?.descricao || '')}</textarea></div>
            <div class="field"><label for="m-ico">Ícone (Font Awesome)</label><input class="input" id="m-ico" name="icone" value="${esc(m?.icone || 'fa-music')}"></div>
            <div class="field"><label>&nbsp;</label><label class="check-item"><input type="checkbox" name="ativo" value="true" ${m?.ativo === false ? '' : 'checked'}><span class="grow">Modalidade ativa</span></label></div>
        </div>`,
        onSubmit: async (d) => {
            const corpo = { nome: d.nome, categoria: d.categoria, descricao: d.descricao, icone: d.icone, ativo: d.ativo === 'true' };
            if (m) await api.put(`${A}/modalidades/${m.id}`, corpo, { silencioso: true }); else await api.post(`${A}/modalidades`, corpo, { silencioso: true });
            toastOk(m ? 'Modalidade atualizada' : 'Modalidade criada', d.nome);
        },
    });
}

// ======================================================================
// 8. Auditoria
// ======================================================================
async function telaAuditoria(ctx) {
    const lista = await api.get(`${A}/auditoria`, { query: { limite: 1000 } });
    const entidades = [...new Set(lista.map((a) => a.entidade))].sort();
    const acoes = [...new Set(lista.map((a) => a.acao))].sort();
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Log de auditoria</h1><p>Quem criou, editou, excluiu ou aprovou registros — com data, perfil e IP de origem.</p></div></div>
        <div class="panel flush">
            <div class="table-tools">
                <div class="input-icon"><i class="fas fa-magnifying-glass"></i><input class="input" id="au-busca" placeholder="Buscar por descrição ou autor"></div>
                <select class="input" id="au-ent" style="width:auto"><option value="">Todas as áreas</option>${raw(entidades.map((e) => `<option>${esc(e)}</option>`).join(''))}</select>
                <select class="input" id="au-acao" style="width:auto"><option value="">Todas as ações</option>${raw(acoes.map((e) => `<option>${esc(e)}</option>`).join(''))}</select>
            </div>
            <div id="tbl-aud"></div>
        </div>`;
    const t = new SmartTable({
        el: $('#tbl-aud'),
        busca: (a) => `${a.descricao} ${a.usuarioNome}`,
        porPagina: 15,
        colunas: [
            { chave: 'dataHora', titulo: 'Quando', render: (a) => `<span class="num">${dataHora(a.dataHora)}</span>` },
            { chave: 'usuarioNome', titulo: 'Autor', render: (a) => `${esc(a.usuarioNome || 'Sistema')}${a.perfil ? `<br>${badge(a.perfil)}` : ''}` },
            { chave: 'acao', titulo: 'Ação', render: (a) => `<span class="badge plain">${esc(a.acao)}</span>` },
            { chave: 'entidade', titulo: 'Área', render: (a) => `${esc(a.entidade)}${a.idEntidade ? ` <span class="faint num">#${a.idEntidade}</span>` : ''}` },
            { chave: 'descricao', titulo: 'Detalhes', render: (a) => `<span class="muted">${esc(a.descricao || '')}</span>` },
            { chave: 'ip', titulo: 'IP', render: (a) => `<span class="num faint">${esc(a.ip || '—')}</span>` },
        ],
        vazio: ['fa-shield-halved', 'Nenhum registro para os filtros'],
    });
    t.setDados(lista);
    $('#au-busca').addEventListener('input', (e) => t.buscar(e.target.value));
    $('#au-ent').addEventListener('change', (e) => t.setFiltro('ent', e.target.value ? (a) => a.entidade === e.target.value : null));
    $('#au-acao').addEventListener('change', (e) => t.setFiltro('acao', e.target.value ? (a) => a.acao === e.target.value : null));
}

// ======================================================================
// 9. Pedidos de acesso ("Quero dançar")
// ======================================================================
const EXP_ACESSO = { NUNCA: 'Nunca dançou', POUCA: 'Já fez algumas aulas', REGULAR: 'Dança com frequência', PROFISSIONAL: 'Dança profissionalmente' };
const OBJ_ACESSO = { HOBBY: 'Diversão', SAUDE: 'Saúde e bem-estar', SOCIAL: 'Fazer amigos', PALCO: 'Subir ao palco', COMPETICAO: 'Competir', OUTRO: 'Outro' };
const DISP_ROTULO = { SEG: 'Seg', TER: 'Ter', QUA: 'Qua', QUI: 'Qui', SEX: 'Sex', SAB: 'Sáb', DOM: 'Dom', MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' };
const linkConvite = (p) => `${location.origin}${location.pathname.replace(/Admin\/.*$/, '')}index.html#acompanhar=${encodeURIComponent(p.protocolo)}`;
const mensagemConvite = (p) => `Olá, ${p.nome.split(' ')[0]}! Seu pedido no VibeDance foi aprovado.\n\nSeu login: ${p.emailInstitucional}\nPara criar sua senha, acesse ${linkConvite(p)} e informe o protocolo ${p.protocolo} com o e-mail ${p.emailContato}.\n\nTe esperamos no estúdio!`;
const statusAcesso = (p) => (p.status === 'APROVADA'
    ? (p.ativadoEm ? badge('ATIVO', 'Acesso ativo') : p.conviteExpirado ? badge('VENCIDO', 'Convite expirado') : badge('PENDENTE', 'Aguardando ativação'))
    : badge(p.status));

async function copiar(texto, rotulo = 'Copiado') {
    try {
        await navigator.clipboard.writeText(texto);
        toastOk(rotulo);
    } catch {
        modal({ titulo: 'Copie manualmente', corpo: `<textarea class="input" rows="6" readonly>${esc(texto)}</textarea>`, confirmar: 'Fechar', onSubmit: () => {} });
    }
}

async function telaAcessos(ctx) {
    const filtro = ctx.params.status ?? 'ABERTOS';
    const lista = await api.get(`${A}/acessos`);
    const abertos = lista.filter((p) => ['NOVA', 'EM_CONTATO'].includes(p.status));
    const aguardando = lista.filter((p) => p.status === 'APROVADA' && !p.ativadoEm);
    const mes = new Date().toISOString().slice(0, 7);
    const ativadosMes = lista.filter((p) => p.ativadoEm && String(p.ativadoEm).startsWith(mes)).length;
    const visiveis = lista.filter((p) => (filtro === 'ABERTOS' ? ['NOVA', 'EM_CONTATO'].includes(p.status)
        : filtro === 'CONVITE' ? p.status === 'APROVADA' && !p.ativadoEm : !filtro || p.status === filtro));
    const filtros = [['ABERTOS', 'Em análise', abertos.length], ['CONVITE', 'Aguardando ativação', aguardando.length], ['APROVADA', 'Aprovados'], ['RECUSADA', 'Recusados'], ['', 'Todos']];

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Pedidos de acesso</h1><p>Quem quer começar a dançar envia o pedido pela página inicial. Aprove para criar a conta @vibedance.com e matricular; a pessoa ativa o acesso criando a própria senha.</p></div>
            <div class="page-actions"><button class="btn" data-acao="link"><i class="fas fa-link"></i> Copiar link do formulário</button><button class="btn btn-primary" data-acao="novo"><i class="fas fa-user-plus"></i> Criar conta direto</button></div>
        </div>
        <section class="grid grid-4">
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-inbox"></i> Novos</span><span class="kpi-value num">${lista.filter((p) => p.status === 'NOVA').length}</span><span class="kpi-foot">aguardando o primeiro contato</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-phone"></i> Em contato</span><span class="kpi-value num">${lista.filter((p) => p.status === 'EM_CONTATO').length}</span><span class="kpi-foot">conversa em andamento</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-envelope-open-text"></i> Convites pendentes</span><span class="kpi-value num">${aguardando.length}</span><span class="kpi-foot">aprovados, sem senha criada</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-user-check"></i> Novos alunos no mês</span><span class="kpi-value num">${ativadosMes}</span><span class="kpi-foot">acessos ativados</span></div>
        </section>
        <div class="row between wrap mt-4" style="gap:12px">
            <div class="segmented" id="ac-filtro">${raw(filtros.map(([v, l, n]) => `<button data-v="${v}" class="${filtro === v ? 'is-active' : ''}">${l}${n ? ` <span class="badge info plain">${n}</span>` : ''}</button>`).join(''))}</div>
            <span class="faint">${visiveis.length} pedido(s)</span>
        </div>
        ${raw(visiveis.length ? `<div class="access-grid mt-4">${visiveis.map((p) => `
            <button class="access-card is-${p.status.toLowerCase()}" data-id="${p.id}">
                <header>
                    ${avatar({ nome: p.nome })}
                    <div class="access-who"><strong>${esc(p.nome)}</strong><small class="faint num">${esc(p.protocolo)} · ${relativo(p.solicitadoEm)}</small></div>
                    ${statusAcesso(p)}
                </header>
                <div class="access-tags">${(p.modalidades.length ? p.modalidades : ['Sem estilo definido']).map((m) => `<span class="chip-turma"><i class="fas fa-music"></i>${esc(m)}</span>`).join('')}</div>
                <dl class="access-facts">
                    <div><dt>Experiência</dt><dd>${esc(EXP_ACESSO[p.experiencia] || p.experiencia)}</dd></div>
                    <div><dt>Turmas</dt><dd>${p.turmasInteresse.length ? esc(p.turmasInteresse.map((t) => t.nome).join(', ')) : '<span class="faint">A definir</span>'}</dd></div>
                    <div><dt>Disponível</dt><dd>${esc(p.disponibilidade.map((d) => DISP_ROTULO[d] || d).join(' · ') || '—')}</dd></div>
                </dl>
            </button>`).join('')}</div>`
            : `<div class="panel mt-4">${vazio('fa-inbox', filtro === 'ABERTOS' ? 'Nenhum pedido aguardando' : 'Nada por aqui', filtro === 'ABERTOS' ? 'Quando alguém pedir acesso pela página inicial, o pedido aparece aqui na hora.' : 'Nenhum pedido com este status.')}</div>`)}`;

    $('#ac-filtro').onclick = (e) => {
        const b = e.target.closest('[data-v]');
        if (b) ctx.navegar(`#/acessos?status=${b.dataset.v}`);
    };
    ctx.el.querySelector('.access-grid')?.addEventListener('click', (e) => {
        const c = e.target.closest('[data-id]');
        if (c) abrirAcesso(Number(c.dataset.id));
    });
    ctx.el.querySelector('[data-acao="link"]').onclick = () => copiar(`${location.origin}${location.pathname.replace(/Admin\/.*$/, '')}index.html#quero-dancar`, 'Link do formulário copiado');
    ctx.el.querySelector('[data-acao="novo"]').onclick = () => formUsuario();
    if (ctx.params.id && !ctx.suave) abrirAcesso(Number(ctx.params.id));
}

function abrirAcesso(id) {
    drawer({
        titulo: 'Pedido de acesso',
        largura: 640,
        render: async (body, d) => {
            const p = await api.get(`${A}/acessos/${id}`);
            const aberto = ['NOVA', 'EM_CONTATO'].includes(p.status);
            const fone = (p.telefone || '').replace(/\D/g, '');
            d.titulo(p.nome, `${p.protocolo} · pedido ${dataHora(p.solicitadoEm)}`);
            body.innerHTML = html`
                <div class="row between wrap">${raw(statusAcesso(p))}<span class="faint num">${relativo(p.solicitadoEm)}</span></div>
                ${raw(p.alertas.map((a) => `<div class="callout warn"><i class="fas fa-triangle-exclamation"></i><span>${esc(a)}</span></div>`).join(''))}
                ${raw(p.status === 'APROVADA' ? `
                <section class="invite-box ${p.ativadoEm ? 'is-done' : p.conviteExpirado ? 'is-late' : ''}">
                    <div class="invite-head"><i class="fas ${p.ativadoEm ? 'fa-circle-check' : 'fa-envelope-open-text'}"></i><div><strong>${p.ativadoEm ? 'Acesso ativado' : p.conviteExpirado ? 'Convite expirado' : 'Convite enviado, aguardando ativação'}</strong><small>${p.ativadoEm ? `em ${dataHora(p.ativadoEm)}` : `aprovado em ${dataHora(p.avaliadoEm)} · válido por 14 dias`}</small></div></div>
                    <dl class="kv"><dt>Login</dt><dd>${esc(p.emailInstitucional)}</dd><dt>Protocolo</dt><dd class="num">${esc(p.protocolo)}</dd></dl>
                    ${p.ativadoEm ? `<div class="row wrap"><a class="btn btn-sm" href="#/usuarios?id=${p.usuarioId}"><i class="fas fa-user"></i> Abrir cadastro do aluno</a></div>`
                        : `<div class="row wrap"><button class="btn btn-sm btn-primary" data-b="msg"><i class="fas fa-copy"></i> Copiar mensagem de convite</button>${fone ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/55${fone}?text=${encodeURIComponent(mensagemConvite(p))}"><i class="fab fa-whatsapp"></i> Enviar no WhatsApp</a>` : ''}<button class="btn btn-sm btn-ghost" data-b="renovar"><i class="fas fa-rotate"></i> Renovar prazo</button></div>`}
                </section>` : '')}
                <section>
                    <h4 class="drawer-sec">Contato</h4>
                    <dl class="kv">
                        <dt>E-mail</dt><dd>${p.emailContato}</dd>
                        <dt>Telefone</dt><dd class="num">${p.telefone}${raw(fone ? ` <a href="https://wa.me/55${fone}" target="_blank" rel="noopener" title="Abrir WhatsApp"><i class="fab fa-whatsapp"></i></a>` : '')}</dd>
                        <dt>CPF</dt><dd class="num">${p.cpf}</dd>
                        <dt>Nascimento</dt><dd class="num">${p.dataNascimento ? `${data(p.dataNascimento)} · ${p.idade} anos` : '—'}</dd>
                        <dt>Conheceu por</dt><dd>${p.origem || '—'}</dd>
                    </dl>
                </section>
                <section>
                    <h4 class="drawer-sec">Perfil de dança</h4>
                    <div class="access-tags">${raw((p.modalidades.length ? p.modalidades : ['Sem estilo definido']).map((m) => `<span class="chip-turma"><i class="fas fa-music"></i>${esc(m)}</span>`).join(''))}</div>
                    <dl class="kv mt-4">
                        <dt>Experiência</dt><dd>${EXP_ACESSO[p.experiencia] || p.experiencia}</dd>
                        <dt>Objetivo</dt><dd>${OBJ_ACESSO[p.objetivo] || '—'}</dd>
                    </dl>
                    <div class="dispo mt-4">${raw(Object.entries(DISP_ROTULO).map(([k, l]) => `<span class="${p.disponibilidade.includes(k) ? 'is-on' : ''}">${l}</span>`).join(''))}</div>
                </section>
                <section>
                    <h4 class="drawer-sec">Turmas de interesse</h4>
                    ${raw(p.turmasInteresse.length ? `<ul class="list-plain">${p.turmasInteresse.map((t) => `<li><span class="list-ico"><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}"></i></span><span style="flex:1;min-width:0"><strong>${esc(t.nome)}</strong><br><small class="faint">${esc(t.professorNome)} · ${esc(t.diasSemana)} · ${esc(t.horarioInicio)}</small></span><span class="num ${t.ocupadas >= t.limiteVagas ? 'danger' : 'faint'}">${t.ocupadas}/${t.limiteVagas}</span></li>`).join('')}</ul>` : '<p class="faint">Nenhuma turma escolhida. Sugira uma no contato.</p>')}
                </section>
                ${raw(p.mensagem ? `<section><h4 class="drawer-sec">Mensagem</h4><blockquote class="quote">${esc(p.mensagem)}</blockquote></section>` : '')}
                ${raw(p.resposta ? `<section><h4 class="drawer-sec">${p.status === 'RECUSADA' ? 'Resposta enviada' : 'Mensagem de boas-vindas'}</h4><div class="parecer"><i class="fas fa-comment"></i><span>${esc(p.resposta)}<br><small class="faint">${esc(p.avaliadoPorNome || '')} · ${dataHora(p.avaliadoEm)}</small></span></div></section>` : '')}
                <section>
                    <h4 class="drawer-sec">Anotações da recepção</h4>
                    <textarea class="input" id="ac-nota" rows="3" maxlength="1000" placeholder="Ex.: prefere contato à noite; aula experimental marcada para terça.">${p.notaInterna || ''}</textarea>
                    <div class="row mt-4"><button class="btn btn-sm" data-b="nota"><i class="fas fa-floppy-disk"></i> Salvar anotação</button><span class="faint" style="font-size:.8rem">Visível só para a administração.</span></div>
                </section>`;
            d.acoes(aberto
                ? `<button class="btn btn-ghost" data-d="recusar"><i class="fas fa-xmark"></i> Recusar</button>${p.status === 'NOVA' ? '<button class="btn" data-d="contato"><i class="fas fa-phone"></i> Marcar em contato</button>' : ''}<button class="btn btn-primary" data-d="aprovar"><i class="fas fa-user-check"></i> Aprovar e criar conta</button>`
                : '');

            body.onclick = async (e) => {
                const b = e.target.closest('[data-b]');
                if (!b) return;
                if (b.dataset.b === 'msg') copiar(mensagemConvite(p), 'Mensagem de convite copiada');
                if (b.dataset.b === 'renovar') {
                    await comBotao(b, () => api.post(`${A}/acessos/${p.id}/renovar-convite`));
                    toastOk('Prazo renovado', 'O convite vale por mais 14 dias.');
                    d.recarregar();
                }
                if (b.dataset.b === 'nota') {
                    await comBotao(b, () => api.put(`${A}/acessos/${p.id}/nota`, { nota: body.querySelector('#ac-nota').value }));
                    toastOk('Anotação salva');
                }
            };
            d.foot.onclick = async (e) => {
                const b = e.target.closest('[data-d]');
                if (!b) return;
                if (b.dataset.d === 'contato') {
                    await comBotao(b, () => api.post(`${A}/acessos/${p.id}/contato`, { nota: body.querySelector('#ac-nota').value || null }));
                    toastOk('Pedido em contato', 'A pessoa vê o novo status ao acompanhar o pedido.');
                    d.recarregar();
                } else if (b.dataset.d === 'recusar') {
                    const resposta = await confirmar({
                        titulo: `Recusar o pedido de ${p.nome.split(' ')[0]}?`,
                        texto: 'Escreva com cuidado: a pessoa lê esta mensagem ao acompanhar o pedido pelo protocolo.',
                        confirmar: 'Recusar pedido', perigo: true, motivo: true, motivoObrigatorio: true, rotuloMotivo: 'Mensagem para a pessoa',
                    });
                    if (resposta === false) return;
                    await api.post(`${A}/acessos/${p.id}/recusar`, { resposta });
                    toastOk('Pedido recusado', 'A resposta já aparece no acompanhamento.');
                    d.recarregar();
                } else if (b.dataset.d === 'aprovar') {
                    aprovarAcesso(p, () => d.recarregar());
                }
            };
        },
    });
}

async function aprovarAcesso(p, aoConcluir) {
    const turmas = await api.get(`${A}/turmas`);
    const interesse = new Set(p.turmasInteresse.map((t) => t.id));
    const ordenadas = [...turmas].sort((a, b) => Number(interesse.has(b.id)) - Number(interesse.has(a.id)) || a.nome.localeCompare(b.nome));
    modal({
        titulo: `Aprovar ${p.nome.split(' ')[0]}`,
        subtitulo: 'Cria a conta de aluno, faz as matrículas e gera o convite de ativação.',
        confirmar: 'Aprovar e criar conta',
        largo: true,
        etapas: [
            {
                titulo: 'Conta',
                html: `<div class="form-grid">
                    <div class="field span-2"><label for="ap-email">E-mail institucional (login)</label><div class="input-icon"><i class="fas fa-at"></i><input class="input" id="ap-email" name="emailInstitucional" value="${esc(p.sugestaoEmail || '')}" required></div><span class="hint">Sugerido a partir do nome. Precisa terminar em @vibedance.com.</span></div>
                    <div class="field span-2"><label>Dados que vão para o cadastro</label><dl class="kv"><dt>Nome</dt><dd>${esc(p.nome)}</dd><dt>CPF</dt><dd class="num">${esc(p.cpf)}</dd><dt>Telefone</dt><dd class="num">${esc(p.telefone)}</dd></dl></div>
                </div>`,
                validar: (form) => (/^[a-z0-9._%+-]+@vibedance\.com$/i.test(form.emailInstitucional.value.trim()) ? true : 'O login precisa terminar em @vibedance.com.'),
            },
            {
                titulo: 'Matrículas',
                html: `<p class="muted" style="margin-bottom:12px">Turmas de interesse já vêm marcadas. Ajuste se combinou outro horário.</p>
                    <div class="check-list">${ordenadas.map((t) => {
                        const cheia = t.ocupadas >= t.limiteVagas;
                        return `<label class="check-item"><input type="checkbox" name="turmas" data-array value="${t.id}" ${interesse.has(t.id) && !cheia ? 'checked' : ''} ${cheia ? 'disabled' : ''}><span class="grow">${esc(t.nome)}${interesse.has(t.id) ? ' <span class="badge info plain">interesse</span>' : ''}<small>${esc(t.diasSemana)} · ${esc(t.horarioInicio)} · ${esc(t.professorNome)}</small></span><span class="num faint">${t.ocupadas}/${t.limiteVagas}</span></label>`;
                    }).join('')}</div>`,
            },
            {
                titulo: 'Boas-vindas',
                html: `<div class="field"><label for="ap-msg">Mensagem de boas-vindas <span class="faint">(a pessoa vê ao ativar)</span></label><textarea class="input" id="ap-msg" name="mensagem" rows="4" maxlength="1000">Seja muito bem-vindo(a) ao VibeDance, ${esc(p.nome.split(' ')[0])}! Te esperamos na primeira aula.</textarea></div>
                    <div class="callout mt-4"><i class="fas fa-circle-info"></i><span>A conta nasce sem senha conhecida. A pessoa cria a própria senha pelo protocolo <b class="num">${esc(p.protocolo)}</b>, em até 14 dias.</span></div>`,
            },
        ],
        onSubmit: async (dados, form) => {
            const ids = [...form.querySelectorAll('input[name=turmas]:checked')].map((c) => Number(c.value));
            const r = await api.post(`${A}/acessos/${p.id}/aprovar`, {
                emailInstitucional: dados.emailInstitucional.trim().toLowerCase(), turmas: ids, mensagem: dados.mensagem || null,
            }, { silencioso: true });
            toastOk('Conta criada', `${r.emailInstitucional}${ids.length ? ` · ${ids.length} matrícula(s)` : ''}`);
            aoConcluir?.();
            mostrarConvite(r);
        },
    });
}

function mostrarConvite(p) {
    const fone = (p.telefone || '').replace(/\D/g, '');
    modal({
        titulo: 'Convite pronto',
        subtitulo: 'Envie para a pessoa ativar o acesso.',
        confirmar: 'Concluir',
        corpo: `<div class="invite-box">
                <div class="invite-head"><i class="fas fa-envelope-open-text"></i><div><strong>${esc(p.nome)}</strong><small>${esc(p.emailContato)}</small></div></div>
                <dl class="kv"><dt>Login</dt><dd>${esc(p.emailInstitucional)}</dd><dt>Protocolo</dt><dd class="num">${esc(p.protocolo)}</dd></dl>
            </div>
            <div class="field mt-4"><label for="cv-msg">Mensagem</label><textarea class="input" id="cv-msg" rows="7" readonly>${esc(mensagemConvite(p))}</textarea></div>
            <div class="row wrap mt-4"><button type="button" class="btn btn-sm" id="cv-copiar"><i class="fas fa-copy"></i> Copiar mensagem</button>${fone ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/55${fone}?text=${encodeURIComponent(mensagemConvite(p))}"><i class="fab fa-whatsapp"></i> Enviar no WhatsApp</a>` : ''}</div>`,
        onAbrir: (form) => { form.querySelector('#cv-copiar').onclick = () => copiar(mensagemConvite(p), 'Mensagem copiada'); },
        onSubmit: () => {},
    });
}

// ======================================================================
// Portal
// ======================================================================
criarPortal({
    perfis: ['ADMINISTRADOR'],
    nome: 'Cockpit ADM',
    icone: 'fa-wave-square',
    inicial: 'dashboard',
    rotas: [
        { id: 'dashboard', titulo: 'Visão do estúdio', icone: 'fa-chart-pie', grupo: 'Inteligência', dominios: ['financeiro', 'matriculas', 'turmas', 'usuarios', 'reposicoes', 'auditoria'], render: telaDashboard },
        { id: 'grade', titulo: 'Grade horária', icone: 'fa-calendar-week', grupo: 'Operação', dominios: ['turmas', 'matriculas'], render: telaGrade },
        { id: 'reposicoes', titulo: 'Reposições', icone: 'fa-rotate', grupo: 'Operação', dominios: ['reposicoes'], render: telaReposicoes },
        { id: 'acessos', titulo: 'Pedidos de acesso', icone: 'fa-door-open', grupo: 'Operação', dominios: ['acessos', 'usuarios'], render: telaAcessos },
        { id: 'cancelamentos', titulo: 'Cancelamentos', icone: 'fa-user-xmark', grupo: 'Operação', dominios: ['cancelamentos', 'matriculas', 'financeiro'], render: telaCancelamentos },
        { id: 'avisos', titulo: 'Avisos', icone: 'fa-bullhorn', grupo: 'Operação', dominios: ['comunicados'], render: telaComunicados },
        { id: 'financeiro', titulo: 'Financeiro', icone: 'fa-wallet', grupo: 'Gestão', dominios: ['financeiro'], render: telaFinanceiro },
        { id: 'usuarios', titulo: 'Usuários e matrículas', icone: 'fa-users', grupo: 'Gestão', dominios: ['usuarios', 'matriculas'], render: telaUsuarios },
        { id: 'catalogo', titulo: 'Salas e modalidades', icone: 'fa-building', grupo: 'Gestão', dominios: ['turmas'], render: telaCatalogo },
        { id: 'auditoria', titulo: 'Auditoria', icone: 'fa-shield-halved', grupo: 'Segurança', dominios: ['auditoria'], render: telaAuditoria },
    ],
    comandos: [
        { titulo: 'Nova turma', icone: 'fa-plus', acao: () => formTurma() },
        { titulo: 'Novo usuário', icone: 'fa-user-plus', acao: () => formUsuario() },
        { titulo: 'Pedidos de acesso', icone: 'fa-door-open', acao: () => { location.hash = '#/acessos'; } },
        { titulo: 'Gerar mensalidades em lote', icone: 'fa-layer-group', acao: () => formLote() },
        { titulo: 'Nova cobrança individual', icone: 'fa-user-tag', acao: () => formCobranca() },
        { titulo: 'Publicar aviso', icone: 'fa-bullhorn', acao: () => formComunicado() },
    ],
    aoIniciar: {
        contadores: async () => {
            const [rep, comp, canc, acc] = await Promise.all([
                api.get(`${A}/reposicoes`, { silencioso: true }),
                api.get(`${A}/financeiro/transacoes`, { query: { status: 'EM_ANALISE' }, silencioso: true }),
                api.get(`${A}/cancelamentos`, { query: { status: 'SOLICITADA' }, silencioso: true }),
                api.get(`${A}/acessos/pendentes`, { silencioso: true }),
            ]);
            return { reposicoes: rep.filter((r) => r.status === 'SOLICITADA').length, financeiro: comp.length, cancelamentos: canc.length, acessos: acc.total };
        },
    },
});
