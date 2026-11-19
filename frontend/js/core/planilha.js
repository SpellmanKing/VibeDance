import { SmartTable } from './table.js';
import { api } from './api.js';
import { esc, html, raw, moeda, data, dataHora, badge, toastOk, toast, comBotao } from './ui.js';

/**
 * Planilha financeira interativa (aluno e ADM): busca instantânea, filtro por status e
 * período, ordenação por coluna, totalizadores que acompanham os filtros e exportação
 * CSV exatamente do que está na tela.
 *
 * linhas: LinhaPlanilha[] vindas de /financeiro/planilha
 */
const FORMAS = { PIX: 'PIX', CARTAO_CREDITO: 'Cartão de crédito', BOLETO: 'Boleto', COMPROVANTE_MANUAL: 'Comprovante / outro' };
const STATUS_FILTRO = [['', 'Todos'], ['PAGO', 'Pagos'], ['PENDENTE', 'Pendentes'], ['ATRASADO', 'Atrasados'], ['EM_ANALISE', 'Em análise'], ['ESTORNADO', 'Estornados']];
const ROTULO_STATUS = { PAGO: 'Pago', PENDENTE: 'Pendente', ATRASADO: 'Atrasado', EM_ANALISE: 'Em análise', ESTORNADO: 'Estornado', CANCELADO: 'Cancelado' };

const mesTexto = (ref) => {
    if (!ref) return '—';
    const [a, m] = ref.split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/');
};
const ajusteTxt = (v) => {
    const n = Number(v || 0);
    if (!n) return '<span class="faint">—</span>';
    return `<span class="${n > 0 ? 'warn' : 'ok'}">${n > 0 ? '+' : '−'} ${moeda(Math.abs(n))}</span>`;
};

export function planilhaFinanceira(el, linhas, { comAluno = false, nomeArquivo = 'planilha-vibedance', onLinha, pdfUrl } = {}) {
    const meses = [...new Set(linhas.map((l) => l.referencia).filter(Boolean))].sort();
    const opcoesMes = (sel) => meses.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${esc(mesTexto(m))}</option>`).join('');

    el.innerHTML = html`
        <div class="sheet-totals" aria-live="polite">
            <div class="sheet-total ok"><span>Total recebido</span><b class="num" data-t="recebido">—</b><small data-t="recebidoQtd"></small></div>
            <div class="sheet-total warn"><span>Total pendente</span><b class="num" data-t="pendente">—</b><small data-t="pendenteQtd"></small></div>
            <div class="sheet-total danger"><span>Inadimplência</span><b class="num" data-t="atrasado">—</b><small data-t="inadimplencia"></small></div>
            <div class="sheet-total"><span>Lançamentos</span><b class="num" data-t="qtd">—</b><small data-t="filtro">com os filtros atuais</small></div>
        </div>
        <div class="table-tools sheet-tools">
            <div class="input-icon"><i class="fas fa-magnifying-glass"></i><input class="input" data-f="busca" placeholder="${comAluno ? 'Buscar aluno, turma, transação…' : 'Buscar mês, turma, transação…'}" aria-label="Buscar na planilha"></div>
            <div class="segmented" data-f="status" role="group" aria-label="Filtrar por status">
                ${raw(STATUS_FILTRO.map(([v, l], i) => `<button type="button" data-v="${v}" class="${i === 0 ? 'is-active' : ''}">${l}</button>`).join(''))}
            </div>
            <div class="sheet-period">
                <label class="sr-only" for="pl-de">Período inicial</label>
                <select class="input" id="pl-de" data-f="de"><option value="">Desde o início</option>${raw(opcoesMes())}</select>
                <span class="faint">até</span>
                <label class="sr-only" for="pl-ate">Período final</label>
                <select class="input" id="pl-ate" data-f="ate"><option value="">Hoje</option>${raw(opcoesMes())}</select>
            </div>
            <div class="sheet-export">
                ${raw(pdfUrl ? '<button type="button" class="btn btn-sm btn-primary" data-f="pdf"><i class="fas fa-file-pdf"></i> Exportar PDF</button>' : '')}
                <button type="button" class="btn btn-sm btn-ghost" data-f="csv" title="Planilha para Excel"><i class="fas fa-file-csv"></i> CSV</button>
            </div>
        </div>
        <div data-f="tabela"></div>`;

    const $f = (n) => el.querySelector(`[data-f="${n}"]`);
    const colunas = [
        { chave: 'transacao', titulo: 'Transação', render: (l) => `<span class="num tx">${esc(l.transacao)}</span>` },
        ...(comAluno ? [{ chave: 'alunoNome', titulo: 'Aluno', render: (l) => `<strong>${esc(l.alunoNome)}</strong>` }] : []),
        { chave: 'referencia', titulo: 'Referência', render: (l) => `<span class="num">${esc(mesTexto(l.referencia))}</span>` },
        { chave: 'turmaNome', titulo: 'Turma / plano', render: (l) => `${esc(l.turmaNome || 'Plano avulso')}` },
        { chave: 'metodo', titulo: 'Método', render: (l) => (l.metodo ? `${esc(FORMAS[l.metodo] || l.metodo)}${l.metodoDetalhe ? `<br><small class="faint">${esc(l.metodoDetalhe)}</small>` : ''}` : '<span class="faint">—</span>') },
        { chave: 'vencimento', titulo: 'Vencimento', render: (l) => `<span class="num">${data(l.vencimento)}</span>` },
        { chave: 'pagoEm', titulo: 'Pagamento', render: (l) => `<span class="num">${l.pagoEm ? dataHora(l.pagoEm) : '<span class="faint">—</span>'}</span>` },
        { chave: 'valorBase', titulo: 'Valor base', num: true, valor: (l) => Number(l.valorBase || 0), render: (l) => moeda(l.valorBase) },
        { chave: 'ajuste', titulo: 'Desc. / acrésc.', num: true, valor: (l) => Number(l.ajuste || 0), render: (l) => ajusteTxt(l.ajuste) },
        { chave: 'valorFinal', titulo: 'Valor final', num: true, valor: (l) => Number(l.valorFinal || 0), render: (l) => `<b>${moeda(l.valorFinal)}</b>` },
        { chave: 'status', titulo: 'Status', render: (l) => badge(l.status === 'PAGO' ? 'CONFIRMADO' : l.status === 'ATRASADO' ? 'VENCIDO' : l.status, ROTULO_STATUS[l.status]) },
    ];

    const tabela = new SmartTable({
        el: $f('tabela'),
        colunas,
        porPagina: 12,
        busca: (l) => `${l.transacao} ${l.alunoNome || ''} ${l.turmaNome || ''} ${l.titulo || ''} ${mesTexto(l.referencia)} ${l.referencia || ''} ${FORMAS[l.metodo] || ''} ${l.metodoDetalhe || ''}`,
        onLinha,
        vazio: ['fa-table-list', 'Nenhum lançamento encontrado', 'Ajuste a busca, o status ou o período.'],
    });
    tabela.ordem = { chave: 'vencimento', dir: 'desc' };

    tabela.onRender = () => {
        const vis = tabela.visiveis();
        const soma = (fn) => vis.filter(fn).reduce((a, l) => a + Number(l.valorFinal || 0), 0);
        const conta = (fn) => vis.filter(fn).length;
        const pago = (l) => l.status === 'PAGO';
        const aberto = (l) => ['PENDENTE', 'ATRASADO', 'EM_ANALISE'].includes(l.status);
        const atrasado = (l) => l.status === 'ATRASADO';
        const recebido = soma(pago);
        const pendente = soma(aberto);
        const vencido = soma(atrasado);
        const base = recebido + pendente;
        el.querySelector('[data-t="recebido"]').textContent = moeda(recebido);
        el.querySelector('[data-t="recebidoQtd"]').textContent = `${conta(pago)} pagamento(s)`;
        el.querySelector('[data-t="pendente"]').textContent = moeda(pendente);
        el.querySelector('[data-t="pendenteQtd"]').textContent = `${conta(aberto)} em aberto`;
        el.querySelector('[data-t="atrasado"]').textContent = moeda(vencido);
        el.querySelector('[data-t="inadimplencia"]').textContent = base ? `${((vencido / base) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do faturado · ${conta(atrasado)} atrasada(s)` : 'sem cobranças no filtro';
        el.querySelector('[data-t="qtd"]').textContent = vis.length;
    };

    tabela.setDados(linhas);

    // Filtros
    $f('busca').addEventListener('input', (e) => tabela.buscar(e.target.value));
    $f('status').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        $f('status').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
        tabela.setFiltro('status', b.dataset.v ? (l) => l.status === b.dataset.v : null);
    });
    const periodo = () => {
        const de = $f('de').value;
        const ate = $f('ate').value;
        if (de && ate && de > ate) {
            toast('Período inválido', { tipo: 'warn', texto: 'O mês inicial deve vir antes do final.' });
            $f('ate').value = '';
        }
        const d = $f('de').value;
        const a = $f('ate').value;
        tabela.setFiltro('periodo', d || a ? (l) => (!d || (l.referencia || '') >= d) && (!a || (l.referencia || '') <= a) : null);
    };
    $f('de').addEventListener('change', periodo);
    $f('ate').addEventListener('change', periodo);

    // Exportação PDF: o servidor reaplica os mesmos filtros e monta o relatório
    $f('pdf')?.addEventListener('click', async (e) => {
        if (!tabela.visiveis().length) {
            toast('Nada para exportar', { tipo: 'warn', texto: 'Nenhum lançamento corresponde aos filtros atuais.' });
            return;
        }
        const ativo = $f('status').querySelector('.is-active');
        const q = new URLSearchParams();
        if (ativo?.dataset.v) q.set('status', ativo.dataset.v);
        if ($f('de').value) q.set('de', $f('de').value);
        if ($f('ate').value) q.set('ate', $f('ate').value);
        if ($f('busca').value.trim()) q.set('busca', $f('busca').value.trim());
        const nome = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.pdf`;
        await comBotao(e.currentTarget, () => api.arquivo(`${pdfUrl}${q.toString() ? `?${q}` : ''}`, { nome, baixar: true }));
        toastOk('Relatório em PDF gerado', `${tabela.visiveis().length} lançamento(s) com os filtros atuais.`);
    });

    // Exportação CSV (padrão Excel pt-BR: ";" e vírgula decimal)
    $f('csv').addEventListener('click', () => {
        const vis = tabela.visiveis();
        if (!vis.length) {
            toast('Nada para exportar', { tipo: 'warn', texto: 'Nenhum lançamento corresponde aos filtros atuais.' });
            return;
        }
        const n = (v) => Number(v || 0).toFixed(2).replace('.', ',');
        const cab = ['Transação', ...(comAluno ? ['Aluno'] : []), 'Referência', 'Cobrança', 'Turma/Plano', 'Método', 'Detalhe do método',
            'Vencimento', 'Data de pagamento', 'Valor base', 'Descontos/Acréscimos', 'Valor final', 'Status'];
        const linhasCsv = vis.map((l) => [l.transacao, ...(comAluno ? [l.alunoNome] : []), l.referencia || '', l.titulo || '',
            l.turmaNome || '', FORMAS[l.metodo] || '', l.metodoDetalhe || '', data(l.vencimento), l.pagoEm ? dataHora(l.pagoEm) : '',
            n(l.valorBase), n(l.ajuste), n(l.valorFinal), ROTULO_STATUS[l.status] || l.status]);
        const csv = [cab, ...linhasCsv].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toastOk('CSV exportado', `${vis.length} lançamento(s) com os filtros atuais.`);
    });

    return tabela;
}
