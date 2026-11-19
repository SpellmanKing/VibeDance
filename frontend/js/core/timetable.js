import { esc, DIAS } from './ui.js';

/**
 * Matriz semanal (7 dias × horas). Cada turma vira um bloco posicionado pelo
 * horário real; blocos sobrepostos no mesmo dia dividem a largura em faixas.
 * turmas: TurmaResumo[] ; conflitos: Set de ids em conflito.
 */
const minutos = (hhmm) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return h * 60 + m;
};

export function renderTimetable(turmas, { conflitos = new Set(), horaMin = 7, horaMax = 22 } = {}) {
    const inicios = turmas.map((t) => minutos(t.horarioInicio));
    const fins = turmas.map((t) => minutos(t.horarioFim || t.horarioInicio) || minutos(t.horarioInicio) + 60);
    const hMin = Math.min(horaMin, ...inicios.map((m) => Math.floor(m / 60)));
    const hMax = Math.max(horaMax, ...fins.map((m) => Math.ceil(m / 60)));
    const alturaHora = 64;
    const hoje = ((new Date().getDay() + 6) % 7) + 1; // 1=Seg … 7=Dom

    const horas = [];
    for (let h = hMin; h < hMax; h += 1) horas.push(`<div class="tt-hour">${String(h).padStart(2, '0')}:00</div>`);

    const colunas = DIAS.map((nome, i) => {
        const dia = i + 1;
        const doDia = turmas.filter((t) => (t.dias || []).includes(dia))
            .map((t) => ({ t, ini: minutos(t.horarioInicio), fim: t.horarioFim ? minutos(t.horarioFim) : minutos(t.horarioInicio) + 60 }))
            .sort((a, b) => a.ini - b.ini);
        const faixas = [];
        doDia.forEach((ev) => {
            let f = faixas.findIndex((fimFaixa) => fimFaixa <= ev.ini);
            if (f === -1) { f = faixas.length; faixas.push(0); }
            faixas[f] = ev.fim;
            ev.faixa = f;
        });
        const n = Math.max(1, faixas.length);
        const blocos = doDia.map(({ t, ini, fim, faixa }) => {
            const top = ((ini - hMin * 60) / 60) * alturaHora;
            const altura = Math.max(34, ((fim - ini) / 60) * alturaHora - 4);
            const ocup = t.limiteVagas ? Math.round((t.ocupadas / t.limiteVagas) * 100) : 0;
            const cor = ['', 'c1', 'c2', 'c3'][(t.modalidadeId || 0) % 4];
            return `<button class="tt-event ${cor} ${conflitos.has(t.id) ? 'is-conflict' : ''}" data-turma="${t.id}"
                style="top:${top}px;height:${altura}px;left:calc(${(faixa / n) * 100}% + 4px);right:auto;width:calc(${100 / n}% - 8px)"
                title="${esc(t.nome)} · ${esc(t.horarioInicio)}–${esc(t.horarioFim || '')} · ${esc(t.salaNome)}">
                <strong>${esc(t.nome)}</strong>
                <span class="tt-meta num">${esc(t.horarioInicio)}–${esc(t.horarioFim || '')} · ${esc(t.salaNome)}</span>
                ${altura > 60 ? `<span class="tt-meta">${esc(t.professorNome)}</span>` : ''}
                ${altura > 76 ? `<div class="meter ${ocup >= 90 ? 'danger' : ocup >= 70 ? 'warn' : 'ok'}"><span style="width:${Math.min(100, ocup)}%"></span></div>` : ''}
            </button>`;
        }).join('');
        let agora = '';
        if (dia === hoje) {
            const d = new Date();
            const m = d.getHours() * 60 + d.getMinutes();
            if (m >= hMin * 60 && m <= hMax * 60) agora = `<div class="tt-now" style="top:${((m - hMin * 60) / 60) * alturaHora}px"></div>`;
        }
        return `<div class="tt-col ${dia === hoje ? 'is-today' : ''}" style="height:${(hMax - hMin) * alturaHora}px">${blocos}${agora}</div>`;
    }).join('');

    const cabecalho = `<div class="tt-head"></div>${DIAS.map((d, i) => `<div class="tt-head ${i + 1 === hoje ? 'is-today' : ''}">${d}</div>`).join('')}`;
    return `<div class="timetable" style="--hour-h:${alturaHora}px">${cabecalho}<div class="tt-hours">${horas.join('')}</div>${colunas}</div>`;
}
