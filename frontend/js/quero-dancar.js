/**
 * "Quero dançar" — pedido de acesso em quatro tempos (você, seu ritmo, sua rotina e revisão),
 * acompanhamento por protocolo e ativação do acesso depois que o estúdio aprova.
 */
import { api } from './core/api.js';
import { esc } from './core/ui.js';

const NIVEL = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado', TODOS_OS_NIVEIS: 'Todos os níveis' };
const DIAS = [['SEG', 'Seg'], ['TER', 'Ter'], ['QUA', 'Qua'], ['QUI', 'Qui'], ['SEX', 'Sex'], ['SAB', 'Sáb'], ['DOM', 'Dom']];
const PERIODOS = [['MANHA', 'Manhã', 'fa-sun'], ['TARDE', 'Tarde', 'fa-cloud-sun'], ['NOITE', 'Noite', 'fa-moon']];
const EXPERIENCIAS = [
    ['NUNCA', 'Nunca dancei', 'Quero dar o primeiro passo.', 'fa-seedling'],
    ['POUCA', 'Já fiz algumas aulas', 'Conheço o básico, quero evoluir.', 'fa-shoe-prints'],
    ['REGULAR', 'Danço com frequência', 'Tenho técnica e repertório.', 'fa-person-running'],
    ['PROFISSIONAL', 'Danço profissionalmente', 'Palco, competições ou companhia.', 'fa-star'],
];
const OBJETIVOS = [['HOBBY', 'Diversão'], ['SAUDE', 'Saúde e bem-estar'], ['SOCIAL', 'Fazer amigos'], ['PALCO', 'Subir ao palco'], ['COMPETICAO', 'Competir'], ['OUTRO', 'Outro']];
const ORIGENS = ['Instagram', 'TikTok', 'Indicação de amigo', 'Google', 'Passei em frente', 'Evento ou apresentação', 'Outro'];
const TEMPOS = [
    ['Você', 'Quem vai dançar'],
    ['Seu ritmo', 'Estilos e turmas'],
    ['Sua rotina', 'Dias e objetivos'],
    ['Revisão', 'Confira e envie'],
];
const STATUS_PUBLICO = { NOVA: ['Recebido', 'info'], EM_CONTATO: ['Em contato', 'warn'], APROVADA: ['Aprovado', 'ok'], RECUSADA: ['Não aprovado', 'danger'] };

const so = (v) => (v || '').replace(/\D/g, '');
function mascaraCpf(v) {
    const d = so(v).slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
function mascaraTel(v) {
    const d = so(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function cpfOk(v) {
    const d = so(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let pos = 9; pos <= 10; pos++) {
        let soma = 0;
        for (let i = 0; i < pos; i++) soma += Number(d[i]) * (pos + 1 - i);
        if (((soma * 10) % 11) % 10 !== Number(d[pos])) return false;
    }
    return true;
}
const emailOk = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test((v || '').trim());
const diasTexto = (dias) => (dias || []).map((d) => DIAS[d - 1]?.[1]).join(' · ');

export function iniciarQueroDancar({ obterVitrine, irParaLogin, reduzMovimento }) {
    const raiz = document.getElementById('quero-dancar');
    if (!raiz) return { escolherTurma() {} };
    const form = raiz.querySelector('#qd-form');
    const passos = [...form.querySelectorAll('.qd-step')];
    const tempos = [...raiz.querySelectorAll('.qd-tempo')];
    const barra = [...raiz.querySelectorAll('.qd-beat')];
    const erro = raiz.querySelector('#qd-erro');
    const btnVoltar = raiz.querySelector('#qd-voltar');
    const btnAvancar = raiz.querySelector('#qd-avancar');
    const cartao = raiz.querySelector('.qd-card');
    const sel = { modalidades: new Set(), turmas: new Set(), dias: new Set(), periodos: new Set(), experiencia: '', objetivo: '' };
    let passo = 0;

    // ------------------------------------------------------------ campos estáticos
    raiz.querySelector('#qd-exp').innerHTML = EXPERIENCIAS.map(([v, t, s, i]) => `
        <button type="button" class="qd-option" data-exp="${v}" aria-pressed="false"><i class="fas ${i}"></i><span><strong>${t}</strong><small>${s}</small></span></button>`).join('');
    raiz.querySelector('#qd-dias').innerHTML = DIAS.map(([v, t]) => `<button type="button" class="qd-chip" data-dia="${v}" aria-pressed="false">${t}</button>`).join('');
    raiz.querySelector('#qd-periodos').innerHTML = PERIODOS.map(([v, t, i]) => `<button type="button" class="qd-chip" data-periodo="${v}" aria-pressed="false"><i class="fas ${i}"></i> ${t}</button>`).join('');
    raiz.querySelector('#qd-objetivos').innerHTML = OBJETIVOS.map(([v, t]) => `<button type="button" class="qd-chip" data-obj="${v}" aria-pressed="false">${t}</button>`).join('');
    form.origem.innerHTML = `<option value="">Selecione…</option>${ORIGENS.map((o) => `<option>${o}</option>`).join('')}`;
    form.nascimento.max = new Date().toISOString().slice(0, 10);

    form.cpf.addEventListener('input', () => { form.cpf.value = mascaraCpf(form.cpf.value); });
    form.telefone.addEventListener('input', () => { form.telefone.value = mascaraTel(form.telefone.value); });
    form.mensagem.addEventListener('input', () => { raiz.querySelector('#qd-cont').textContent = form.mensagem.value.length; });

    // ------------------------------------------------------------ estilos e turmas (da vitrine ao vivo)
    function modalidades() {
        const v = obterVitrine();
        const mapa = new Map();
        (v?.turmas || []).forEach((t) => { if (t.modalidade && !mapa.has(t.modalidade)) mapa.set(t.modalidade, t.icone || 'fa-music'); });
        return [...mapa.entries()];
    }
    function pintarModalidades() {
        const lista = modalidades();
        raiz.querySelector('#qd-modalidades').innerHTML = lista.length ? lista.map(([m, i]) => `
            <button type="button" class="qd-chip lg" data-mod="${esc(m)}" aria-pressed="${sel.modalidades.has(m)}"><i class="fas ${esc(i)}"></i> ${esc(m)}</button>`).join('')
            : '<p class="faint">As modalidades aparecem aqui assim que a grade carregar.</p>';
    }
    function pintarTurmas() {
        const v = obterVitrine();
        const filtro = sel.modalidades;
        const turmas = (v?.turmas || []).filter((t) => !filtro.size || filtro.has(t.modalidade) || sel.turmas.has(t.id));
        raiz.querySelector('#qd-turmas').innerHTML = turmas.length ? turmas.map((t) => {
            const on = sel.turmas.has(t.id);
            const cheia = t.vagas === 0;
            return `<button type="button" class="qd-turma ${on ? 'is-on' : ''}" data-turma-qd="${t.id}" aria-pressed="${on}" ${cheia && !on ? 'disabled' : ''}>
                <span class="qd-turma-ico"><i class="fas ${esc(t.icone || 'fa-music')}"></i></span>
                <span class="qd-turma-txt"><strong>${esc(t.nome)}</strong><small>${esc(diasTexto(t.dias))} · <span class="num">${esc(t.inicio)}</span> · ${esc(NIVEL[t.nivel] || t.nivel || '')}</small></span>
                <span class="qd-turma-vagas ${cheia ? 'off' : t.vagas <= 3 ? 'warn' : ''}">${cheia ? 'Lotada' : `${t.vagas} vaga${t.vagas > 1 ? 's' : ''}`}</span>
                <i class="fas fa-check qd-turma-check" aria-hidden="true"></i>
            </button>`;
        }).join('') : '<p class="faint">Nenhuma turma aberta para os estilos escolhidos. Pode enviar mesmo assim: a recepção sugere um horário.</p>';
        raiz.querySelector('#qd-turmas-cont').textContent = `${sel.turmas.size}/3`;
    }

    function alternar(set, valor, btn, max) {
        if (set.has(valor)) set.delete(valor);
        else if (!max || set.size < max) set.add(valor);
        btn?.setAttribute('aria-pressed', String(set.has(valor)));
    }

    form.addEventListener('click', (e) => {
        const b = e.target.closest('button[type="button"]');
        if (!b || !form.contains(b)) return;
        if (b.dataset.mod) { alternar(sel.modalidades, b.dataset.mod, b); pintarTurmas(); }
        else if (b.dataset.turmaQd) {
            const id = Number(b.dataset.turmaQd);
            if (!sel.turmas.has(id) && sel.turmas.size >= 3) { mostrarErro('Escolha até 3 turmas de interesse.'); return; }
            alternar(sel.turmas, id);
            pintarTurmas();
        } else if (b.dataset.exp) {
            sel.experiencia = b.dataset.exp;
            form.querySelectorAll('[data-exp]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        } else if (b.dataset.dia) alternar(sel.dias, b.dataset.dia, b);
        else if (b.dataset.periodo) alternar(sel.periodos, b.dataset.periodo, b);
        else if (b.dataset.obj) {
            sel.objetivo = sel.objetivo === b.dataset.obj ? '' : b.dataset.obj;
            form.querySelectorAll('[data-obj]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.obj === sel.objetivo)));
        }
        mostrarErro(null);
    });

    // ------------------------------------------------------------ navegação entre os tempos
    function mostrarErro(msg) {
        erro.hidden = !msg;
        erro.querySelector('span').textContent = msg || '';
    }

    function validar(i) {
        if (i === 0) {
            const nome = form.nome.value.trim();
            if (nome.length < 5 || !nome.includes(' ')) return [form.nome, 'Informe seu nome completo.'];
            if (!emailOk(form.email.value)) return [form.email, 'Informe um e-mail válido. É por ele que você acompanha o pedido.'];
            if (so(form.telefone.value).length < 10) return [form.telefone, 'Informe um telefone com DDD.'];
            if (!cpfOk(form.cpf.value)) return [form.cpf, 'CPF inválido. Confira os números.'];
        }
        if (i === 1) {
            if (!sel.modalidades.size && !sel.turmas.size) return [null, 'Escolha ao menos um estilo ou uma turma.'];
            if (!sel.experiencia) return [null, 'Conte qual é a sua experiência com dança.'];
        }
        if (i === 2 && !sel.dias.size && !sel.periodos.size) return [null, 'Marque os dias ou períodos em que você pode dançar.'];
        return null;
    }

    function irPara(i, focar = true) {
        passo = i;
        passos.forEach((p, k) => { p.hidden = k !== i; });
        tempos.forEach((t, k) => { t.classList.toggle('is-on', k === i); t.classList.toggle('is-done', k < i); });
        barra.forEach((b, k) => b.classList.toggle('is-on', k <= i));
        btnVoltar.hidden = i === 0;
        btnAvancar.innerHTML = i === passos.length - 1 ? '<i class="fas fa-paper-plane"></i> Enviar pedido' : 'Continuar <i class="fas fa-arrow-right"></i>';
        raiz.querySelector('#qd-passo').textContent = `Tempo ${i + 1} de ${passos.length}`;
        if (i === passos.length - 1) pintarRevisao();
        mostrarErro(null);
        if (focar) passos[i].querySelector('input:not([type=hidden]), button, select, textarea')?.focus({ preventScroll: true });
    }

    function pintarRevisao() {
        const v = obterVitrine();
        const turmas = (v?.turmas || []).filter((t) => sel.turmas.has(t.id));
        const exp = EXPERIENCIAS.find(([k]) => k === sel.experiencia)?.[1] || '—';
        const disp = [...DIAS.filter(([k]) => sel.dias.has(k)).map(([, t]) => t), ...PERIODOS.filter(([k]) => sel.periodos.has(k)).map(([, t]) => t)];
        raiz.querySelector('#qd-revisao').innerHTML = `
            <dl class="qd-review">
                <div><dt>Nome</dt><dd>${esc(form.nome.value.trim())}</dd></div>
                <div><dt>Contato</dt><dd>${esc(form.email.value.trim())}<br><span class="num">${esc(form.telefone.value)}</span></dd></div>
                <div><dt>Estilos</dt><dd>${esc([...sel.modalidades].join(', ') || '—')}</dd></div>
                <div><dt>Experiência</dt><dd>${esc(exp)}</dd></div>
                <div class="wide"><dt>Turmas de interesse</dt><dd>${turmas.length ? turmas.map((t) => `${esc(t.nome)} <span class="faint">· ${esc(diasTexto(t.dias))} ${esc(t.inicio)}</span>`).join('<br>') : '<span class="faint">A recepção sugere a melhor turma para você.</span>'}</dd></div>
                <div class="wide"><dt>Disponibilidade</dt><dd>${esc(disp.join(' · ') || '—')}</dd></div>
            </dl>`;
    }

    btnVoltar.addEventListener('click', () => irPara(Math.max(0, passo - 1)));
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const falha = validar(passo);
        if (falha) {
            mostrarErro(falha[1]);
            falha[0]?.focus();
            return;
        }
        if (passo < passos.length - 1) { irPara(passo + 1); return; }
        if (!form.consentimento.checked) { mostrarErro('Autorize o contato para enviar o pedido.'); return; }
        btnAvancar.classList.add('is-loading');
        btnAvancar.disabled = true;
        try {
            const r = await api.post('/api/publico/acesso/pedidos', {
                nome: form.nome.value.trim(),
                email: form.email.value.trim(),
                telefone: form.telefone.value.trim(),
                cpf: form.cpf.value,
                dataNascimento: form.nascimento.value || null,
                modalidades: [...sel.modalidades],
                experiencia: sel.experiencia,
                turmas: [...sel.turmas],
                disponibilidade: [...sel.dias, ...sel.periodos],
                objetivo: sel.objetivo || null,
                mensagem: form.mensagem.value.trim() || null,
                origem: form.origem.value || null,
                consentimento: true,
                site: form.site.value,
            }, { silencioso: true });
            mostrarIngresso(r, form.email.value.trim());
        } catch (err) {
            mostrarErro(err.message || 'Não foi possível enviar agora. Tente de novo em instantes.');
        } finally {
            btnAvancar.classList.remove('is-loading');
            btnAvancar.disabled = false;
        }
    });

    // ------------------------------------------------------------ ingresso (protocolo)
    const ingresso = raiz.querySelector('#qd-ingresso');
    function mostrarIngresso(r, email) {
        form.hidden = true;
        ingresso.hidden = false;
        ingresso.innerHTML = `
            <div class="ticket" role="status">
                <div class="ticket-main">
                    <span class="ticket-kicker">Pedido recebido</span>
                    <h3>Até breve no estúdio, <em>${esc(r.primeiroNome)}</em>.</h3>
                    <p>A recepção vai falar com você pelo telefone ou e-mail informados. Guarde o seu protocolo para acompanhar o pedido e, quando aprovado, ativar seu acesso.</p>
                </div>
                <div class="ticket-stub">
                    <span>Protocolo</span>
                    <strong class="num" id="qd-protocolo">${esc(r.protocolo)}</strong>
                    <button type="button" class="btn btn-sm" data-copiar><i class="fas fa-copy"></i> Copiar</button>
                </div>
            </div>
            <div class="row wrap qd-ingresso-acoes">
                <button type="button" class="btn btn-primary" data-acompanhar><i class="fas fa-route"></i> Acompanhar meu pedido</button>
                <button type="button" class="btn btn-ghost" data-novo>Enviar outro pedido</button>
            </div>`;
        ingresso.querySelector('[data-copiar]').onclick = async (ev) => {
            try { await navigator.clipboard.writeText(r.protocolo); ev.currentTarget.innerHTML = '<i class="fas fa-check"></i> Copiado'; } catch { /* seleção manual */ }
        };
        ingresso.querySelector('[data-acompanhar]').onclick = () => abrirAcompanhamento(r.protocolo, email, true);
        ingresso.querySelector('[data-novo]').onclick = () => {
            form.reset();
            Object.values(sel).forEach((s) => s instanceof Set && s.clear());
            sel.experiencia = ''; sel.objetivo = '';
            form.querySelectorAll('[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
            ingresso.hidden = true;
            form.hidden = false;
            pintarModalidades(); pintarTurmas(); irPara(0);
        };
        cartao.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'center' });
    }

    // ------------------------------------------------------------ acompanhamento e ativação
    const painel = raiz.querySelector('#qd-acompanhar');
    const formConsulta = painel.querySelector('#qd-consulta');
    const resultado = painel.querySelector('#qd-resultado');

    raiz.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => trocarModo(b.dataset.modo)));
    function trocarModo(modo) {
        raiz.querySelectorAll('[data-modo]').forEach((b) => {
            const on = b.dataset.modo === modo;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', String(on));
        });
        cartao.hidden = modo !== 'pedido';
        painel.hidden = modo !== 'acompanhar';
        raiz.querySelector('.qd-tempos').hidden = modo !== 'pedido';
    }

    async function abrirAcompanhamento(protocolo, email, consultar) {
        trocarModo('acompanhar');
        if (protocolo) formConsulta.protocolo.value = protocolo;
        if (email) formConsulta.email.value = email;
        raiz.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'start' });
        if (consultar && formConsulta.protocolo.value && formConsulta.email.value) await consultarPedido();
        else (formConsulta.protocolo.value ? formConsulta.email : formConsulta.protocolo).focus({ preventScroll: true });
    }

    async function consultarPedido() {
        const botao = formConsulta.querySelector('button[type=submit]');
        botao.classList.add('is-loading');
        try {
            const p = await api.post('/api/publico/acesso/consulta', {
                protocolo: formConsulta.protocolo.value.trim(), email: formConsulta.email.value.trim(),
            }, { silencioso: true });
            pintarResultado(p);
        } catch (err) {
            resultado.innerHTML = `<div class="callout danger"><i class="fas fa-circle-exclamation"></i><span>${esc(err.status === 404 || err.codigo === 'NAO_ENCONTRADO'
                ? 'Não encontramos um pedido com este protocolo e e-mail. Confira os dados.' : err.message || 'Não foi possível consultar agora.')}</span></div>`;
        } finally {
            botao.classList.remove('is-loading');
        }
    }
    formConsulta.addEventListener('submit', (e) => { e.preventDefault(); consultarPedido(); });

    function pintarResultado(p) {
        const [rot, cls] = STATUS_PUBLICO[p.status] || [p.status, ''];
        const data = (v) => (v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '');
        resultado.innerHTML = `
            <div class="qd-status">
                <div><span class="ticket-kicker">Protocolo <span class="num">${esc(p.protocolo)}</span></span><h3>Olá, ${esc(p.primeiroNome)}</h3></div>
                <span class="badge ${cls}">${esc(rot)}</span>
            </div>
            <ol class="qd-timeline">${p.etapas.map((et) => `
                <li class="is-${et.estado}">
                    <span class="qd-tl-dot">${et.estado === 'feito' ? '<i class="fas fa-check"></i>' : et.estado === 'recusado' ? '<i class="fas fa-xmark"></i>' : ''}</span>
                    <div><strong>${esc(et.titulo)}</strong>${et.em ? ` <small class="faint num">${esc(data(et.em))}</small>` : ''}<p>${esc(et.descricao)}</p></div>
                </li>`).join('')}</ol>
            ${p.turmasInteresse.length ? `<p class="faint qd-interesse"><i class="fas fa-music"></i> Interesse: ${esc(p.turmasInteresse.join(', '))}</p>` : ''}
            ${p.resposta ? `<div class="qd-recado ${p.status === 'RECUSADA' ? 'is-neg' : ''}"><i class="fas fa-quote-left"></i><span><strong>Mensagem do estúdio</strong>${esc(p.resposta)}</span></div>` : ''}
            ${p.conviteExpirado ? '<div class="callout warn"><i class="fas fa-hourglass-end"></i><span>O prazo para ativar o acesso terminou. Peça à recepção para renovar o convite.</span></div>' : ''}
            ${p.podeAtivar ? `
                <form class="qd-ativar" id="qd-ativar" novalidate>
                    <div class="qd-login-box"><span>Seu login</span><strong>${esc(p.emailInstitucional)}</strong></div>
                    <div class="field">
                        <label for="qd-senha">Crie sua senha</label>
                        <div class="input-icon"><i class="fas fa-lock"></i><input class="input" id="qd-senha" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>
                        <div class="qd-forca" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
                        <span class="hint" id="qd-forca-txt">Mínimo de 8 caracteres, com letras e números.</span>
                    </div>
                    <div class="field">
                        <label for="qd-senha2">Confirme a senha</label>
                        <div class="input-icon"><i class="fas fa-lock"></i><input class="input" id="qd-senha2" name="confirmacao" type="password" autocomplete="new-password" required></div>
                    </div>
                    <div class="callout danger" id="qd-ativar-erro" hidden><i class="fas fa-circle-exclamation"></i><span></span></div>
                    <button class="btn btn-primary btn-block" type="submit"><i class="fas fa-key"></i> Ativar meu acesso</button>
                </form>` : ''}
            ${p.ativado ? `<div class="qd-pronto"><i class="fas fa-circle-check"></i><div><strong>Acesso ativo</strong><p>Entre com <b>${esc(p.emailInstitucional)}</b> e a senha que você criou.</p></div><button type="button" class="btn btn-primary" data-entrar="${esc(p.emailInstitucional)}">Entrar agora</button></div>` : ''}`;

        const ativar = resultado.querySelector('#qd-ativar');
        if (ativar) {
            const forca = [...ativar.querySelectorAll('.qd-forca span')];
            const txt = ativar.querySelector('#qd-forca-txt');
            ativar.senha.addEventListener('input', () => {
                const s = ativar.senha.value;
                const n = [s.length >= 8, /[A-Za-z]/.test(s) && /\d/.test(s), /[A-Z]/.test(s) && /[a-z]/.test(s), /[^A-Za-z0-9]/.test(s) || s.length >= 12].filter(Boolean).length;
                forca.forEach((b, i) => { b.className = i < n ? `on n${n}` : ''; });
                txt.textContent = !s ? 'Mínimo de 8 caracteres, com letras e números.' : ['Muito fraca', 'Fraca', 'Boa', 'Forte', 'Excelente'][n];
            });
            ativar.addEventListener('submit', async (e) => {
                e.preventDefault();
                const caixa = ativar.querySelector('#qd-ativar-erro');
                const falhar = (m) => { caixa.hidden = false; caixa.querySelector('span').textContent = m; };
                const s = ativar.senha.value;
                if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) return falhar('A senha precisa ter ao menos 8 caracteres, com letras e números.');
                if (s !== ativar.confirmacao.value) return falhar('As senhas não conferem.');
                const b = ativar.querySelector('button[type=submit]');
                b.classList.add('is-loading');
                try {
                    const r = await api.post('/api/publico/acesso/ativacao', {
                        protocolo: p.protocolo, email: formConsulta.email.value.trim(), senha: s,
                    }, { silencioso: true });
                    pintarResultado(r);
                } catch (err) {
                    falhar(err.message || 'Não foi possível ativar agora.');
                } finally {
                    b.classList.remove('is-loading');
                }
                return undefined;
            });
        }
        resultado.querySelector('[data-entrar]')?.addEventListener('click', (e) => irParaLogin(e.currentTarget.dataset.entrar));
    }

    // ------------------------------------------------------------ início
    pintarModalidades();
    pintarTurmas();
    irPara(0, false);
    trocarModo('pedido');

    // Link enviado pela recepção: index.html#acompanhar=VD-XXXXXX
    const m = location.hash.match(/^#acompanhar(?:=([A-Za-z0-9-]+))?/);
    if (m) setTimeout(() => abrirAcompanhamento(m[1] ? decodeURIComponent(m[1]).toUpperCase() : '', '', false), 300);

    return {
        /** A vitrine mudou: atualiza estilos e turmas sem perder as escolhas. */
        atualizar() { pintarModalidades(); pintarTurmas(); },
        /** "Quero dançar nesta turma" no detalhe da turma. */
        escolherTurma(t) {
            trocarModo('pedido');
            if (!form.hidden) {
                if (t.modalidade) sel.modalidades.add(t.modalidade);
                if (sel.turmas.size < 3) sel.turmas.add(t.id);
                pintarModalidades();
                pintarTurmas();
            }
            raiz.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'start' });
            setTimeout(() => form.nome?.focus({ preventScroll: true }), 500);
        },
        abrirAcompanhamento,
    };
}
