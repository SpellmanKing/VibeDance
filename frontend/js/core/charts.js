import { esc, moeda } from './ui.js';

/**
 * Gráficos SVG leves (sem dependências externas), com tooltip nativo (<title>)
 * e números tabulares. Cores seguem os tokens do tema.
 */
const COR = { ambar: '#E8A653', carmim: '#DB4F7C', salvia: '#78C2A4', azul: '#8FA8D8', marfim: '#E9D9C2', fundo: '#141113', texto: '#F4EEE7' };
export const PALETA = [COR.ambar, COR.carmim, COR.salvia, COR.azul, COR.marfim, '#C98A6B', '#B79BD1'];

/** Barras agrupadas (ex.: recebido x faturado por mês). */
export function barrasAgrupadas(pontos, { series, formato = moeda, altura = 240 }) {
    const largura = 640;
    const m = { t: 16, r: 8, b: 28, l: 64 };
    const max = Math.max(1, ...pontos.flatMap((p) => series.map((s) => Number(p[s.chave] || 0)))) * 1.12;
    const w = largura - m.l - m.r;
    const h = altura - m.t - m.b;
    const grupo = w / Math.max(1, pontos.length);
    const barra = Math.min(26, (grupo * 0.7) / series.length);
    const y = (v) => m.t + h - (Number(v || 0) / max) * h;

    const linhas = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = max * f;
        return `<line class="grid-line" x1="${m.l}" x2="${largura - m.r}" y1="${y(v)}" y2="${y(v)}"/>
                <text class="axis-label" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(formato(v).replace(',00', ''))}</text>`;
    }).join('');

    const barras = pontos.map((p, i) => {
        const x0 = m.l + i * grupo + (grupo - barra * series.length) / 2;
        const bs = series.map((s, j) => {
            const v = Number(p[s.chave] || 0);
            const yy = y(v);
            return `<rect class="bar" x="${x0 + j * barra + 1}" y="${yy}" width="${barra - 2}" height="${Math.max(0, m.t + h - yy)}" rx="4" fill="${s.cor}" opacity="${s.opacidade ?? 1}"><title>${esc(s.rotulo)} · ${esc(p.rotulo)}: ${esc(formato(v))}</title></rect>`;
        }).join('');
        return `${bs}<text class="axis-label" x="${m.l + i * grupo + grupo / 2}" y="${altura - 8}" text-anchor="middle">${esc(p.rotulo)}</text>`;
    }).join('');

    return `<svg class="chart" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de barras">${linhas}${barras}</svg>`;
}

/** Rosca com legenda (ex.: distribuição por modalidade). */
export function rosca(fatias, { tamanho = 160, rotuloCentro = '', valorCentro = '' } = {}) {
    const total = fatias.reduce((a, f) => a + Number(f.valor || 0), 0) || 1;
    const r = 62;
    const c = 2 * Math.PI * r;
    let acumulado = 0;
    const arcos = fatias.map((f, i) => {
        const frac = Number(f.valor || 0) / total;
        const arco = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${PALETA[i % PALETA.length]}" stroke-width="18"
            stroke-dasharray="${Math.max(0, frac * c - 3)} ${c}" stroke-dashoffset="${-acumulado * c}" transform="rotate(-90 80 80)">
            <title>${esc(f.rotulo)}: ${f.valor}</title></circle>`;
        acumulado += frac;
        return arco;
    }).join('');
    const svg = `<svg class="chart" viewBox="0 0 160 160" width="${tamanho}" role="img" aria-label="Gráfico de rosca">
        <circle cx="80" cy="80" r="${r}" fill="none" stroke="rgba(244,236,225,.07)" stroke-width="18"/>${arcos}
        <text x="80" y="80" text-anchor="middle" fill="${COR.texto}" font-family="Fraunces, Georgia, serif" font-weight="600" font-size="26">${esc(valorCentro)}</text>
        <text x="80" y="98" text-anchor="middle" class="axis-label">${esc(rotuloCentro)}</text></svg>`;
    const legenda = `<ul class="clean donut-list">${fatias.map((f, i) => `<li><i style="width:10px;height:10px;border-radius:3px;background:${PALETA[i % PALETA.length]}"></i>${esc(f.rotulo)}<b>${f.valor}</b></li>`).join('')}</ul>`;
    return `<div class="donut-wrap">${svg}${legenda}</div>`;
}

/** Linha com área (ex.: evolução de notas 0–10). */
export function linha(pontos, { min = 0, max = 10, altura = 200, cor = COR.ambar, formato = (v) => v } = {}) {
    const largura = 640;
    const m = { t: 16, r: 16, b: 28, l: 36 };
    const w = largura - m.l - m.r;
    const h = altura - m.t - m.b;
    if (!pontos.length) return '';
    const x = (i) => m.l + (pontos.length === 1 ? w / 2 : (i / (pontos.length - 1)) * w);
    const y = (v) => m.t + h - ((Number(v) - min) / (max - min)) * h;
    const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join(' ');
    const area = `${d} L${x(pontos.length - 1)},${m.t + h} L${x(0)},${m.t + h} Z`;
    const grade = [min, (min + max) / 2, max].map((v) => `<line class="grid-line" x1="${m.l}" x2="${largura - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const marcas = pontos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.valor)}" r="4.5" fill="${COR.fundo}" stroke="${cor}" stroke-width="2"><title>${esc(p.rotulo)}: ${esc(formato(p.valor))}</title></circle><text class="axis-label" x="${x(i)}" y="${altura - 8}" text-anchor="middle">${esc(p.rotulo)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de linha">
        <defs><linearGradient id="g-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".35"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
        ${grade}<path d="${area}" fill="url(#g-area)"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linejoin="round"/>${marcas}</svg>`;
}

export function medidor(percentual, { limiteOk = 85, limiteAtencao = 75 } = {}) {
    const p = Math.max(0, Math.min(100, Number(percentual || 0)));
    const cls = p >= limiteOk ? 'ok' : p >= limiteAtencao ? 'warn' : 'danger';
    return `<div class="meter ${cls}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p}%"></span></div>`;
}
