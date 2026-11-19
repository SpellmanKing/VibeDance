/**
 * Portal do Aluno — passaporte digital, agenda com check-in antecipado,
 * reposições, hub de evolução, avisos e financeiro transparente.
 */
import { api } from '../js/core/api.js';
import { criarPortal } from '../js/core/shell.js';
import { linha, medidor } from '../js/core/charts.js';
import { planilhaFinanceira } from '../js/core/planilha.js';
import { abrirCheckout, abrirComprovante } from '../js/core/checkout.js';
import { telaMural } from '../js/core/mural.js';
import { rotuloMotivo as rotuloDesconto } from '../js/core/descontos.js';
import {
    $, esc, html, raw, moeda, pct, data, dataLonga, dataCurta, dataHora, relativo, avatar, badge, toastOk, toast, modal,
    confirmar, comBotao, vazio, NIVEIS, isoHoje, heroPalco, DIAS,
} from '../js/core/ui.js';

const S = '/api/aluno/portal';

const SITUACAO_FIN = { EM_DIA: 'Em dia', PENDENTE: 'Mensalidade pendente', ATRASADO: 'Pagamento em atraso', EM_ANALISE: 'Comprovante em análise' };
const ehHoje = (d) => d === isoHoje();

function rotuloDia(d) {
    if (ehHoje(d)) return 'Hoje';
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const iso = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`;
    return d === iso ? 'Amanhã' : dataLonga(d);
}

async function alternarCheckin(aula, botao) {
    const corpo = { turmaId: aula.turma.id, data: aula.data };
    await comBotao(botao, () => api.post(`${S}/checkin${aula.checkin ? '/desfazer' : ''}`, corpo));
    toastOk(aula.checkin ? 'Check-in desfeito' : 'Presença confirmada', `${aula.turma.nome} · ${rotuloDia(aula.data)} às ${aula.turma.horarioInicio}`);
}

// ======================================================================
// 1. Passaporte
// ======================================================================
async function telaPassaporte(ctx) {
    const p = await api.get(`${S}/passaporte`);
    const u = p.usuario;
    const prox = p.proximaAula;
    const finCls = { EM_DIA: 'ok', PENDENTE: 'warn', ATRASADO: 'danger', EM_ANALISE: 'info' }[p.situacaoFinanceira];

    ctx.el.innerHTML = html`
        ${raw(heroPalco({
            imagem: '../img/hero-aluno.jpg',
            eyebrow: 'Seu passaporte VibeDance',
            titulo: 'Olá,',
            destaque: u.nome.split(' ')[0],
            texto: prox ? `Sua próxima aula é ${prox.turma.nome}, ${rotuloDia(prox.data).toLowerCase()} às ${prox.turma.horarioInicio}.` : 'Escolha uma turma e comece a dançar. Seu progresso aparece aqui em tempo real.',
            meta: `<span><i class="fas fa-layer-group"></i> ${p.turmasAtivas} turma(s) ativa(s)</span><span><i class="fas fa-chart-simple"></i> ${pct(p.frequenciaGeral)} de frequência</span>`,
            acoes: prox ? '<a class="btn btn-primary" href="#/agenda"><i class="fas fa-calendar-days"></i> Ver minha agenda</a><a class="btn" href="#/evolucao"><i class="fas fa-arrow-trend-up"></i> Minha evolução</a>'
                : '<a class="btn btn-primary" href="#/explorar"><i class="fas fa-compass"></i> Explorar turmas</a>',
        }))}
        ${raw(p.alerta ? `<div class="callout ${p.alerta.includes('atraso') || p.alerta.includes('abaixo') ? 'danger' : 'warn'}" style="margin-bottom:16px"><i class="fas fa-triangle-exclamation"></i><span>${esc(p.alerta)}</span></div>` : '')}

        <section class="grid grid-main">
            <article class="passport">
                <div class="passport-top">
                    ${raw(avatar(u, 'lg'))}
                    <div>
                        <h2>${u.nome}</h2>
                        <span class="passport-code">${p.codigo}</span>
                    </div>
                </div>
                <dl class="passport-grid">
                    <div><dt>Matrícula</dt><dd>${raw(badge(p.statusMatricula))}</dd></div>
                    <div><dt>Financeiro</dt><dd><span class="badge ${finCls}">${SITUACAO_FIN[p.situacaoFinanceira] || p.situacaoFinanceira}</span></dd></div>
                    <div><dt>Turmas ativas</dt><dd class="num">${p.turmasAtivas}</dd></div>
                    <div><dt>Frequência geral</dt><dd class="num">${pct(p.frequenciaGeral)}</dd></div>
                    <div><dt>Média técnica</dt><dd class="num">${p.mediaAvaliacoes ?? '—'}${p.totalAvaliacoes ? raw(` <small class="faint">(${p.totalAvaliacoes} avaliações)</small>`) : ''}</dd></div>
                    <div><dt>Em aberto</dt><dd class="num">${moeda(p.valorEmAberto)}</dd></div>
                </dl>
            </article>

            <article class="panel">
                <div class="panel-head"><h3>Próxima aula</h3>${raw(prox ? badge(prox.tipo) : '')}</div>
                ${raw(prox ? `
                    <p class="muted">${esc(rotuloDia(prox.data))}</p>
                    <div class="countdown" style="font-size:2.4rem;margin:4px 0 8px">${esc(prox.turma.horarioInicio)}</div>
                    <h3>${esc(prox.turma.nome)}</h3>
                    <p class="muted">${esc(prox.turma.salaNome)} · ${esc(prox.turma.professorNome)}</p>
                    <div class="mt-5">${prox.checkin
                        ? `<button class="btn btn-ok btn-block" data-checkin><i class="fas fa-circle-check"></i> Presença confirmada · desfazer</button>`
                        : prox.podeCheckin ? `<button class="btn btn-primary btn-block" data-checkin><i class="fas fa-hand"></i> Confirmar presença</button>` : '<p class="faint">O check-in abre até 7 dias antes da aula.</p>'}</div>`
                    : vazio('fa-calendar-plus', 'Nenhuma aula agendada', 'Explore as turmas disponíveis para começar.', '<a class="btn btn-primary" href="#/explorar">Explorar turmas</a>'))}
            </article>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><div><h3>Frequência por turma</h3><span class="muted">Mínimo exigido: 75%. Faltas justificadas não contam.</span></div><a class="btn btn-sm" href="#/frequencia"><i class="fas fa-calendar-days"></i> Calendário completo</a></div>
                ${raw(p.frequenciaPorTurma.length ? p.frequenciaPorTurma.map((f) => `
                    <div style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
                        <div class="row between"><strong>${esc(f.turmaNome)}</strong><span class="row">${badge(f.alerta)}<b class="num">${pct(f.percentual)}</b></span></div>
                        <div style="margin:8px 0 4px">${medidor(f.percentual)}</div>
                        <small class="faint num">${f.presentes} presenças · ${f.faltas} faltas · ${f.justificadas} justificadas${f.alerta !== 'OK' ? ' · <a href="#/agenda?repor=' + f.turmaId + '">solicitar reposição</a>' : ''}</small>
                    </div>`).join('') : vazio('fa-chart-simple', 'Sem turmas ativas'))}
            </article>
            <article class="panel">
                <div class="panel-head"><h3>Próxima cobrança</h3></div>
                ${raw(p.proximaFatura ? `
                    <div class="kpi-value num">${moeda(p.proximaFatura.valor)}</div>
                    <p class="muted">${esc(p.proximaFatura.titulo)}</p>
                    <p class="num ${p.proximaFatura.diasAtraso ? 'danger' : 'faint'}">Vence em ${data(p.proximaFatura.dataVencimento)}${p.proximaFatura.diasAtraso ? ` · ${p.proximaFatura.diasAtraso} dia(s) em atraso` : ''}</p>
                    <div class="row mt-4">${badge(p.proximaFatura.status)}<a class="btn btn-sm" href="#/financeiro">Pagar ou enviar comprovante</a></div>`
                    : vazio('fa-circle-check', 'Tudo em dia', 'Nenhuma cobrança em aberto.'))}
            </article>
        </section>`;

    ctx.el.onclick = (e) => {
        const b = e.target.closest('[data-checkin]');
        if (b && prox) alternarCheckin(prox, b);
    };
}

// ======================================================================
// 2. Agenda, check-in e reposições
// ======================================================================
async function telaAgenda(ctx) {
    const [agenda, reposicoes, turmas] = await Promise.all([
        api.get(`${S}/agenda`), api.get(`${S}/reposicoes`), api.get(`${S}/turmas`),
    ]);
    const porDia = agenda.reduce((acc, a) => ((acc[a.data] ||= []).push(a), acc), {});
    const abertas = reposicoes.filter((r) => ['SOLICITADA', 'APROVADA'].includes(r.status) && r.dataAulaDestino >= isoHoje());

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Minha agenda</h1><p>Próximos 14 dias. Confirme presença com um toque — seu professor vê na hora.</p></div>
            <div class="page-actions">
                <a class="btn btn-ghost" href="#/frequencia"><i class="fas fa-calendar-days"></i> Calendário e frequência</a>
                <button class="btn" data-acao="experimental"><i class="fas fa-flask"></i> Aula experimental</button>
                <button class="btn btn-primary" data-acao="repor" ${turmas.length ? '' : 'disabled'}><i class="fas fa-rotate"></i> Solicitar reposição</button>
            </div>
        </div>
        <section class="grid grid-main">
            <article class="panel">
                ${raw(Object.keys(porDia).length ? Object.entries(porDia).map(([dia, aulas]) => `
                    <div class="agenda-day"><h4>${esc(rotuloDia(dia))}</h4>
                    ${aulas.map((a, i) => `
                        <div class="agenda-item ${a.checkin ? 'is-checked' : ''}">
                            <span class="t">${esc(a.turma.horarioInicio)}<small>${esc(a.turma.horarioFim)}</small></span>
                            <span><strong>${esc(a.turma.nome)}</strong> ${a.tipo !== 'REGULAR' ? badge(a.tipo) : ''}<br><small class="faint">${esc(a.turma.salaNome)} · ${esc(a.turma.professorNome)}</small></span>
                            <span>${a.presenca ? badge(a.presenca)
                                : a.checkin ? `<button class="btn btn-sm btn-ok" data-dia="${dia}" data-i="${i}"><i class="fas fa-circle-check"></i> Confirmado</button>`
                                : a.podeCheckin ? `<button class="btn btn-sm" data-dia="${dia}" data-i="${i}"><i class="fas fa-hand"></i> Confirmar</button>`
                                : '<span class="faint" style="font-size:.8rem">check-in em breve</span>'}</span>
                        </div>`).join('')}</div>`).join('') : vazio('fa-calendar', 'Agenda vazia', 'Você ainda não tem aulas nos próximos 14 dias.', '<a class="btn btn-primary" href="#/explorar">Explorar turmas</a>'))}
            </article>
            <article class="panel">
                <div class="panel-head"><h3>Minhas solicitações</h3></div>
                <div class="feed">${raw(reposicoes.length ? reposicoes.slice(0, 12).map((r) => `
                    <div class="feed-item">
                        <header><span>${badge(r.tipo)}</span>${badge(r.status)}</header>
                        <strong>${esc(r.turmaDestinoNome)}</strong>
                        <p class="meta num">${esc(dataLonga(r.dataAulaDestino))} · ${esc(r.horario || '')}</p>
                        ${r.resposta ? `<p class="muted mt-4">Professor: “${esc(r.resposta)}”</p>` : ''}
                        ${abertas.includes(r) ? `<button class="btn btn-sm btn-ghost mt-4" data-cancelar="${r.id}"><i class="fas fa-xmark"></i> Cancelar solicitação</button>` : ''}
                    </div>`).join('') : vazio('fa-rotate', 'Nenhuma solicitação', 'Faltou? Peça reposição em outra turma com vaga, de preferência da mesma modalidade.'))}</div>
            </article>
        </section>`;

    ctx.el.onclick = async (e) => {
        const b = e.target.closest('[data-dia]');
        if (b) return alternarCheckin(porDia[b.dataset.dia][Number(b.dataset.i)], b);
        if (e.target.closest('[data-acao="repor"]')) return formReposicao('REPOSICAO', turmas);
        if (e.target.closest('[data-acao="experimental"]')) return formReposicao('EXPERIMENTAL', turmas);
        const c = e.target.closest('[data-cancelar]');
        if (c) {
            const ok = await confirmar({ titulo: 'Cancelar solicitação?', texto: 'A vaga é liberada e o professor é avisado.', confirmar: 'Cancelar solicitação', perigo: true });
            if (!ok) return undefined;
            await api.post(`${S}/reposicoes/${c.dataset.cancelar}/cancelar`);
            toastOk('Solicitação cancelada');
        }
        return undefined;
    };
    if (ctx.params.repor && !ctx.suave) formReposicao('REPOSICAO', turmas, Number(ctx.params.repor));
}

/** Fluxo estruturado: origem → horário compatível → confirmação. */
function formReposicao(tipo, turmas, origemInicial) {
    const experimental = tipo === 'EXPERIMENTAL';
    let opcoes = [];
    modal({
        titulo: experimental ? 'Agendar aula experimental' : 'Solicitar reposição',
        subtitulo: experimental ? 'Experimente uma turma em que você ainda não está matriculado(a).' : 'Primeiro as turmas da mesma modalidade; depois, outras turmas com vaga.',
        confirmar: 'Enviar solicitação',
        largo: true,
        etapas: [
            {
                titulo: experimental ? 'Interesse' : 'Aula perdida',
                html: experimental
                    ? '<p class="muted">Vamos listar todas as turmas abertas com vaga nas próximas duas semanas.</p>'
                    : `<div class="form-grid">
                        <div class="field"><label for="rp-origem">Sua turma</label><select class="input" id="rp-origem" name="turmaOrigemId" required>${turmas.map((t) => `<option value="${t.id}" ${t.id === origemInicial ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div>
                        <div class="field"><label for="rp-falta">Data da falta</label><input class="input num" type="date" id="rp-falta" name="dataFalta" max="${isoHoje()}"><span class="hint">Opcional, ajuda o professor a entender o contexto.</span></div>
                    </div>`,
                validar: async (form, m) => {
                    const origem = experimental ? null : form.turmaOrigemId.value;
                    opcoes = await api.get(`${S}/reposicoes/opcoes`, { query: { tipo, turmaOrigem: origem }, silencioso: true });
                    const box = form.querySelector('#rp-opcoes');
                    box.innerHTML = opcoes.length ? opcoes.map((o, i) => `
                        <div class="feed-item">
                            <header><div><strong>${esc(o.turma.nome)}</strong> <span class="faint">· ${esc(NIVEIS[o.turma.nivel] || '')}</span>${experimental ? '' : o.mesmaModalidade ? ' <span class="badge ok plain">Mesma modalidade</span>' : ' <span class="badge info plain">Outra modalidade</span>'}</div><span class="faint num">${o.vagas} vaga(s)</span></header>
                            <p class="meta">${esc(o.turma.diasSemana)} · ${esc(o.turma.horarioInicio)}–${esc(o.turma.horarioFim)} · ${esc(o.turma.salaNome)} · ${esc(o.turma.professorNome)}</p>
                            <div class="row wrap mt-4">${o.datas.map((d) => `<label class="check-item" style="padding:6px 10px"><input type="radio" name="escolha" value="${i}|${d}" required><span class="num">${esc(dataCurta(d))}</span></label>`).join('')}</div>
                        </div>`).join('') : '';
                    if (!opcoes.length) return experimental ? 'Não há turmas com vaga nas próximas duas semanas.' : 'Nenhum horário compatível com vaga nas próximas duas semanas.';
                    m.erro(null);
                    return true;
                },
            },
            {
                titulo: 'Horário',
                html: '<div class="feed" id="rp-opcoes"></div>',
                validar: (form) => (form.querySelector('input[name=escolha]:checked') ? true : 'Escolha uma data.'),
            },
            {
                titulo: 'Confirmação',
                html: '<div id="rp-resumo"></div><div class="field mt-4"><label for="rp-motivo">Mensagem ao professor</label><textarea class="input" id="rp-motivo" name="motivo" rows="3" placeholder="Opcional"></textarea></div>',
            },
        ],
        onAbrir: (form) => form.addEventListener('change', () => {
            const sel = form.querySelector('input[name=escolha]:checked');
            if (!sel) return;
            const [i, d] = sel.value.split('|');
            const o = opcoes[Number(i)];
            form.querySelector('#rp-resumo').innerHTML = `<dl class="kv"><dt>Turma</dt><dd>${esc(o.turma.nome)}</dd><dt>Data</dt><dd class="num">${esc(dataLonga(d))}, ${esc(o.turma.horarioInicio)}</dd><dt>Sala</dt><dd>${esc(o.turma.salaNome)}</dd><dt>Professor</dt><dd>${esc(o.turma.professorNome)}</dd></dl><div class="callout mt-4"><i class="fas fa-circle-info"></i><span>O professor precisa aprovar. Você recebe a resposta no sininho.</span></div>`;
        }),
        onSubmit: async (dados, form) => {
            const [i, d] = form.querySelector('input[name=escolha]:checked').value.split('|');
            const o = opcoes[Number(i)];
            await api.post(`${S}/reposicoes`, {
                tipo,
                turmaOrigemId: experimental ? null : Number(form.turmaOrigemId.value),
                dataFalta: experimental ? null : form.dataFalta.value || null,
                turmaDestinoId: o.turma.id,
                dataAulaDestino: d,
                motivo: dados.motivo || null,
            }, { silencioso: true });
            toastOk('Solicitação enviada', `${o.turma.nome} · ${dataCurta(d)}. Aguarde a aprovação do professor.`);
        },
    });
}

// ======================================================================
// 3. Explorar turmas (auto-matrícula)
// ======================================================================
async function telaExplorar(ctx) {
    const [catalogo, minhas] = await Promise.all([api.get(`${S}/catalogo`), api.get(`${S}/turmas`)]);
    const ids = new Set(minhas.map((t) => t.id));
    const categorias = [...new Set(catalogo.map((t) => t.categoria).filter(Boolean))];
    const filtro = ctx.params.categoria || '';
    const lista = catalogo.filter((t) => !filtro || t.categoria === filtro);

    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Explorar turmas</h1><p>Vagas atualizadas em tempo real. Matricule-se em um toque.</p></div>
            <div class="segmented">${raw(['', ...categorias].map((c) => `<button data-cat="${esc(c)}" class="${filtro === c ? 'is-active' : ''}">${esc(c || 'Todas')}</button>`).join(''))}</div></div>
        <div class="grid grid-3">${raw(lista.map((t) => {
            const vagas = t.limiteVagas - t.ocupadas;
            return `<div class="data-card">
                <div class="row between"><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}" style="color:var(--amber);font-size:1.2rem"></i>${ids.has(t.id) ? badge('ATIVA', 'Você participa') : vagas <= 0 ? badge('VENCIDO', 'Lotada') : `<span class="badge ${vagas <= 3 ? 'warn' : 'ok'}">${vagas} vaga(s)</span>`}</div>
                <div><h3>${esc(t.nome)}</h3><p class="muted">${esc(t.modalidadeNome)} · ${esc(NIVEIS[t.nivel] || t.nivel)}</p></div>
                <p class="num">${esc(t.diasSemana)} · ${esc(t.horarioInicio)}–${esc(t.horarioFim)}</p>
                <p class="faint">${esc(t.salaNome)} · ${esc(t.professorNome)}</p>
                ${ids.has(t.id) ? '' : `<button class="btn ${vagas > 0 ? 'btn-primary' : ''}" data-matricular="${t.id}" ${vagas > 0 ? '' : 'disabled'}>${vagas > 0 ? 'Matricular-me' : 'Sem vagas'}</button>`}
            </div>`;
        }).join('') || vazio('fa-magnifying-glass', 'Nenhuma turma nesta categoria'))}</div>`;

    ctx.el.onclick = async (e) => {
        const c = e.target.closest('[data-cat]');
        if (c) return ctx.navegar(`#/explorar${c.dataset.cat ? `?categoria=${encodeURIComponent(c.dataset.cat)}` : ''}`);
        const m = e.target.closest('[data-matricular]');
        if (m) {
            const t = catalogo.find((x) => String(x.id) === m.dataset.matricular);
            const ok = await confirmar({ titulo: `Matricular-se em ${t.nome}?`, texto: `${t.diasSemana} às ${t.horarioInicio}. A mensalidade é gerada pela administração no próximo ciclo.`, confirmar: 'Confirmar matrícula' });
            if (!ok) return undefined;
            await comBotao(m, () => api.post(`${S}/matriculas`, { idTurma: t.id }));
            toastOk('Matrícula confirmada', `Bem-vindo(a) à ${t.nome}!`);
        }
        return undefined;
    };
}

// ======================================================================
// 4. Hub de evolução
// ======================================================================
async function telaEvolucao(ctx) {
    const ev = await api.get(`${S}/evolucao`);
    const aba = ctx.params.aba || 'avaliacoes';
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Minha evolução</h1><p>Feedbacks técnicos, repertório estudado e histórico de presença.</p></div></div>
        <section class="grid grid-main">
            <article class="panel">
                <div class="panel-head"><div><h3>Média técnica ao longo do tempo</h3><span class="muted">Ritmo, técnica, expressão e coreografia (0–10)</span></div><span class="kpi-value num">${ev.mediaGeral ?? '—'}</span></div>
                ${raw(ev.evolucaoNotas.length ? linha(ev.evolucaoNotas.map((p) => ({ rotulo: p.rotulo, valor: Number(p.valor) })), { formato: (v) => v.toFixed(1) }) : vazio('fa-chart-line', 'Ainda sem avaliações', 'Seu professor registra avaliações técnicas ao longo do semestre.'))}
            </article>
            <article class="panel">
                <div class="panel-head"><h3>Resumo</h3></div>
                <dl class="kv">
                    <dt>Avaliações</dt><dd class="num">${ev.avaliacoes.length}</dd>
                    <dt>Coreografias</dt><dd class="num">${new Set(ev.coreografias.filter((c) => c.coreografia).map((c) => c.coreografia)).size}</dd>
                    <dt>Aulas registradas</dt><dd class="num">${ev.presencas.length}</dd>
                    <dt>Presenças</dt><dd class="num">${ev.presencas.filter((p) => p.status === 'PRESENTE').length}</dd>
                </dl>
            </article>
        </section>
        <div class="panel mt-4">
            <div class="tabs" role="tablist">
                <button data-aba="avaliacoes" class="${aba === 'avaliacoes' ? 'is-active' : ''}">Feedbacks</button>
                <button data-aba="repertorio" class="${aba === 'repertorio' ? 'is-active' : ''}">Repertório</button>
                <button data-aba="presencas" class="${aba === 'presencas' ? 'is-active' : ''}">Presenças</button>
            </div>
            <div id="ev-conteudo"></div>
        </div>`;

    const alvo = document.getElementById('ev-conteudo');
    if (aba === 'avaliacoes') {
        alvo.innerHTML = ev.avaliacoes.length ? `<div class="timeline">${ev.avaliacoes.map((a) => `
            <div class="tl-item is-next"><div class="feed-item">
                <header><div><strong>${esc(a.coreografia)}</strong><br><small class="faint">${esc(a.turmaNome)} · ${esc(a.professorNome)} · ${dataHora(a.data)}</small></div><span class="badge cyan plain num">média ${a.media}</span></header>
                <div class="score-grid">${[['Ritmo', a.ritmo], ['Técnica', a.tecnica], ['Expressão', a.expressao], ['Coreografia', a.coreografiaNota]].map(([l, v]) => `<div class="score"><b>${v}</b><small>${l}</small></div>`).join('')}</div>
                <p style="white-space:pre-line">${esc(a.feedback)}</p>
                ${a.link ? `<p class="meta mt-4"><a href="${esc(a.link)}" target="_blank" rel="noopener"><i class="fas fa-play"></i> Referência do professor</a></p>` : ''}
            </div></div>`).join('')}</div>` : vazio('fa-star-half-stroke', 'Nenhum feedback ainda');
    } else if (aba === 'repertorio') {
        alvo.innerHTML = ev.coreografias.length ? `<div class="feed">${ev.coreografias.map((d) => `
            <div class="feed-item"><header><div><strong>${esc(d.coreografia || 'Aula')}</strong> <span class="faint">· ${esc(d.turmaNome)}</span></div><span class="faint num">${dataCurta(d.data)}</span></header>
            <p class="muted" style="white-space:pre-line">${esc(d.conteudo)}</p>
            ${d.links.length ? `<p class="meta mt-4">${d.links.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> ${esc(l.replace(/^https?:\/\//, '').slice(0, 42))}</a>`).join(' · ')}</p>` : ''}</div>`).join('')}</div>` : vazio('fa-music', 'Repertório vazio', 'O conteúdo de cada aula registrado pelo professor aparece aqui.');
    } else {
        alvo.innerHTML = ev.presencas.length ? `<ul class="list-plain">${ev.presencas.map((p) => `<li><span class="num" style="width:110px">${data(p.data)}</span><span style="flex:1">${esc(p.turmaNome)}${p.justificativa ? `<br><small class="faint">${esc(p.justificativa)}</small>` : ''}</span>${badge(p.status)}</li>`).join('')}</ul>` : vazio('fa-clipboard', 'Sem registros de presença');
    }
    ctx.el.querySelector('.tabs').onclick = (e) => {
        const b = e.target.closest('[data-aba]');
        if (b) ctx.navegar(`#/evolucao?aba=${b.dataset.aba}`);
    };
}

// ======================================================================
// 4b. Frequência e calendário completo
// ======================================================================
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ST_AULA = {
    PRESENTE: ['ok', 'Presente', 'fa-check'], FALTA: ['danger', 'Falta', 'fa-xmark'], JUSTIFICADO: ['warn', 'Justificada', 'fa-file-medical'],
    AGENDADA: ['next', 'Agendada', 'fa-clock'], SEM_REGISTRO: ['none', 'Sem chamada', 'fa-minus'],
};
const nomeMes = (ym) => { const [a, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${a}`; };
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Anel de frequência: proporção de presenças, justificadas e faltas sobre as aulas com chamada. */
function anelFrequencia(r) {
    const C = 2 * Math.PI * 54;
    const partes = [['ok', r.presentes], ['warn', r.justificadas], ['danger', r.faltas]];
    const total = r.aulas || 0;
    let acc = 0;
    const arcos = total ? partes.map(([cls, v]) => {
        const f = v / total;
        const s = `<circle class="ring-seg ${cls}" cx="70" cy="70" r="54" stroke-dasharray="${Math.max(0, f * C - (f > 0 && f < 1 ? 2.5 : 0))} ${C}" stroke-dashoffset="${-acc * C}"/>`;
        acc += f;
        return v ? s : '';
    }).join('') : '';
    const cls = r.percentualPresenca >= 85 ? 'ok' : r.percentualPresenca >= 75 ? 'warn' : 'danger';
    return `<div class="freq-ring">
        <svg viewBox="0 0 140 140" role="img" aria-label="Frequência de ${pct(r.percentualPresenca)}"><circle class="ring-base" cx="70" cy="70" r="54"/><g transform="rotate(-90 70 70)">${arcos}</g></svg>
        <div class="freq-ring-centro"><b class="num ${total ? cls : ''}">${total ? pct(r.percentualPresenca, 0) : '—'}</b><small>frequência</small></div>
    </div>`;
}

function blocoResumo(r, rotulo) {
    return `
        ${anelFrequencia(r)}
        <div class="freq-stats">
            <div class="freq-stat ok"><span><i class="fas fa-check"></i> Presenças</span><b class="num">${r.presentes}</b><small>${pct(r.participacaoPresentes, 0)} das aulas</small></div>
            <div class="freq-stat danger"><span><i class="fas fa-xmark"></i> Faltas</span><b class="num">${r.faltas}</b><small>${pct(r.percentualFaltas, 0)} de ausência</small></div>
            <div class="freq-stat warn"><span><i class="fas fa-file-medical"></i> Justificadas</span><b class="num">${r.justificadas}</b><small>abonadas pelo professor</small></div>
            <div class="freq-stat"><span><i class="fas fa-calendar-check"></i> Aulas com chamada</span><b class="num">${r.aulas}</b><small>${esc(rotulo)}</small></div>
        </div>`;
}

async function telaFrequencia(ctx) {
    const f = await api.get(`${S}/frequencia`, { query: { mes: ctx.params.mes } });
    const porDia = Object.fromEntries(f.dias.map((d) => [d.data, d.aulas]));
    const hoje = isoHoje();
    const [ano, mes] = f.mes.split('-').map(Number);
    const primeiro = new Date(ano, mes - 1, 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - ((primeiro.getDay() + 6) % 7)); // começa na segunda-feira
    const celulas = [];
    for (let d = new Date(inicio); celulas.length < 42; d.setDate(d.getDate() + 1)) {
        celulas.push(isoDe(d));
        if (celulas.length >= 35 && d.getMonth() !== mes - 1 && d.getDay() === 0) break;
    }
    let selecionado = ctx.params.dia && porDia[ctx.params.dia] ? ctx.params.dia
        : hoje.startsWith(f.mes) ? hoje : (f.dias[0]?.data || `${f.mes}-01`);
    let escopo = 'mes';

    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Frequência e calendário</h1><p>Todas as suas aulas: presenças, faltas e faltas justificadas pelo professor. O mínimo exigido é 75%; justificadas não entram na conta.</p></div>
            <div class="month-nav">
                <button class="btn btn-ghost btn-sm" data-mes="${f.mesAnterior}" aria-label="Mês anterior"><i class="fas fa-chevron-left"></i></button>
                <strong>${nomeMes(f.mes)}</strong>
                <button class="btn btn-ghost btn-sm" data-mes="${f.mesSeguinte}" aria-label="Próximo mês"><i class="fas fa-chevron-right"></i></button>
                ${raw(f.mes !== hoje.slice(0, 7) ? `<button class="btn btn-sm" data-mes="${hoje.slice(0, 7)}">Hoje</button>` : '')}
            </div>
        </div>

        <section class="panel freq-hero">
            <div class="panel-head">
                <div><h3>Resumo de presença</h3><span class="muted">${f.sequenciaPresencas ? `${f.sequenciaPresencas} presença(s) seguidas, continue assim!` : 'Cada presença conta para o seu passaporte.'}</span></div>
                <div class="segmented" id="fq-escopo"><button data-e="mes" class="is-active">${MESES[mes - 1].replace(/^./, (c) => c.toUpperCase())}</button><button data-e="geral">Desde a matrícula</button></div>
            </div>
            <div class="freq-resumo" id="fq-resumo">${raw(blocoResumo(f.doMes, `em ${MESES[mes - 1]}`))}</div>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><div><h3>Calendário</h3><span class="muted">Toque em um dia para ver as aulas.</span></div>
                    <ul class="cal-legenda">${raw(['PRESENTE', 'FALTA', 'JUSTIFICADO', 'AGENDADA', 'SEM_REGISTRO'].map((s) => `<li><i class="cal-dot ${ST_AULA[s][0]}"></i>${ST_AULA[s][1]}</li>`).join(''))}</ul>
                </div>
                <div class="cal" role="grid" aria-label="Calendário de ${nomeMes(f.mes)}">
                    ${raw(DIAS.map((d) => `<span class="cal-dow" role="columnheader">${d}</span>`).join(''))}
                    ${raw(celulas.map((iso) => {
                        const aulas = porDia[iso] || [];
                        const fora = !iso.startsWith(f.mes);
                        return `<button type="button" class="cal-dia ${fora ? 'is-fora' : ''} ${iso === hoje ? 'is-hoje' : ''} ${aulas.length ? 'tem-aula' : ''}" data-dia="${iso}" ${fora ? 'tabindex="-1"' : ''} aria-label="${esc(dataLonga(iso))}: ${aulas.length} aula(s)">
                            <span class="cal-num num">${Number(iso.slice(8))}</span>
                            <span class="cal-dots">${aulas.map((a) => `<i class="cal-dot ${ST_AULA[a.status]?.[0] || 'none'}" title="${esc(a.turmaNome)} · ${esc(ST_AULA[a.status]?.[1] || a.status)}"></i>`).join('')}</span>
                        </button>`;
                    }).join(''))}
                </div>
            </article>
            <article class="panel" id="fq-dia"></article>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><div><h3>Por turma</h3><span class="muted">Desde a matrícula em cada turma ativa.</span></div></div>
                ${raw(f.porTurma.length ? f.porTurma.map((t) => {
                    const tot = t.presentes + t.faltas + t.justificadas || 1;
                    return `<div class="freq-turma">
                        <div class="row between"><strong>${esc(t.turmaNome)}</strong><span class="row">${badge(t.alerta)}<b class="num">${pct(t.percentual, 0)}</b></span></div>
                        <div class="freq-barra" aria-hidden="true"><span class="ok" style="width:${(t.presentes / tot) * 100}%"></span><span class="warn" style="width:${(t.justificadas / tot) * 100}%"></span><span class="danger" style="width:${(t.faltas / tot) * 100}%"></span></div>
                        <small class="faint num">${t.presentes} presença(s) · ${t.faltas} falta(s) · ${t.justificadas} justificada(s)${t.alerta !== 'OK' ? ' · <a href="#/agenda?repor=' + t.turmaId + '">solicitar reposição</a>' : ''}</small>
                    </div>`;
                }).join('') : vazio('fa-layer-group', 'Sem turmas ativas', 'Explore as turmas para começar.'))}
            </article>
            <article class="panel">
                <div class="panel-head"><div><h3>Faltas e justificativas</h3><span class="muted">Registradas pelos professores na chamada.</span></div></div>
                ${raw(f.ausencias.length ? `<ul class="abs-list">${f.ausencias.map((a) => `
                    <li class="${a.status === 'JUSTIFICADO' ? 'is-just' : 'is-falta'}">
                        <span class="abs-data"><b class="num">${a.data.slice(8)}</b><small>${MESES[Number(a.data.slice(5, 7)) - 1].slice(0, 3)}</small></span>
                        <div><strong>${esc(a.turmaNome)}</strong> ${badge(a.status, a.status === 'JUSTIFICADO' ? 'Justificada' : 'Falta')}
                            <small class="faint">${esc(a.professorNome || '')} · ${esc(dataLonga(a.data))}</small>
                            ${a.justificativa ? `<p class="abs-motivo"><i class="fas fa-quote-left"></i> ${esc(a.justificativa)}</p>` : ''}
                        </div>
                    </li>`).join('')}</ul>` : vazio('fa-face-smile', 'Nenhuma falta registrada', 'Presença impecável até aqui.'))}
            </article>
        </section>`;

    const pintarDia = () => {
        ctx.el.querySelectorAll('.cal-dia').forEach((b) => b.classList.toggle('is-sel', b.dataset.dia === selecionado));
        const aulas = porDia[selecionado] || [];
        $('#fq-dia', ctx.el).innerHTML = `
            <div class="panel-head"><div><h3>${esc(rotuloDia(selecionado))}</h3><span class="muted">${aulas.length ? `${aulas.length} aula(s)` : 'Sem aulas neste dia'}</span></div></div>
            ${aulas.length ? `<div class="dia-aulas">${aulas.map((a) => {
                const [cls, rot, ico] = ST_AULA[a.status] || ['none', a.status, 'fa-minus'];
                return `<div class="dia-aula ${cls}">
                    <span class="dia-aula-ico"><i class="fas ${ico}"></i></span>
                    <div><strong>${esc(a.turmaNome)}</strong> ${a.tipo !== 'REGULAR' ? badge(a.tipo) : ''}
                        <small class="faint num">${esc(a.horarioInicio || '')}–${esc(a.horarioFim || '')} · ${esc(a.salaNome || '')} · ${esc(a.professorNome || '')}</small>
                        ${a.justificativa ? `<p class="abs-motivo"><i class="fas fa-quote-left"></i> ${esc(a.justificativa)}</p>` : ''}
                        ${a.status === 'AGENDADA' && a.checkin ? '<small class="ok"><i class="fas fa-circle-check"></i> Presença confirmada</small>' : ''}
                    </div>
                    <span class="dia-aula-st ${cls}">${esc(rot)}</span>
                </div>`;
            }).join('')}</div>` : vazio('fa-mug-hot', 'Dia livre', 'Nenhuma aula sua neste dia.')}`;
    };
    pintarDia();

    ctx.el.onclick = (e) => {
        const m = e.target.closest('[data-mes]');
        if (m) return ctx.navegar(`#/frequencia?mes=${m.dataset.mes}`);
        const d = e.target.closest('.cal-dia');
        if (d) {
            if (!d.dataset.dia.startsWith(f.mes)) return ctx.navegar(`#/frequencia?mes=${d.dataset.dia.slice(0, 7)}&dia=${d.dataset.dia}`);
            selecionado = d.dataset.dia;
            pintarDia();
            return undefined;
        }
        const s = e.target.closest('#fq-escopo [data-e]');
        if (s && s.dataset.e !== escopo) {
            escopo = s.dataset.e;
            ctx.el.querySelectorAll('#fq-escopo button').forEach((b) => b.classList.toggle('is-active', b === s));
            $('#fq-resumo', ctx.el).innerHTML = escopo === 'mes' ? blocoResumo(f.doMes, `em ${MESES[mes - 1]}`) : blocoResumo(f.geral, 'desde a matrícula');
        }
        return undefined;
    };
}

// ======================================================================
// 5. Avisos
// ======================================================================
const telaAvisos = (ctx) => telaMural(ctx, { endpoint: `${S}/avisos`, descricao: 'Comunicados do estúdio e das suas turmas, em tempo real.' });

// ======================================================================
// 6. Financeiro
// ======================================================================
async function telaFinanceiro(ctx) {
    const [f, linhas] = await Promise.all([api.get(`${S}/financeiro`), api.get(`${S}/financeiro/planilha`)]);
    const r = f.resumo;
    const abertas = f.faturas.filter((x) => ['PENDENTE', 'VENCIDO', 'EM_ANALISE'].includes(x.status))
        .sort((a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento)));
    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Financeiro</h1><p>Pague por PIX, cartão ou boleto e acompanhe tudo na sua planilha. Baixas da administração aparecem aqui na hora.</p></div></div>
        <section class="grid grid-4">
            <div class="data-card kpi ${r.atrasadas ? '' : 'is-hero'}"><span class="kpi-label"><i class="fas fa-hourglass-half"></i> Em aberto</span><span class="kpi-value num">${moeda(r.emAberto)}</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-triangle-exclamation"></i> Atrasadas</span><span class="kpi-value num ${r.atrasadas ? 'danger' : ''}">${r.atrasadas}</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-receipt"></i> Em análise</span><span class="kpi-value num">${r.emAnalise}</span></div>
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-circle-check"></i> Pago no ano</span><span class="kpi-value num">${moeda(r.pagoNoAno)}</span></div>
        </section>

        <section class="mt-4">
            <div class="section-head"><h2>A pagar</h2><span class="muted">${abertas.length ? `${abertas.length} cobrança(s) em aberto` : 'Nada pendente'}</span></div>
            ${raw(abertas.length ? `<div class="bill-grid">${abertas.map((x) => `
                <article class="bill ${x.status === 'VENCIDO' ? 'is-late' : ''}">
                    <header><span class="eyebrow">${esc(x.turmaNome || 'Mensalidade')}</span>${badge(x.status)}</header>
                    <h3>${esc(x.titulo)}</h3>
                    <div class="bill-valor num">${moeda(x.valor)}</div>
                    ${Number(x.desconto) > 0 ? `<p class="bill-desc"><i class="fas fa-tag" aria-hidden="true"></i><s class="num">${moeda(x.valorOriginal)}</s> ${esc(rotuloDesconto(x.motivoDesconto))}</p>` : ''}
                    <p class="faint num">Vence em ${data(x.dataVencimento)}${x.diasAtraso ? ` · <span class="danger">${x.diasAtraso} dia(s) em atraso</span>` : ''}</p>
                    ${x.status === 'EM_ANALISE'
                        ? '<p class="bill-nota"><i class="fas fa-hourglass-half"></i> Comprovante em análise pela administração.</p>'
                        : `<button class="btn btn-primary btn-block" data-pagar="${x.id}"><i class="fas fa-lock"></i> Pagar agora</button>`}
                </article>`).join('')}</div>`
                : `<div class="panel">${vazio('fa-circle-check', 'Tudo em dia', 'Você não tem mensalidades em aberto. Obrigado!')}</div>`)}
        </section>

        <section class="panel flush mt-4">
            <div class="panel-head"><div><h3>Planilha financeira</h3><span class="muted">Todas as suas cobranças e pagamentos. Clique em um pagamento para ver o comprovante.</span></div></div>
            <div id="planilha"></div>
        </section>`;

    planilhaFinanceira($('#planilha', ctx.el), linhas, {
        nomeArquivo: 'meu-extrato-vibedance',
        pdfUrl: `${S}/financeiro/planilha/pdf`,
        onLinha: (l) => {
            if (l.status === 'PAGO' && l.pagamentoId) abrirComprovante(l.pagamentoId);
            else if (['PENDENTE', 'ATRASADO'].includes(l.status)) abrirCheckout(l.faturaId, { aoPagar: () => ctx.recarregar(), aoEnviarComprovante: enviarComprovante });
        },
    });

    ctx.el.onclick = (e) => {
        const p = e.target.closest('[data-pagar]');
        if (p) return abrirCheckout(Number(p.dataset.pagar), { aoPagar: () => ctx.recarregar(), aoEnviarComprovante: enviarComprovante });
        return undefined;
    };
    if (ctx.params.pagar && !ctx.suave) abrirCheckout(Number(ctx.params.pagar), { aoPagar: () => ctx.recarregar(), aoEnviarComprovante: enviarComprovante });
}

function enviarComprovante(f) {
    modal({
        titulo: 'Enviar comprovante',
        subtitulo: `${f.titulo} · ${moeda(f.valor)}`,
        confirmar: 'Enviar comprovante',
        etapas: [
            {
                titulo: 'PIX',
                html: `<p class="muted">Copie o código abaixo no app do seu banco.</p>
                    <div class="field mt-4"><label for="pg-pix">PIX copia e cola</label><textarea class="input num" id="pg-pix" rows="4" readonly style="font-size:.75rem">${esc(f.pixCopiaCola || 'Código PIX indisponível — fale com a recepção.')}</textarea></div>
                    <button type="button" class="btn btn-sm mt-4" id="pg-copiar" ${f.pixCopiaCola ? '' : 'disabled'}><i class="fas fa-copy"></i> Copiar código</button>`,
            },
            {
                titulo: 'Comprovante',
                html: `<div class="field"><label for="pg-arq">Arquivo do comprovante</label><input class="input" type="file" id="pg-arq" name="arquivo" accept="image/*,application/pdf" required><span class="hint">PDF ou imagem de até 5 MB.</span></div>
                    <div class="field mt-4"><label for="pg-obs">Observação</label><input class="input" id="pg-obs" name="observacao" placeholder="Opcional"></div>`,
            },
        ],
        onAbrir: (form) => {
            form.querySelector('#pg-copiar').onclick = async () => {
                try {
                    await navigator.clipboard.writeText(f.pixCopiaCola);
                    toastOk('Código copiado');
                } catch {
                    form.querySelector('#pg-pix').select();
                    toast('Selecione e copie o código manualmente');
                }
            };
        },
        onSubmit: async (_, form) => {
            const arquivo = form.querySelector('#pg-arq').files[0];
            if (!arquivo) throw new Error('Anexe o comprovante.');
            if (arquivo.size > 5 * 1024 * 1024) throw new Error('O arquivo excede 5 MB.');
            const fd = new FormData();
            fd.append('idFatura', f.id);
            fd.append('arquivo', arquivo);
            if (form.observacao.value) fd.append('observacao', form.observacao.value);
            await api.post('/api/aluno/comprovantes', fd, { silencioso: true });
            toastOk('Comprovante enviado', 'A administração vai conferir e você será notificado(a).');
        },
    });
}

// ======================================================================
// 7. Minha matrícula (cancelamento)
// ======================================================================
const MOTIVOS = [
    ['HORARIO', 'Incompatibilidade de horário'], ['FINANCEIRO', 'Motivos financeiros'], ['MUDANCA', 'Mudança de cidade'],
    ['SAUDE', 'Saúde ou lesão'], ['INSATISFACAO', 'Insatisfação com as aulas'], ['OUTRO', 'Outro motivo'],
];
const rotuloMotivo = (m) => (MOTIVOS.find(([k]) => k === m) || [m, m])[1];
const horarioTurma = (t) => `${(t.dias || []).map((d) => DIAS[d - 1]).join(' · ')} · ${t.horarioInicio}–${t.horarioFim}`;

function blocoDiagnostico(d) {
    if (d.adimplente && !Number(d.totalEmAberto)) {
        return '<div class="diag ok"><i class="fas fa-circle-check"></i><div><strong>Financeiro em dia</strong><p>Nenhuma mensalidade em aberto.</p></div></div>';
    }
    if (d.adimplente) {
        return `<div class="diag warn"><i class="fas fa-hourglass-half"></i><div><strong>${moeda(d.totalEmAberto)} em aberto, sem atraso</strong><p>${d.faturasPendentes} mensalidade(s) a vencer${d.faturasEmAnalise ? ` e ${d.faturasEmAnalise} em análise` : ''}. Elas continuam devidas mesmo após o cancelamento.</p></div></div>`;
    }
    return `<div class="diag danger"><i class="fas fa-triangle-exclamation"></i><div><strong>Pendência financeira: ${moeda(d.totalAtrasado)} em atraso</strong><p>${d.faturasAtrasadas} mensalidade(s) vencida(s) de um total de ${moeda(d.totalEmAberto)} em aberto. A administração considera isso na análise.</p></div></div>`;
}

async function telaMatricula(ctx) {
    const c = await api.get(`${S}/cancelamento`);
    const p = c.pendente;
    ctx.el.innerHTML = html`
        <div class="page-head">
            <div><h1>Minha matrícula</h1><p>Suas turmas ativas, sua situação financeira e as solicitações de cancelamento.</p></div>
            <div class="page-actions">${raw(!p && c.turmas.length ? '<button class="btn btn-danger" data-cancelar><i class="fas fa-user-xmark"></i> Solicitar cancelamento</button>' : '')}</div>
        </div>
        ${raw(p ? `<div class="status-banner info"><i class="fas fa-hourglass-half"></i><div><strong>Solicitação em análise</strong><p>Enviada ${relativo(p.solicitadoEm)} para ${p.turmas.map((t) => esc(t.nome)).join(', ')}. Você será notificado(a) assim que a administração responder. Enquanto isso, novas solicitações ficam bloqueadas.</p></div>${badge('EM_ANALISE', 'Em análise')}</div>` : '')}
        <section class="grid grid-main ${p ? 'mt-4' : ''}">
            <article class="panel">
                <div class="panel-head"><div><h3>Turmas ativas</h3><span class="muted">${c.turmas.length} turma(s)</span></div></div>
                ${raw(c.turmas.length ? `<ul class="list-plain">${c.turmas.map((t) => `<li><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}" style="color:var(--amber);width:20px"></i><span style="flex:1"><strong>${esc(t.nome)}</strong><br><small class="faint">${esc(t.professorNome)} · ${esc(horarioTurma(t))} · ${esc(t.salaNome)}</small></span>${badge('', NIVEIS[t.nivel] || t.nivel)}</li>`).join('')}</ul>`
                    : vazio('fa-layer-group', 'Nenhuma turma ativa', 'Explore as turmas disponíveis para voltar a dançar.', '<a class="btn btn-primary" href="#/explorar">Explorar turmas</a>'))}
            </article>
            <article class="panel">
                <div class="panel-head"><h3>Situação financeira</h3></div>
                ${raw(blocoDiagnostico(c.diagnostico))}
                ${raw(c.diagnostico.abertas.length ? `<a class="btn btn-sm btn-block mt-4" href="#/financeiro">Ver mensalidades em aberto</a>` : '')}
            </article>
        </section>
        <section class="panel mt-4">
            <div class="panel-head"><div><h3>Histórico de solicitações</h3><span class="muted">Pareceres da administração ficam registrados aqui.</span></div></div>
            ${raw(c.historico.length ? `<div class="feed">${c.historico.map((h) => `
                <div class="feed-item ${h.status === 'RECUSADA' ? 'is-urgent' : ''}">
                    <header><strong>${esc(h.turmas.map((t) => t.nome).join(', ') || 'Turmas encerradas')}</strong>${badge(h.status === 'SOLICITADA' ? 'EM_ANALISE' : h.status, h.status === 'SOLICITADA' ? 'Em análise' : undefined)}</header>
                    <p class="meta">${esc(rotuloMotivo(h.motivo))} · solicitada em ${dataHora(h.solicitadoEm)}${h.avaliadoEm ? ` · respondida em ${dataHora(h.avaliadoEm)}${h.avaliadoPorNome ? ` por ${esc(h.avaliadoPorNome)}` : ''}` : ''}</p>
                    <p class="muted" style="margin-top:6px">“${esc(h.justificativa)}”</p>
                    ${h.resposta ? `<div class="parecer"><i class="fas fa-comment"></i><span><strong>Parecer da administração:</strong> ${esc(h.resposta)}</span></div>` : ''}
                </div>`).join('')}</div>` : vazio('fa-clock-rotate-left', 'Nenhuma solicitação', 'Se precisar cancelar uma turma, use o botão acima.'))}
        </section>`;

    ctx.el.onclick = (e) => {
        if (e.target.closest('[data-cancelar]')) formCancelamento(c);
    };
}

function formCancelamento(c) {
    modal({
        titulo: 'Solicitar cancelamento',
        subtitulo: 'Revise tudo antes de enviar. A administração analisa e responde pelo portal.',
        confirmar: 'Enviar solicitação',
        perigo: true,
        etapas: [
            {
                titulo: 'Turmas',
                html: `<p class="muted">Quais turmas você quer cancelar?</p>
                    <div class="check-list mt-4">${c.turmas.map((t) => `<label class="check-item"><input type="checkbox" name="turmas" data-array value="${t.id}" ${c.turmas.length === 1 ? 'checked' : ''}><span class="grow">${esc(t.nome)}<small>${esc(t.professorNome)} · ${esc(horarioTurma(t))}</small></span></label>`).join('')}</div>`,
                validar: (form) => (form.querySelectorAll('input[name=turmas]:checked').length ? true : 'Selecione ao menos uma turma.'),
            },
            {
                titulo: 'Motivo',
                html: `<div class="field"><label for="cc-motivo">Motivo principal</label><select class="input" id="cc-motivo" name="motivo" required><option value="">Selecione…</option>${MOTIVOS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                    <div class="field mt-4"><label for="cc-just">Conte um pouco mais</label><textarea class="input" id="cc-just" name="justificativa" maxlength="1000" required placeholder="Isso ajuda o estúdio a entender e, se possível, encontrar uma alternativa para você."></textarea><span class="hint"><span data-cont>0</span>/1000 · mínimo de 10 caracteres</span></div>`,
                validar: (form) => (form.justificativa.value.trim().length >= 10 ? true : 'Escreva ao menos 10 caracteres na justificativa.'),
            },
            { titulo: 'Revisão', html: '<div id="cc-resumo"></div>' },
        ],
        onAbrir: (form) => {
            const cont = form.querySelector('[data-cont]');
            form.justificativa.addEventListener('input', () => { cont.textContent = form.justificativa.value.length; });
            const resumo = () => {
                const ids = [...form.querySelectorAll('input[name=turmas]:checked')].map((x) => Number(x.value));
                const turmas = c.turmas.filter((t) => ids.includes(t.id));
                form.querySelector('#cc-resumo').innerHTML = `
                    <h4>Turmas que serão canceladas</h4>
                    <ul class="list-plain">${turmas.map((t) => `<li><i class="fas fa-xmark danger"></i><span>${esc(t.nome)}<br><small class="faint">${esc(horarioTurma(t))}</small></span></li>`).join('')}</ul>
                    <h4 class="mt-4">Situação financeira</h4>
                    ${blocoDiagnostico(c.diagnostico)}
                    <dl class="kv mt-4"><dt>Motivo</dt><dd>${esc(rotuloMotivo(form.motivo.value))}</dd><dt>Justificativa</dt><dd>${esc(form.justificativa.value.trim())}</dd></dl>
                    <div class="callout warn mt-4"><i class="fas fa-circle-info"></i><span>Até a resposta, sua matrícula segue ativa e você não poderá abrir outra solicitação. Se aprovada, a vaga é liberada na hora.</span></div>`;
            };
            form.addEventListener('change', resumo);
            form.addEventListener('input', resumo);
            resumo();
        },
        onSubmit: async (_, form) => {
            const turmas = [...form.querySelectorAll('input[name=turmas]:checked')].map((x) => Number(x.value));
            await api.post(`${S}/cancelamento`, { turmas, motivo: form.motivo.value, justificativa: form.justificativa.value.trim() }, { silencioso: true });
            toastOk('Solicitação enviada', 'Status: em análise. Você será notificado(a) da resposta.');
        },
    });
}

// ======================================================================
// Portal
// ======================================================================
criarPortal({
    perfis: ['ALUNO', 'ADMINISTRADOR'],
    nome: 'Portal do Aluno',
    icone: 'fa-wave-square',
    inicial: 'passaporte',
    rotas: [
        { id: 'passaporte', titulo: 'Meu passaporte', icone: 'fa-id-card', grupo: 'Eu', dominios: ['matriculas', 'financeiro', 'presencas', 'checkins', 'reposicoes', 'avaliacoes', 'turmas'], render: telaPassaporte },
        { id: 'matricula', titulo: 'Minha matrícula', icone: 'fa-id-badge', grupo: 'Eu', dominios: ['cancelamentos', 'matriculas', 'financeiro', 'turmas'], render: telaMatricula },
        { id: 'agenda', titulo: 'Agenda', icone: 'fa-calendar-check', grupo: 'Aulas', dominios: ['turmas', 'matriculas', 'checkins', 'reposicoes', 'presencas'], render: telaAgenda },
        { id: 'frequencia', titulo: 'Frequência', icone: 'fa-calendar-days', grupo: 'Aulas', dominios: ['presencas', 'matriculas', 'reposicoes', 'checkins', 'turmas'], render: telaFrequencia },
        { id: 'explorar', titulo: 'Explorar turmas', icone: 'fa-compass', grupo: 'Aulas', dominios: ['turmas', 'matriculas'], render: telaExplorar },
        { id: 'evolucao', titulo: 'Evolução', icone: 'fa-chart-line', grupo: 'Aulas', dominios: ['avaliacoes', 'diario', 'presencas'], render: telaEvolucao },
        { id: 'avisos', titulo: 'Avisos', icone: 'fa-bullhorn', grupo: 'Estúdio', dominios: ['comunicados'], render: telaAvisos },
        { id: 'financeiro', titulo: 'Financeiro', icone: 'fa-wallet', grupo: 'Estúdio', dominios: ['financeiro'], render: telaFinanceiro },
    ],
    comandos: [
        { titulo: 'Solicitar reposição', icone: 'fa-rotate', acao: () => { location.hash = '#/agenda'; } },
        { titulo: 'Pagar mensalidade', icone: 'fa-wallet', acao: () => { location.hash = '#/financeiro'; } },
        { titulo: 'Solicitar cancelamento de matrícula', icone: 'fa-user-xmark', acao: () => { location.hash = '#/matricula'; } },
    ],
    aoIniciar: {
        contadores: async () => {
            const f = await api.get(`${S}/financeiro`, { silencioso: true });
            return { financeiro: f.resumo.atrasadas || 0 };
        },
    },
});
