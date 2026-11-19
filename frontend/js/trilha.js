/**
 * Trilhas da home: música sintetizada no navegador (Web Audio, sem arquivos)
 * que toca ao passar o mouse nos motivos musicais, no mesmo tempo das animações.
 *
 *  ADM        Maestoso · 72 bpm  — melodia das notas da pauta (ciclo de 3,6 s)
 *  Professor  Allegro · 120 bpm  — "5, 6, 7, 8" com metrônomo e groove (ciclo de 2 s)
 *  Aluno      Vivace · 160 bpm   — groove dançante de 4 compassos (ciclo de 6 s)
 */

const CHAVE_SOM = 'vd-som-home';
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

let ctx = null;
let mestre = null;
let reverb = null;
let ruido = null;

function audio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    mestre = ctx.createGain();
    mestre.gain.value = 0.55;
    mestre.connect(comp).connect(ctx.destination);
    // reverb de sala de ensaio: resposta ao impulso gerada com ruído decaindo
    reverb = ctx.createConvolver();
    const dur = 2.2, len = Math.floor(ctx.sampleRate * dur);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    reverb.buffer = ir;
    const volta = ctx.createGain(); volta.gain.value = 0.28;
    reverb.connect(volta).connect(mestre);
    ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const r = ruido.getChannelData(0);
    for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
    return ctx;
}

// ------------------------------------------------------------ instrumentos
function env(g, t, pico, ataque, queda) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
}
function saida(destino, molhado = 0) {
    const g = ctx.createGain();
    g.connect(destino);
    if (molhado) { const s = ctx.createGain(); s.gain.value = molhado; g.connect(s).connect(reverb); }
    return g;
}
function osc(tipo, f, t, fim, destino) {
    const o = ctx.createOscillator();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    o.connect(destino); o.start(t); o.stop(fim);
    return o;
}
function piano(dest, nota, t, dur = 0.9, vel = 0.32) {
    const g = saida(dest, 0.9);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g);
    env(g, t, vel, 0.006, dur);
    osc('triangle', midi(nota), t, t + dur + 0.05, lp);
    const h = ctx.createGain(); h.gain.value = 0.25; h.connect(lp);
    osc('sine', midi(nota) * 2, t, t + dur + 0.05, h);
}
function pad(dest, notas, t, dur, vel = 0.06) {
    const g = saida(dest, 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.35);
    g.gain.setValueAtTime(vel, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g);
    notas.forEach((n) => { osc('sawtooth', midi(n), t, t + dur + 0.05, lp).detune.value = 6; osc('triangle', midi(n), t, t + dur + 0.05, lp); });
}
function baixo(dest, nota, t, dur = 0.3, vel = 0.3) {
    const g = saida(dest);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    lp.connect(g);
    env(g, t, vel, 0.008, dur);
    osc('sawtooth', midi(nota), t, t + dur + 0.05, lp);
}
function pluck(dest, nota, t, vel = 0.12) {
    const g = saida(dest, 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.22);
    lp.connect(g);
    env(g, t, vel, 0.004, 0.24);
    osc('square', midi(nota), t, t + 0.3, lp);
}
function bumbo(dest, t, vel = 0.9) {
    const g = saida(dest);
    env(g, t, vel, 0.003, 0.32);
    const o = osc('sine', 150, t, t + 0.4, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
}
function barulho(dest, t, dur, vel, tipo, freq, molhado = 0) {
    const g = saida(dest, molhado);
    const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.connect(g);
    env(g, t, vel, 0.002, dur);
    const s = ctx.createBufferSource(); s.buffer = ruido; s.connect(f); s.start(t); s.stop(t + dur + 0.05);
}
const caixa = (d, t) => { barulho(d, t, 0.17, 0.35, 'highpass', 1400, 0.4); const g = saida(d); env(g, t, 0.18, 0.002, 0.08); osc('triangle', 190, t, t + 0.12, g); };
const palma = (d, t) => [0, 0.012, 0.024].forEach((x) => barulho(d, t + x, 0.11, 0.22, 'bandpass', 1600, 0.5));
const chimbal = (d, t, vel = 0.08, aberto = false) => barulho(d, t, aberto ? 0.18 : 0.04, vel, 'highpass', 7500);
function tique(dest, t, acento) { // metrônomo / bloco de madeira
    const g = saida(dest, 0.2);
    env(g, t, acento ? 0.32 : 0.2, 0.001, 0.05);
    osc('sine', acento ? 2100 : 1500, t, t + 0.08, g);
}

// ------------------------------------------------------------ trilhas
const TRILHAS = {
    ADM: { // pauta: F A C B (D E) A G — uma nota a cada 0,42 s, como na animação
        ciclo: 3.6,
        eventos: [
            [0, (d, t) => { pad(d, [53, 57, 60], t, 1.75); baixo(d, 41, t, 1.4, 0.18); }],
            [1.68, (d, t) => { pad(d, [48, 55, 64], t, 1.9); baixo(d, 36, t, 1.6, 0.18); }],
            ...[[0, 65], [0.42, 69], [0.84, 72], [1.26, 71], [1.68, 74], [1.89, 76], [2.1, 69], [2.52, 67, 1.1]]
                .map(([x, n, dur]) => [x, (d, t) => piano(d, n, t, dur || 0.75)]),
        ],
    },
    Professor: { // 120 bpm: cada número (5, 6, 7, 8) é uma batida de 0,5 s
        ciclo: 2,
        eventos: [
            ...[0, 0.5, 1, 1.5].map((x, i) => [x, (d, t) => tique(d, t, i === 0)]),
            [0, (d, t) => bumbo(d, t)], [1, (d, t) => bumbo(d, t)], [1.25, (d, t) => bumbo(d, t, 0.6)],
            [0.5, (d, t) => palma(d, t)], [1.5, (d, t) => palma(d, t)],
            ...[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75].map((x, i) => [x, (d, t) => chimbal(d, t, i % 2 ? 0.07 : 0.04, i === 7)]),
            [0, (d, t) => baixo(d, 45, t, 0.4)], [0.75, (d, t) => baixo(d, 45, t, 0.2)], [1, (d, t) => baixo(d, 48, t, 0.4)], [1.5, (d, t) => baixo(d, 50, t, 0.35)],
        ],
    },
    Aluno: { // 160 bpm: 16 batidas de 0,375 s = os 6 s da onda tocando
        ciclo: 6,
        eventos: (() => {
            const b = 60 / 160, ev = [];
            const acordes = [[57, 60, 64, 45], [53, 57, 60, 41], [55, 60, 64, 48], [55, 59, 62, 43]]; // Am F C G
            for (let i = 0; i < 16; i++) {
                const x = i * b;
                ev.push([x, (d, t) => bumbo(d, t, 0.85)]);
                ev.push([x + b / 2, (d, t) => chimbal(d, t, 0.09, i % 4 === 3)]);
                if (i % 2) ev.push([x, (d, t) => caixa(d, t)]);
            }
            acordes.forEach(([a, c, e, raiz], compasso) => {
                const x0 = compasso * 4 * b;
                ev.push([x0, (d, t) => pad(d, [a, c, e], t, 4 * b, 0.045)]);
                for (let k = 0; k < 8; k++) {
                    const x = x0 + k * (b / 2);
                    ev.push([x, (d, t) => pluck(d, [a, c, e, c][k % 4] + 12, t)]);
                    if (k % 2) ev.push([x, (d, t) => baixo(d, raiz, t, 0.16, 0.26)]);
                }
            });
            return ev.sort((p, q) => p[0] - q[0]);
        })(),
    },
};

// ------------------------------------------------------------ tocador
let atual = null; // { nome, host, faixa, timer }

function tocar(nome, host) {
    if (atual?.host === host && atual.nome === nome) return;
    parar();
    const trilha = TRILHAS[nome];
    if (!trilha || !audio()) return;
    const faixa = ctx.createGain();
    faixa.gain.setValueAtTime(0.0001, ctx.currentTime);
    faixa.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.08);
    faixa.connect(mestre);
    const inicio = ctx.currentTime + 0.04;
    // recomeça as animações do motivo para batida e imagem andarem juntas
    host.getAnimations?.({ subtree: true }).forEach((a) => { a.currentTime = 0; });
    let base = inicio, i = 0;
    const agendar = () => {
        const limite = ctx.currentTime + 0.3;
        for (;;) {
            const [x, tocarEvento] = trilha.eventos[i];
            if (base + x > limite) break;
            if (base + x >= ctx.currentTime - 0.02) tocarEvento(faixa, Math.max(base + x, ctx.currentTime));
            i += 1;
            if (i === trilha.eventos.length) { i = 0; base += trilha.ciclo; }
        }
    };
    agendar();
    atual = { nome, host, faixa, timer: setInterval(agendar, 60) };
    host.classList.add('is-tocando');
}

function parar() {
    if (!atual) return;
    const { faixa, timer, host } = atual;
    clearInterval(timer);
    const t = ctx.currentTime;
    faixa.gain.cancelScheduledValues(t);
    faixa.gain.setValueAtTime(Math.max(faixa.gain.value, 0.0001), t);
    faixa.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    setTimeout(() => faixa.disconnect(), 600);
    host.classList.remove('is-tocando');
    atual = null;
}

const somLigado = () => { try { return localStorage.getItem(CHAVE_SOM) !== 'off'; } catch { return true; } };
const salvarSom = (v) => { try { localStorage.setItem(CHAVE_SOM, v ? 'on' : 'off'); } catch { /* sem armazenamento */ } };
// O navegador só libera áudio depois de algum clique/tecla na página
const liberado = () => (ctx && ctx.state === 'running') || navigator.userActivation?.hasBeenActive !== false;

function atualizarDica(host) {
    const dica = host.querySelector('.trilha-dica');
    if (!dica) return;
    let icone = 'fa-volume-high', texto = 'Clique para ouvir';
    if (!somLigado()) { icone = 'fa-volume-xmark'; texto = 'Som desligado · clique para ligar'; }
    else if (host.classList.contains('is-tocando')) { icone = 'fa-music'; texto = 'Tocando · clique para silenciar'; }
    dica.innerHTML = `<i class="fas ${icone}" aria-hidden="true"></i>${texto}`;
}

// resume() fica pendente para sempre quando o navegador bloqueia: limita a espera
const retomar = () => Promise.race([ctx.resume().catch(() => {}), new Promise((r) => { setTimeout(r, 250); })]);

async function entrar(host, nome) {
    if (!somLigado()) return atualizarDica(host);
    if (!liberado()) return atualizarDica(host);
    if (!audio()) return undefined;
    if (ctx.state !== 'running') await retomar();
    if (ctx.state !== 'running' || !host.matches(':hover')) return atualizarDica(host);
    tocar(nome(), host);
    return atualizarDica(host);
}

/**
 * Liga as trilhas em elementos que tenham um motivo musical.
 * @param alvos lista de { host, trilha: () => 'ADM' | 'Professor' | 'Aluno' }
 */
export function ligarTrilhas(alvos) {
    alvos.forEach(({ host, trilha }) => {
        if (!host) return;
        host.classList.add('trilha-host');
        host.insertAdjacentHTML('beforeend', '<span class="trilha-dica" aria-hidden="true"></span>');
        atualizarDica(host);
        host.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') entrar(host, trilha); });
        host.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'touch') return;
            if (atual?.host === host) parar();
            atualizarDica(host);
        });
        host.addEventListener('click', async (e) => {
            if (e.target.closest('a, button, input, label')) return;
            const tocandoAqui = atual?.host === host;
            if (tocandoAqui) { parar(); salvarSom(false); } else {
                salvarSom(true);
                if (!audio()) return;
                await retomar();
                if (ctx.state === 'running') tocar(trilha(), host);
            }
            atualizarDica(host);
        });
        host._trocarTrilha = () => { if (atual?.host === host) { parar(); tocar(trilha(), host); atualizarDica(host); } };
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
}
