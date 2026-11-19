/**
 * Cobrança individual e descontos (ADM).
 *  - formCobranca(): nova cobrança para um aluno — mensalidade de uma turma ou cobrança avulsa,
 *    com condição especial (recém-chegado proporcional, bolsa, família, convênio…) e prévia ao vivo.
 *  - formAjuste(fatura): desconto / novo vencimento numa cobrança que ainda está em aberto.
 */
import { api } from '../js/core/api.js';
import { $, esc, moeda, data, avatar, modal, toastOk } from '../js/core/ui.js';
import { MOTIVOS, rotuloMotivo } from '../js/core/descontos.js';

const A = '/api/admin';
const MES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export { MOTIVOS, rotuloMotivo };

const AVULSAS = ['Taxa de matrícula', 'Figurino do espetáculo', 'Workshop', 'Aula particular', 'Ensaio extra'];

const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const mesExtenso = (ym) => { const [a, m] = ym.split('-').map(Number); return `${MES_NOME[m - 1]}/${a}`; };
const diasNoMes = (ym) => { const [a, m] = ym.split('-').map(Number); return new Date(a, m, 0).getDate(); };
const arred = (v) => Math.round(v * 100) / 100;
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Dia 10 do mês; se já passou (ex.: aluno que chegou depois), dá 5 dias a partir de hoje. */
function vencimentoSugerido(ym) {
    const dia10 = `${ym}-10`;
    const prazo = new Date(); prazo.setDate(prazo.getDate() + 5);
    return dia10 < isoLocal(new Date()) ? isoLocal(prazo) : dia10;
}

/** Desconto em reais a partir do campo (percentual ou valor). */
function descontoEmReais(cheio, tipo, valor) {
    const v = Number(valor) || 0;
    if (v <= 0 || cheio <= 0) return 0;
    return arred(tipo === 'PERCENTUAL' ? cheio * Math.min(v, 100) / 100 : v);
}

/** Bloco de condição especial reaproveitado na nova cobrança e no ajuste. */
function blocoCondicao({ motivo = '', tipo = 'PERCENTUAL', valor = '', proRata = true }) {
    return `
        <fieldset class="field cob-condicao">
            <legend>Condição especial</legend>
            <div class="cob-motivos">
                <label class="cob-motivo"><input type="radio" name="motivoDesconto" value="" ${motivo ? '' : 'checked'}><i class="fas fa-equals" aria-hidden="true"></i><span>Valor cheio</span></label>
                ${Object.entries(MOTIVOS).filter(([k]) => proRata || k !== 'PRO_RATA').map(([k, m]) => `
                <label class="cob-motivo" title="${esc(m.dica)}"><input type="radio" name="motivoDesconto" value="${k}" ${motivo === k ? 'checked' : ''}><i class="fas ${m.icone}" aria-hidden="true"></i><span>${esc(m.rotulo)}</span></label>`).join('')}
            </div>
        </fieldset>
        <div class="cob-prorata" data-prorata hidden>
            <div class="field"><label for="cob-inicio">Primeira aula no mês</label><input class="input num" type="date" id="cob-inicio" name="inicio"></div>
            <p class="cob-prorata-info" data-prorata-info></p>
        </div>
        <div class="field cob-desconto" data-desconto hidden>
            <label for="cob-desc">Desconto</label>
            <div class="cob-desconto-linha">
                <div class="segmented cob-tipo" role="radiogroup" aria-label="Tipo de desconto">
                    <label><input type="radio" name="tipoDesconto" value="PERCENTUAL" ${tipo === 'PERCENTUAL' ? 'checked' : ''}><span>%</span></label>
                    <label><input type="radio" name="tipoDesconto" value="VALOR" ${tipo === 'VALOR' ? 'checked' : ''}><span>R$</span></label>
                </div>
                <input class="input num" type="number" step="0.01" min="0" id="cob-desc" name="desconto" value="${esc(valor)}" placeholder="0">
                <div class="cob-atalhos" data-atalhos>${[10, 15, 20, 30, 50].map((p) => `<button type="button" class="cob-chip" data-pct="${p}">${p}%</button>`).join('')}</div>
            </div>
        </div>`;
}

/** Prévia em formato de recibo. */
function previa({ aluno, titulo, sub, cheio, desconto, motivo, vencimento, antes }) {
    const total = Math.max(0, arred(cheio - desconto));
    const pct = cheio > 0 && desconto > 0 ? Math.round(desconto / cheio * 100) : 0;
    return `
        <div class="cob-ticket">
            <div class="cob-ticket-topo">
                ${aluno ? `<span class="cob-ticket-aluno">${avatar(aluno, 'sm')}<span><strong>${esc(aluno.nome)}</strong><small>${esc(aluno.email || '')}</small></span></span>` : '<span class="faint">Escolha o aluno</span>'}
            </div>
            <p class="cob-ticket-titulo">${esc(titulo || 'Cobrança')}</p>
            ${sub ? `<p class="cob-ticket-sub">${esc(sub)}</p>` : ''}
            <dl class="cob-ticket-linhas">
                <div><dt>Valor cheio</dt><dd class="num">${moeda(cheio)}</dd></div>
                ${desconto > 0 ? `<div class="is-desc"><dt><i class="fas ${MOTIVOS[motivo]?.icone || 'fa-tag'}" aria-hidden="true"></i> ${esc(rotuloMotivo(motivo))}${pct ? ` <b class="num">−${pct}%</b>` : ''}</dt><dd class="num">− ${moeda(desconto)}</dd></div>` : ''}
            </dl>
            <div class="cob-ticket-total"><span>${antes !== undefined ? 'Novo valor' : 'Total a pagar'}</span><strong class="num">${moeda(total)}</strong></div>
            ${antes !== undefined && arred(antes) !== total ? `<p class="cob-ticket-antes num">Antes: <s>${moeda(antes)}</s> · ${total < antes ? 'economia' : 'aumento'} de ${moeda(Math.abs(antes - total))}</p>` : ''}
            <p class="cob-ticket-venc"><i class="fas fa-calendar-day" aria-hidden="true"></i> Vence em <b class="num">${vencimento ? data(vencimento) : '—'}</b></p>
        </div>`;
}

/** Liga o comportamento do bloco de condição (mostra campos, atalhos de %, pró-rata). */
function ligarCondicao(form, recalcular) {
    form.addEventListener('click', (e) => {
        const at = e.target.closest('[data-pct]');
        if (!at) return;
        form.querySelector('input[name=tipoDesconto][value=PERCENTUAL]').checked = true;
        form.desconto.value = at.dataset.pct;
        recalcular();
    });
    form.addEventListener('input', recalcular);
    form.addEventListener('change', recalcular);
}

// ======================================================================
// Nova cobrança
// ======================================================================
export async function formCobranca({ alunoId } = {}) {
    const alunos = await api.get(`${A}/financeiro/alunos-cobranca`);
    const mes = mesAtual();
    const m = modal({
        titulo: 'Nova cobrança',
        subtitulo: 'Para um aluno só: recém-chegados, bolsas, acordos e cobranças avulsas.',
        confirmar: 'Lançar cobrança',
        largo: true,
        corpo: `<div class="cob-grid">
            <div class="cob-campos">
                <div class="field">
                    <label for="cob-busca">Aluno</label>
                    <div class="input-icon"><i class="fas fa-magnifying-glass"></i><input class="input" id="cob-busca" placeholder="Buscar por nome ou e-mail" autocomplete="off"></div>
                    <input type="hidden" name="alunoId">
                    <div class="cob-alunos" data-alunos role="listbox" aria-label="Alunos"></div>
                </div>
                <fieldset class="field" data-bloco-turma hidden>
                    <legend>O que cobrar</legend>
                    <div class="cob-turmas" data-turmas></div>
                </fieldset>
                <div class="field" data-avulsa hidden>
                    <label for="cob-titulo">Título da cobrança</label>
                    <input class="input" id="cob-titulo" name="titulo" maxlength="150" placeholder="Ex.: Taxa de matrícula">
                    <div class="cob-sugestoes">${AVULSAS.map((s) => `<button type="button" class="cob-chip" data-titulo="${esc(s)}">${esc(s)}</button>`).join('')}</div>
                </div>
                <div class="form-grid">
                    <div class="field"><label for="cob-mes">Mês de referência</label><input class="input" type="month" id="cob-mes" name="mesReferencia" value="${mes}" required></div>
                    <div class="field"><label for="cob-venc">Vencimento</label><input class="input num" type="date" id="cob-venc" name="dataVencimento" value="${vencimentoSugerido(mes)}" required></div>
                    <div class="field span-2"><label for="cob-valor">Valor cheio (R$)</label><input class="input num" type="number" step="0.01" min="1" id="cob-valor" name="valorOriginal" value="189.90" required></div>
                </div>
                <p class="callout warn" data-duplicada hidden><i class="fas fa-circle-exclamation"></i><span></span></p>
                ${blocoCondicao({})}
                <div class="field"><label for="cob-obs">Observação interna <small class="faint">opcional</small></label><textarea class="input" id="cob-obs" name="observacao" rows="2" placeholder="Ex.: bolsa aprovada pela direção até dezembro"></textarea></div>
            </div>
            <aside class="cob-previa" aria-live="polite"><p class="cob-previa-rotulo"><i class="fas fa-receipt" aria-hidden="true"></i> Como o aluno vai ver</p><div data-previa></div></aside>
        </div>`,
        onSubmit: async (d) => {
            const r = estado();
            if (!r.aluno) throw new Error('Escolha o aluno.');
            if (r.avulsa && !d.titulo) throw new Error('Dê um título para a cobrança avulsa.');
            if (r.motivo && r.desconto <= 0) throw new Error('Informe o valor do desconto ou escolha "Valor cheio".');
            if (r.desconto >= r.cheio) throw new Error('O desconto precisa ser menor que o valor cheio.');
            const f = await api.post(`${A}/financeiro/faturas`, {
                alunoId: r.aluno.id,
                turmaId: r.avulsa ? null : r.turma?.id,
                mesReferencia: d.mesReferencia,
                titulo: r.avulsa ? d.titulo : null,
                valorOriginal: r.cheio,
                dataVencimento: d.dataVencimento,
                tipoDesconto: 'VALOR',
                desconto: r.desconto,
                motivoDesconto: r.desconto > 0 ? r.motivo : null,
                observacao: d.observacao || null,
            }, { silencioso: true });
            toastOk('Cobrança lançada', `${r.aluno.nome} já vê "${f.titulo}" (${moeda(f.valor)}) no portal.`);
        },
    });
    const form = m.form;
    let alunoSel = alunos.find((a) => a.id === alunoId) || null;
    let turmaSel = null; // null + avulsa=false → nada escolhido
    let avulsa = false;

    const listaAlunos = (filtro = '') => {
        const f = filtro.trim().toLowerCase();
        const vis = alunos.filter((a) => !f || `${a.nome} ${a.email}`.toLowerCase().includes(f)).slice(0, 40);
        $('[data-alunos]', m.el).innerHTML = vis.map((a) => `
            <button type="button" class="cob-aluno ${alunoSel?.id === a.id ? 'is-sel' : ''}" data-aluno="${a.id}" role="option" aria-selected="${alunoSel?.id === a.id}">
                ${avatar(a, 'sm')}<span><strong>${esc(a.nome)}</strong><small>${a.turmas.length ? esc(a.turmas.map((t) => t.nome).join(' · ')) : 'Sem matrícula ativa'}</small></span>
            </button>`).join('') || '<p class="faint" style="padding:8px">Nenhum aluno encontrado.</p>';
    };
    const listaTurmas = () => {
        const bloco = $('[data-bloco-turma]', m.el);
        bloco.hidden = !alunoSel;
        if (!alunoSel) return;
        const ym = form.mesReferencia.value;
        $('[data-turmas]', m.el).innerHTML = `${alunoSel.turmas.map((t) => {
            const cobrado = t.mesesCobrados.includes(ym);
            const novo = t.matriculadoEm && t.matriculadoEm.slice(0, 7) === ym;
            return `<label class="cob-turma ${cobrado ? 'is-cobrado' : ''}"><input type="radio" name="alvo" value="t${t.id}" ${turmaSel?.id === t.id ? 'checked' : ''}>
                <i class="fas fa-music" aria-hidden="true"></i>
                <span><strong>Mensalidade · ${esc(t.nome)}</strong><small>${t.matriculadoEm ? `Matrícula em ${data(t.matriculadoEm)}` : 'Matrícula ativa'}${cobrado ? ` · já cobrado em ${mesExtenso(ym)}` : ''}</small></span>
                ${novo ? '<em class="cob-selo">Novo no mês</em>' : ''}</label>`;
        }).join('')}
            <label class="cob-turma"><input type="radio" name="alvo" value="avulsa" ${avulsa ? 'checked' : ''}><i class="fas fa-receipt" aria-hidden="true"></i><span><strong>Cobrança avulsa</strong><small>Taxa, figurino, workshop, aula particular…</small></span></label>`;
    };
    const estado = () => {
        const cheio = arred(Number(form.valorOriginal.value) || 0);
        const motivo = form.querySelector('input[name=motivoDesconto]:checked')?.value || '';
        let desconto = 0;
        let infoProRata = '';
        if (motivo === 'PRO_RATA') {
            const ym = form.mesReferencia.value;
            const ini = form.inicio.value;
            const total = diasNoMes(ym);
            if (ini && ini.slice(0, 7) === ym) {
                const dia = Number(ini.slice(8));
                const restantes = total - dia + 1;
                desconto = arred(cheio - cheio * restantes / total);
                infoProRata = `Cobrando <b class="num">${restantes} de ${total}</b> dias de ${mesExtenso(ym)}: ${moeda(cheio - desconto)}.`;
            } else {
                infoProRata = `Escolha um dia dentro de ${mesExtenso(ym)}.`;
            }
        } else if (motivo) {
            desconto = descontoEmReais(cheio, form.querySelector('input[name=tipoDesconto]:checked').value, form.desconto.value);
        }
        return { cheio, motivo, desconto, infoProRata, aluno: alunoSel, turma: turmaSel, avulsa };
    };
    const recalcular = () => {
        const alvo = form.querySelector('input[name=alvo]:checked')?.value;
        avulsa = alvo === 'avulsa';
        turmaSel = alvo && alvo !== 'avulsa' ? alunoSel?.turmas.find((t) => `t${t.id}` === alvo) || null : null;
        $('[data-avulsa]', m.el).hidden = !avulsa;
        const r = estado();
        $('[data-prorata]', m.el).hidden = r.motivo !== 'PRO_RATA';
        $('[data-desconto]', m.el).hidden = !r.motivo || r.motivo === 'PRO_RATA';
        $('[data-prorata-info]', m.el).innerHTML = r.infoProRata;
        const ym = form.mesReferencia.value;
        const dup = turmaSel && turmaSel.mesesCobrados.includes(ym);
        const aviso = $('[data-duplicada]', m.el);
        aviso.hidden = !dup;
        if (dup) aviso.querySelector('span').textContent = `${alunoSel.nome} já tem a mensalidade de ${turmaSel.nome} em ${mesExtenso(ym)}. Para dar desconto nela, use "Ajustar" na lista de mensalidades.`;
        const titulo = avulsa ? (form.titulo.value || 'Cobrança avulsa') : turmaSel ? `Mensalidade ${mesExtenso(ym)}` : 'Escolha o que cobrar';
        $('[data-previa]', m.el).innerHTML = previa({
            aluno: r.aluno, titulo, sub: turmaSel ? turmaSel.nome : '', cheio: r.cheio, desconto: r.desconto, motivo: r.motivo, vencimento: form.dataVencimento.value,
        });
    };

    $('#cob-busca', m.el).addEventListener('input', (e) => listaAlunos(e.target.value));
    $('[data-alunos]', m.el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-aluno]');
        if (!b) return;
        alunoSel = alunos.find((a) => a.id === Number(b.dataset.aluno));
        form.alunoId.value = alunoSel.id;
        const ym = form.mesReferencia.value;
        // sugere a primeira turma ainda não cobrada no mês; recém-chegado já vem com o proporcional
        turmaSel = alunoSel.turmas.find((t) => !t.mesesCobrados.includes(ym)) || null;
        avulsa = !alunoSel.turmas.length;
        listaAlunos($('#cob-busca', m.el).value);
        listaTurmas();
        if (turmaSel?.matriculadoEm?.slice(0, 7) === ym) {
            form.querySelector('input[name=motivoDesconto][value=PRO_RATA]').checked = true;
            form.inicio.value = turmaSel.matriculadoEm;
        }
        recalcular();
    });
    form.addEventListener('click', (e) => {
        const s = e.target.closest('[data-titulo]');
        if (s) { form.titulo.value = s.dataset.titulo; recalcular(); }
    });
    form.mesReferencia.addEventListener('change', () => {
        const ym = form.mesReferencia.value;
        if (ym) form.dataVencimento.value = vencimentoSugerido(ym);
        listaTurmas();
    });
    ligarCondicao(form, recalcular);
    form.inicio.value = isoLocal(new Date());
    listaAlunos();
    if (alunoSel) $(`[data-aluno="${alunoSel.id}"]`, m.el)?.click();
    recalcular();
}

// ======================================================================
// Ajuste de cobrança existente
// ======================================================================
export function formAjuste(f) {
    const cheio = Number(f.valorOriginal ?? f.valor);
    const temDesc = Number(f.desconto) > 0;
    const m = modal({
        titulo: 'Ajustar cobrança',
        subtitulo: `${f.alunoNome} · ${f.titulo}`,
        confirmar: 'Salvar ajuste',
        largo: true,
        corpo: `<div class="cob-grid">
            <div class="cob-campos">
                <div class="cob-resumo">
                    <div><span>Valor cheio</span><strong class="num">${moeda(cheio)}</strong></div>
                    <div><span>Valor atual</span><strong class="num">${moeda(f.valor)}</strong></div>
                    <div><span>Vencimento</span><strong class="num">${data(f.dataVencimento)}</strong></div>
                </div>
                ${blocoCondicao({ motivo: temDesc ? f.motivoDesconto || 'OUTRO' : '', tipo: 'VALOR', valor: temDesc ? Number(f.desconto).toFixed(2) : '', proRata: true })}
                <div class="form-grid">
                    <div class="field"><label for="aj-venc">Vencimento</label><input class="input num" type="date" id="aj-venc" name="dataVencimento" value="${esc(f.dataVencimento)}"><span class="hint">Mude para renegociar o prazo.</span></div>
                    <div class="field"><label for="aj-obs">Observação interna</label><input class="input" id="aj-obs" name="observacao" value="${esc(f.observacao || '')}" placeholder="Opcional"></div>
                </div>
                ${f.diasAtraso ? `<p class="callout"><i class="fas fa-circle-info"></i><span>Está ${f.diasAtraso} dia(s) em atraso: multa e juros continuam sendo calculados sobre o novo valor até o novo vencimento.</span></p>` : ''}
            </div>
            <aside class="cob-previa" aria-live="polite"><p class="cob-previa-rotulo"><i class="fas fa-receipt" aria-hidden="true"></i> Depois do ajuste</p><div data-previa></div></aside>
        </div>`,
        onSubmit: async (d) => {
            const r = calc();
            if (r.motivo && r.desconto <= 0) throw new Error('Informe o valor do desconto ou escolha "Valor cheio".');
            if (r.desconto >= cheio) throw new Error('O desconto precisa ser menor que o valor cheio.');
            const novo = await api.put(`${A}/financeiro/faturas/${f.id}/ajuste`, {
                tipoDesconto: 'VALOR',
                desconto: r.desconto,
                motivoDesconto: r.desconto > 0 ? r.motivo : null,
                observacao: d.observacao ?? '',
                dataVencimento: d.dataVencimento || null,
            }, { silencioso: true });
            toastOk('Cobrança ajustada', `${f.alunoNome} agora paga ${moeda(novo.valor)} e foi avisado(a).`);
        },
    });
    const form = m.form;
    const calc = () => {
        const motivo = form.querySelector('input[name=motivoDesconto]:checked')?.value || '';
        let desconto = 0;
        let info = '';
        if (motivo === 'PRO_RATA') {
            const ym = f.mesReferencia;
            const ini = form.inicio.value;
            const total = diasNoMes(ym);
            if (ini && ini.slice(0, 7) === ym) {
                const restantes = total - Number(ini.slice(8)) + 1;
                desconto = arred(cheio - cheio * restantes / total);
                info = `Cobrando <b class="num">${restantes} de ${total}</b> dias de ${mesExtenso(ym)}.`;
            } else info = `Escolha um dia dentro de ${mesExtenso(ym)}.`;
        } else if (motivo) {
            desconto = descontoEmReais(cheio, form.querySelector('input[name=tipoDesconto]:checked').value, form.desconto.value);
        }
        return { motivo, desconto, info };
    };
    const recalcular = () => {
        const r = calc();
        $('[data-prorata]', m.el).hidden = r.motivo !== 'PRO_RATA';
        $('[data-desconto]', m.el).hidden = !r.motivo || r.motivo === 'PRO_RATA';
        $('[data-prorata-info]', m.el).innerHTML = r.info;
        $('[data-previa]', m.el).innerHTML = previa({
            aluno: { nome: f.alunoNome }, titulo: f.titulo, sub: f.turmaNome || '', cheio, desconto: r.desconto, motivo: r.motivo,
            vencimento: form.dataVencimento.value, antes: Number(f.valor),
        });
    };
    ligarCondicao(form, recalcular);
    form.inicio.value = `${f.mesReferencia}-01`;
    recalcular();
}

/** Valor com desconto para tabelas e cartões: líquido em destaque e o cheio riscado. */
export const valorComDesconto = (f) => (Number(f.desconto) > 0
    ? `${moeda(f.valor)}<br><small class="faint num"><s>${moeda(f.valorOriginal)}</s> · ${esc(rotuloMotivo(f.motivoDesconto))}</small>`
    : moeda(f.valor));
