import { api } from './js/core/api.js';
import { Session } from './js/core/session.js';
import { DOMINIO_REGEX, MSG_DOMINIO, PORTAIS, API_BASE } from './js/core/config.js';
import { drawer, esc, urlArquivo } from './js/core/ui.js';
import { iniciarQueroDancar } from './js/quero-dancar.js';
import { ligarTrilhas } from './js/trilha.js';

const form = document.getElementById('form-login');
const email = document.getElementById('email');
const senha = document.getElementById('senha');
const hint = document.getElementById('email-hint');
const caixaErro = document.getElementById('login-erro');
const caixaAviso = document.getElementById('login-aviso');
const botao = document.getElementById('btn-entrar');

// Sessão válida → direto ao portal (exceto quem abriu o link do pedido de acesso)
if (Session.user && !Session.expirado() && !/^#(acompanhar|quero-dancar)/.test(location.hash)) {
    location.replace(PORTAIS[Session.user.perfil] || 'index.html');
}

const MOTIVOS = {
    sessao: 'Sua sessão expirou. Entre novamente para continuar.',
    dominio: MSG_DOMINIO,
    suspensa: 'Sua conta está suspensa. Procure a administração do estúdio.',
};
const motivo = new URLSearchParams(location.search).get('motivo');
if (MOTIVOS[motivo]) mostrar(caixaAviso, MOTIVOS[motivo]);

const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Seletor de perfil (ADM / Professor / Aluno)
const PERFIS = {
    ADM: {
        sub: 'Cockpit completo do estúdio: KPIs, grade horária sem conflitos, financeiro e matrículas — tudo sincronizado em tempo real.',
        pontos: [['fa-chart-line', 'MRR e inadimplência'], ['fa-calendar-week', 'Grade com detecção de conflito'], ['fa-file-invoice-dollar', 'Baixa e comprovantes']],
        placeholder: 'admin@vibedance.com',
        faixa: 'Faixa 01 · A regência', andamento: ['Maestoso', 72], icone: 'fa-crown',
    },
    Professor: {
        sub: 'Seu dia no estúdio em uma tela: chamada em 1 clique, diário de classe, repertório e avaliações técnicas por aluno.',
        pontos: [['fa-clipboard-check', 'Chamada em 1 clique'], ['fa-book-open', 'Diário e repertório'], ['fa-star-half-stroke', 'Avaliações técnicas']],
        placeholder: 'prof.nome@vibedance.com',
        faixa: 'Faixa 02 · A contagem', andamento: ['Allegro', 120], icone: 'fa-person-chalkboard',
    },
    Aluno: {
        sub: 'Seu passaporte de dança: próxima aula, check-in antecipado, evolução das notas e financeiro com PIX copia-e-cola.',
        pontos: [['fa-id-card', 'Passaporte digital'], ['fa-location-dot', 'Check-in antecipado'], ['fa-arrow-trend-up', 'Hub de evolução']],
        placeholder: 'aluno.nome@vibedance.com',
        faixa: 'Faixa 03 · O passo', andamento: ['Vivace', 160], icone: 'fa-shoe-prints',
    },
};
const switcher = document.querySelector('.role-switch');
const glider = switcher.querySelector('.role-glider');
const heroSub = document.getElementById('hero-sub');
const rolePontos = document.getElementById('role-points');
const roleChip = document.getElementById('role-chip');
const demoBotoes = [...document.querySelectorAll('#demo-list button[data-perfil]')];

function moverGlider(btn) {
    glider.style.width = `${btn.offsetWidth}px`;
    glider.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function escolherPerfil(btn, animar = true) {
    const perfil = btn.dataset.perfil;
    const cfg = PERFIS[perfil];
    switcher.querySelectorAll('button').forEach((b) => {
        const ativo = b === btn;
        b.classList.toggle('is-active', ativo);
        b.setAttribute('aria-selected', String(ativo));
    });
    moverGlider(btn);
    roleChip.textContent = perfil;
    const cartao = document.getElementById('form-login');
    cartao.dataset.tom = perfil;
    document.getElementById('role-chip-icone').className = `fas ${cfg.icone}`;
    document.getElementById('palco-faixa').textContent = cfg.faixa;
    document.getElementById('palco-andamento').innerHTML = `${cfg.andamento[0]} · <b class="num">${cfg.andamento[1]}</b> bpm`;
    email.placeholder = cfg.placeholder;
    demoBotoes.forEach((b) => { b.hidden = b.dataset.perfil !== perfil; });
    rolePontos.innerHTML = cfg.pontos
        .map(([ico, txt], i) => `<li style="animation-delay:${i * 70}ms"><i class="fas ${ico}"></i>${txt}</li>`)
        .join('');
    if (!animar) { heroSub.textContent = cfg.sub; return; }
    heroSub.classList.add('is-fading');
    setTimeout(() => { heroSub.textContent = cfg.sub; heroSub.classList.remove('is-fading'); }, 200);
}

switcher.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-perfil]');
    if (b) escolherPerfil(b);
});
// Trilhas: música no ritmo de cada motivo ao passar o mouse
const palco = document.querySelector('.login-palco');
ligarTrilhas([
    ...[...document.querySelectorAll('.portal-card')].map((card) => ({
        host: card.querySelector('.portal-media'),
        trilha: () => (card.classList.contains('is-professor') ? 'Professor' : card.classList.contains('is-aluno') ? 'Aluno' : 'ADM'),
    })),
    { host: palco, trilha: () => document.getElementById('form-login').dataset.tom || 'ADM' },
]);
switcher.addEventListener('click', () => setTimeout(() => palco?._trocarTrilha?.(), 0));

// Cartões "Cada perfil com o seu palco": já escolhem o perfil e levam ao login
document.querySelectorAll('.portal-cta[data-entrar]').forEach((cta) => cta.addEventListener('click', () => {
    const alvo = switcher.querySelector(`button[data-perfil="${cta.dataset.entrar}"]`);
    if (alvo) escolherPerfil(alvo);
    (document.querySelector('.login-card') || email).scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => email.focus({ preventScroll: true }), reduzMovimento ? 0 : 600);
}));
switcher.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const bs = [...switcher.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement);
    const prox = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
    prox.focus();
    escolherPerfil(prox);
});
glider.style.transition = 'none';
escolherPerfil(switcher.querySelector('button.is-active'), false);
void glider.offsetWidth;
glider.style.transition = '';
addEventListener('resize', () => moverGlider(switcher.querySelector('button.is-active')));
document.fonts?.ready.then(() => moverGlider(switcher.querySelector('button.is-active')));

// Parallax das camadas (mouse) — câmera com profundidade
if (!reduzMovimento && matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            document.body.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
            document.body.style.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
        });
    });
}

// Navbar: aba ativa conforme a seção visível
const links = [...document.querySelectorAll('.topnav-links a')];
const io = new IntersectionObserver((entradas) => {
    entradas.filter((en) => en.isIntersecting).forEach((en) => {
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`));
    });
}, { rootMargin: '-45% 0px -45% 0px' });
['estudio', 'turmas', 'grade', 'quero-dancar'].forEach((id) => io.observe(document.getElementById(id)));

// ======================================================================
// Vitrine pública: números, turmas, grade da semana e professores
// ======================================================================
const DIAS_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const NIVEL = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado', TODOS_OS_NIVEIS: 'Todos os níveis' };
const DESTAQUE_CLS = { 'Mais procurada': 'hot', 'Últimas vagas': 'warn', Lotada: 'off', 'Ideal para começar': 'calm' };
const iniciais = (n = '') => n.replace(/^(Prof(a)?\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const diasTexto = (dias) => (dias || []).map((d) => DIAS_CURTO[d - 1]).join(' · ');

let vitrine = null;

function contar(el, alvo, sufixo = '') {
    if (reduzMovimento) { el.textContent = `${alvo.toLocaleString('pt-BR')}${sufixo}`; return; }
    const ini = performance.now();
    const dur = 1100;
    const passo = (t) => {
        const p = Math.min(1, (t - ini) / dur);
        const v = alvo * (1 - (1 - p) ** 3);
        el.textContent = `${(Number.isInteger(alvo) ? Math.round(v) : Number(v.toFixed(1))).toLocaleString('pt-BR', Number.isInteger(alvo) ? {} : { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${sufixo}`;
        if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
}

function cardTurma(t) {
    const pct = t.limite ? Math.round((t.ocupadas / t.limite) * 100) : 0;
    const vagasTxt = t.vagas === 0 ? 'Turma lotada' : `${t.vagas} vaga${t.vagas > 1 ? 's' : ''} disponíve${t.vagas > 1 ? 'is' : 'l'}`;
    return `<button type="button" class="class-card ${t.vagas === 0 ? 'is-full' : ''}" data-turma="${t.id}" aria-label="${esc(t.nome)}: ver detalhes">
        <div class="cc-top">
            <span class="cc-icon"><i class="fas ${esc(t.icone)}"></i></span>
            ${t.destaque ? `<span class="cc-tag ${DESTAQUE_CLS[t.destaque] || ''}">${t.destaque === 'Mais procurada' ? '<i class="fas fa-fire"></i> ' : ''}${esc(t.destaque)}</span>` : ''}
        </div>
        <span class="cc-mod">${esc(t.modalidade || 'Dança')}</span>
        <h3>${esc(t.nome)}</h3>
        <ul class="cc-info">
            <li><i class="fas fa-signal"></i>${esc(NIVEL[t.nivel] || t.nivel || '—')}</li>
            <li><i class="fas fa-person-chalkboard"></i>${esc(t.professorNome)}</li>
            <li><i class="fas fa-calendar-days"></i>${esc(diasTexto(t.dias))} · <span class="num">${esc(t.inicio)}–${esc(t.fim)}</span></li>
        </ul>
        <div class="cc-vagas"><div class="cc-meter"><span style="width:${pct}%"></span></div><small class="${t.vagas <= 3 ? 'warn' : ''}">${vagasTxt}</small></div>
        <span class="cc-more">Ver detalhes <i class="fas fa-arrow-right"></i></span>
    </button>`;
}

function renderTurmas(nivel = '') {
    const alvo = document.getElementById('lista-turmas');
    const lista = vitrine.turmas.filter((t) => !nivel || t.nivel === nivel || t.nivel === 'TODOS_OS_NIVEIS');
    alvo.innerHTML = lista.length ? lista.map(cardTurma).join('')
        : `<div class="vitrine-vazia"><i class="fas fa-music"></i><p>Nenhuma turma ${nivel ? `de nível ${esc(NIVEL[nivel].toLowerCase())}` : ''} aberta no momento.</p></div>`;
    const n = vitrine.turmas.length;
    document.getElementById('turmas-contagem').textContent = `${n} turma${n === 1 ? '' : 's'} com inscrições abertas · atualizado ao vivo`;
}

function renderSemana(dia) {
    document.querySelectorAll('#dias button').forEach((b) => {
        const ativo = Number(b.dataset.dia) === dia;
        b.classList.toggle('is-active', ativo);
        b.setAttribute('aria-selected', String(ativo));
    });
    const aulas = vitrine.turmas.filter((t) => (t.dias || []).includes(dia)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    document.getElementById('aulas-dia').innerHTML = aulas.length ? aulas.map((t) => `
        <button type="button" class="slot" data-turma="${t.id}">
            <span class="slot-time num">${esc(t.inicio)}<small>${esc(t.fim)}</small></span>
            <span class="slot-body"><strong>${esc(t.nome)}</strong><small>${esc(t.modalidade || '')} · ${esc(t.professorNome)}${t.salaNome ? ` · ${esc(t.salaNome)}` : ''}</small></span>
            <span class="slot-vagas ${t.vagas === 0 ? 'off' : t.vagas <= 3 ? 'warn' : ''}">${t.vagas === 0 ? 'Lotada' : `${t.vagas} vaga${t.vagas > 1 ? 's' : ''}`}</span>
        </button>`).join('')
        : `<div class="vitrine-vazia"><i class="fas fa-mug-hot"></i><p>${DIAS_LONGO[dia - 1]} é dia de descanso no estúdio.</p></div>`;
}

function renderProfessores() {
    const alvo = document.getElementById('lista-professores');
    alvo.innerHTML = vitrine.professores.length ? vitrine.professores.map((p) => `
        <article class="teacher">
            ${p.avatarUrl
                ? `<span class="teacher-avatar has-photo" style="background-image:url('${esc(urlArquivo(p.avatarUrl))}')" aria-hidden="true"></span>`
                : `<span class="teacher-avatar" aria-hidden="true">${esc(iniciais(p.nome))}</span>`}
            <div>
                <h3>${esc(p.nome)}</h3>
                <p>${esc(p.modalidades.join(' · ') || 'Professor(a) do estúdio')}</p>
                <small class="${p.turmas ? '' : 'soon'}">${p.turmas ? `${p.turmas} turma${p.turmas > 1 ? 's' : ''} na grade` : 'Novas turmas em breve'}</small>
            </div>
        </article>`).join('')
        : '<div class="vitrine-vazia"><i class="fas fa-user"></i><p>Equipe em formação.</p></div>';
}

function irParaLoginAluno() {
    const btnAluno = switcher.querySelector('[data-perfil="Aluno"]');
    escolherPerfil(btnAluno);
    document.getElementById('portal').scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => email.focus({ preventScroll: true }), 450);
}

function abrirTurma(id) {
    const t = vitrine.turmas.find((x) => x.id === id);
    if (!t) return;
    const pct = t.limite ? Math.round((t.ocupadas / t.limite) * 100) : 0;
    const d = drawer({
        titulo: t.nome,
        subtitulo: `${t.modalidade || 'Dança'} · ${NIVEL[t.nivel] || t.nivel}`,
        acoes: `<button class="btn btn-ghost" data-d="fechar">Voltar</button><button class="btn btn-primary" data-d="matricular" ${t.vagas === 0 ? 'disabled' : ''}><i class="fas fa-shoe-prints"></i> ${t.vagas === 0 ? 'Turma lotada' : 'Quero dançar nesta turma'}</button>`,
        render: (body) => {
            body.innerHTML = `
                <div class="td-hero"><span class="cc-icon lg"><i class="fas ${esc(t.icone)}"></i></span>${t.destaque ? `<span class="cc-tag ${DESTAQUE_CLS[t.destaque] || ''}">${esc(t.destaque)}</span>` : ''}</div>
                <dl class="kv">
                    <dt>Professor(a)</dt><dd>${esc(t.professorNome)}</dd>
                    <dt>Dias</dt><dd>${esc((t.dias || []).map((x) => DIAS_LONGO[x - 1]).join(', '))}</dd>
                    <dt>Horário</dt><dd class="num">${esc(t.inicio)} às ${esc(t.fim)}</dd>
                    <dt>Sala</dt><dd>${esc(t.salaNome || '—')}</dd>
                    <dt>Nível</dt><dd>${esc(NIVEL[t.nivel] || t.nivel)}</dd>
                </dl>
                <section><h4 class="drawer-sec">Ocupação</h4><div class="cc-meter lg"><span style="width:${pct}%"></span></div><p class="faint num" style="margin-top:8px">${t.ocupadas} de ${t.limite} lugares ocupados · ${t.vagas === 0 ? 'sem vagas no momento' : `${t.vagas} disponíve${t.vagas > 1 ? 'is' : 'l'}`}</p></section>
                <div class="callout"><i class="fas fa-circle-info"></i><span>Ainda não é aluno(a)? Toque em <strong>Quero dançar nesta turma</strong> e faça seu pedido. Já tem conta? Matricule-se no Portal do Aluno, em <strong>Explorar turmas</strong>.</span></div>`;
        },
    });
    d.foot.onclick = (e) => {
        const b = e.target.closest('[data-d]');
        if (!b) return;
        d.fechar();
        if (b.dataset.d === 'matricular') queroDancar.escolherTurma(t);
    };
}

// ------------------------------------------------------------------ estado e atualização ao vivo
const HOJE = ((new Date().getDay() + 6) % 7) + 1;
const estadoVitrine = { nivel: '', dia: null, assinatura: '', numerosAnimados: false };

async function buscarVitrine() {
    const r = await fetch(`${API_BASE}/api/publico/vitrine`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
}

function pintarNumeros(animar) {
    const m = vitrine.metricas;
    const numeros = { alunos: m.alunos, turmas: m.turmas, modalidades: m.modalidades, ocupacao: m.ocupacao };
    document.querySelectorAll('[data-stat]').forEach((el) => {
        const alvo = Number(numeros[el.dataset.stat] || 0);
        if (animar) contar(el, alvo, el.dataset.sufixo || '');
        else el.textContent = `${alvo.toLocaleString('pt-BR', Number.isInteger(alvo) ? {} : { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${el.dataset.sufixo || ''}`;
    });
}

function pintarDias() {
    document.getElementById('dias').innerHTML = DIAS_CURTO.map((d, i) => {
        const n = vitrine.turmas.filter((t) => (t.dias || []).includes(i + 1)).length;
        return `<button type="button" role="tab" data-dia="${i + 1}" aria-selected="false">${d}<small>${n ? `${n} aula${n > 1 ? 's' : ''}` : '—'}</small>${i + 1 === HOJE ? '<i class="today" aria-label="hoje"></i>' : ''}</button>`;
    }).join('');
}

/** Aplica uma vitrine (primeira carga ou atualização) preservando filtro de nível e dia escolhido. */
function aplicarVitrine(nova, primeira) {
    vitrine = nova;
    document.getElementById('numeros').hidden = false;
    document.getElementById('dias').hidden = false;
    if (estadoVitrine.numerosAnimados || !primeira) pintarNumeros(false);
    renderTurmas(estadoVitrine.nivel);
    pintarDias();
    if (estadoVitrine.dia === null) {
        // Abre no dia de hoje (ou no próximo dia com aula)
        const comAula = (d) => vitrine.turmas.some((t) => (t.dias || []).includes(d));
        let inicial = HOJE;
        for (let i = 0; i < 7 && !comAula(inicial); i++) inicial = (inicial % 7) + 1;
        estadoVitrine.dia = inicial;
    }
    renderSemana(estadoVitrine.dia);
    renderProfessores();
    queroDancar.atualizar();
}

async function atualizarVitrine(primeira = false) {
    let nova;
    try {
        nova = await buscarVitrine();
    } catch {
        if (primeira) {
            document.getElementById('numeros').hidden = true;
            ['lista-turmas', 'aulas-dia', 'lista-professores'].forEach((id) => {
                document.getElementById(id).innerHTML = '<div class="vitrine-vazia"><i class="fas fa-plug-circle-xmark"></i><p>Não foi possível carregar a grade agora. Entre no portal para ver as turmas.</p></div>';
            });
            document.getElementById('dias').hidden = true;
        }
        return; // em atualizações, mantém o que já está na tela
    }
    const assinatura = JSON.stringify(nova);
    if (assinatura === estadoVitrine.assinatura) return; // nada mudou: não redesenha
    estadoVitrine.assinatura = assinatura;
    aplicarVitrine(nova, primeira);
}

// Interações (registradas uma única vez; funcionam com qualquer versão da vitrine)
document.getElementById('filtro-nivel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nivel]');
    if (!b || !vitrine) return;
    document.querySelectorAll('#filtro-nivel button').forEach((x) => x.classList.toggle('is-active', x === b));
    estadoVitrine.nivel = b.dataset.nivel;
    renderTurmas(estadoVitrine.nivel);
});
document.getElementById('dias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dia]');
    if (!b || !vitrine) return;
    estadoVitrine.dia = Number(b.dataset.dia);
    renderSemana(estadoVitrine.dia);
});
document.querySelector('.landing').addEventListener('click', (e) => {
    const c = e.target.closest('[data-turma]');
    if (c && vitrine) abrirTurma(Number(c.dataset.turma));
});

// Números animam uma vez, quando entram na tela
const ioNum = new IntersectionObserver((en) => {
    if (!en.some((x) => x.isIntersecting) || !vitrine) return;
    ioNum.disconnect();
    estadoVitrine.numerosAnimados = true;
    pintarNumeros(true);
}, { threshold: 0.4 });
ioNum.observe(document.getElementById('numeros'));

const queroDancar = iniciarQueroDancar({
    obterVitrine: () => vitrine,
    reduzMovimento,
    irParaLogin: (emailInstitucional) => {
        irParaLoginAluno();
        email.value = emailInstitucional;
        email.dispatchEvent(new Event('input'));
        setTimeout(() => senha.focus({ preventScroll: true }), 480);
    },
});
atualizarVitrine(true);
// Turmas e professores cadastrados no sistema aparecem sozinhos: consulta a cada 20 s e ao voltar à aba
setInterval(() => { if (document.visibilityState === 'visible') atualizarVitrine(); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') atualizarVitrine(); });
document.querySelector('a[href="#portal"]').addEventListener('click', () => setTimeout(() => email.focus({ preventScroll: true }), 500));

function mostrar(caixa, msg) {
    caixa.hidden = !msg;
    caixa.querySelector('span').textContent = msg || '';
}

// Validação de domínio em tempo real (camada front; o back-end revalida)
email.addEventListener('input', () => {
    const v = email.value.trim();
    email.classList.remove('is-invalid');
    if (!v.includes('@')) {
        hint.className = 'hint';
        hint.textContent = 'Somente endereços @vibedance.com têm acesso.';
        return;
    }
    const ok = DOMINIO_REGEX.test(v);
    hint.className = `hint ${ok ? 'is-ok' : 'is-bad'}`;
    hint.textContent = ok ? 'Domínio institucional reconhecido.' : 'Este domínio não tem acesso ao VibeDance.';
});

document.getElementById('ver-senha').addEventListener('click', (e) => {
    const visivel = senha.type === 'text';
    senha.type = visivel ? 'password' : 'text';
    e.currentTarget.innerHTML = `<i class="fas ${visivel ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
    e.currentTarget.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
});

document.getElementById('demo-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-email]');
    if (!b) return;
    email.value = b.dataset.email;
    senha.value = b.dataset.senha;
    email.dispatchEvent(new Event('input'));
    form.requestSubmit();
});

function falhar(msg, campo) {
    mostrar(caixaErro, msg);
    campo?.classList.add('is-invalid');
    campo?.focus();
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrar(caixaErro, null);
    mostrar(caixaAviso, null);
    const valorEmail = email.value.trim().toLowerCase();

    if (!valorEmail) return falhar('Informe seu e-mail institucional.', email);
    if (!DOMINIO_REGEX.test(valorEmail)) return falhar(MSG_DOMINIO, email);
    if (!senha.value) return falhar('Informe sua senha.', senha);

    botao.classList.add('is-loading');
    botao.textContent = 'Entrando';
    try {
        const r = await api.post('/api/auth/login', { email: valorEmail, senha: senha.value }, { silencioso: true });
        if (!DOMINIO_REGEX.test(r.email || '')) throw new Error(MSG_DOMINIO);
        Session.salvar(r, document.getElementById('lembrar').checked);
        location.replace(PORTAIS[r.perfil] || 'index.html');
    } catch (err) {
        falhar(err.message || 'Não foi possível entrar.', err.codigo === 'DOMINIO_NAO_AUTORIZADO' ? email : senha);
    } finally {
        botao.classList.remove('is-loading');
        botao.textContent = 'Entrar';
    }
    return undefined;
});
