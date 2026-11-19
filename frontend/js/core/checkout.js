import { api } from './api.js';
import { rotuloMotivo } from './descontos.js';
import { esc, html, raw, moeda, data, dataHora, modal, toastOk, toast } from './ui.js';

/**
 * Checkout do aluno (simulado): PIX com QR e copia-e-cola, cartão com prévia ao vivo e
 * boleto com linha digitável. O número do cartão nunca sai do navegador — só a bandeira
 * e os 4 últimos dígitos vão para a API.
 */
const S = '/api/aluno/portal';

// ------------------------------------------------------------------ utilitários

async function copiar(texto, rotulo) {
    try {
        await navigator.clipboard.writeText(texto);
        toastOk(`${rotulo} copiado`, 'Cole no app do seu banco.');
        return true;
    } catch {
        toast('Não foi possível copiar', { tipo: 'warn', texto: 'Selecione o texto e copie manualmente.' });
        return false;
    }
}

function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

/** QR ilustrativo (padrão determinístico a partir do código PIX, com os 3 marcadores de posição). */
function qrIlustrativo(texto, n = 29) {
    const rnd = hash(texto || 'vibedance');
    const finder = (x, y) => {
        const dentro = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7;
        for (const [cx, cy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
            if (dentro(cx, cy)) {
                const dx = x - cx; const dy = y - cy;
                return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
            }
            if (x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7) return false;
        }
        return null;
    };
    let rects = '';
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const f = finder(x, y);
            const on = f === null ? (x === 6 || y === 6 ? (x + y) % 2 === 0 : rnd() > 0.52) : f;
            if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
        }
    }
    return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR Code PIX ilustrativo"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#0D0B0C">${rects}</g></svg>`;
}

function bandeira(numero) {
    const n = numero.replace(/\D/g, '');
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return 'Elo';
    if (/^(606282|3841)/.test(n)) return 'Hipercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
    if (/^4/.test(n)) return 'Visa';
    return 'Cartão';
}

function luhn(numero) {
    const d = numero.replace(/\D/g, '');
    if (d.length < 13 || d.length > 19) return false;
    let soma = 0;
    for (let i = 0; i < d.length; i++) {
        let n = Number(d[d.length - 1 - i]);
        if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
        soma += n;
    }
    return soma % 10 === 0;
}

const formatarNumero = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 19);
    return /^3[47]/.test(d) ? d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : d.replace(/(\d{4})(?=\d)/g, '$1 ');
};

// ------------------------------------------------------------------ checkout

export async function abrirCheckout(faturaId, { aoPagar, aoEnviarComprovante } = {}) {
    let co;
    try {
        co = await api.get(`${S}/faturas/${faturaId}/checkout`);
    } catch {
        return;
    }
    if (!co.pagavel) {
        toast('Pagamento indisponível', { tipo: 'warn', texto: co.motivoBloqueio });
        return;
    }
    const f = co.fatura;
    const temEncargos = Number(co.multa) > 0 || Number(co.juros) > 0;
    const parcelas = Array.from({ length: co.parcelasMax }, (_, i) => i + 1);

    const corpo = html`
        <div class="checkout">
            <aside class="co-resumo">
                <span class="eyebrow">Mensalidade</span>
                <h3>${f.titulo}</h3>
                <dl class="co-linhas">
                    <div><dt>Referência</dt><dd class="num">${f.mesReferencia}</dd></div>
                    <div><dt>Vencimento</dt><dd class="num">${data(f.dataVencimento)}${raw(co.diasAtraso ? ` <span class="badge danger plain">${co.diasAtraso} dia(s) em atraso</span>` : '')}</dd></div>
                    <div><dt>Valor da mensalidade</dt><dd class="num">${moeda(co.valorBase)}</dd></div>
                    ${raw(temEncargos ? `<div><dt>Multa (2%)</dt><dd class="num warn">+ ${moeda(co.multa)}</dd></div><div><dt>Juros (1% a.m.)</dt><dd class="num warn">+ ${moeda(co.juros)}</dd></div>` : '')}
                    ${raw(Number(co.desconto) > 0 ? `<div><dt>Desconto · ${esc(rotuloMotivo(co.fatura?.motivoDesconto))}</dt><dd class="num ok">− ${moeda(co.desconto)}</dd></div>` : '')}
                </dl>
                <div class="co-total"><span>Total a pagar</span><b class="num">${moeda(co.total)}</b></div>
                ${raw(temEncargos ? '<p class="faint co-nota">Encargos calculados até hoje sobre o valor original.</p>' : '<p class="faint co-nota">Sem encargos: dentro do vencimento.</p>')}
            </aside>

            <section class="co-metodos">
                <div class="co-tabs" role="tablist" aria-label="Forma de pagamento">
                    <button type="button" role="tab" class="is-active" data-m="PIX" aria-selected="true"><i class="fas fa-bolt"></i> PIX</button>
                    <button type="button" role="tab" data-m="CARTAO_CREDITO" aria-selected="false"><i class="fas fa-credit-card"></i> Cartão</button>
                    <button type="button" role="tab" data-m="BOLETO" aria-selected="false"><i class="fas fa-barcode"></i> Boleto</button>
                </div>

                <div class="co-pane is-current" data-p="PIX">
                    <div class="pix">
                        ${raw(qrIlustrativo(co.pixCopiaCola || f.titulo))}
                        <div>
                            <p class="muted">Abra o app do banco, escolha <strong>PIX › Ler QR Code</strong> ou use o código copia e cola.</p>
                            <div class="copy-box mt-4"><code class="num" data-pix>${co.pixCopiaCola || 'Código indisponível'}</code><button type="button" class="btn btn-sm" data-copiar="pix"><i class="fas fa-copy"></i> Copiar</button></div>
                            <p class="faint co-nota mt-4"><i class="fas fa-circle-info"></i> QR ilustrativo — ambiente de demonstração. A confirmação abaixo simula o retorno instantâneo do banco.</p>
                        </div>
                    </div>
                </div>

                <div class="co-pane" data-p="CARTAO_CREDITO">
                    <div class="card-preview" data-card aria-hidden="true">
                        <div class="card-top"><span class="chip"></span><span class="card-brand" data-c="brand">Cartão</span></div>
                        <div class="card-number num" data-c="numero">•••• •••• •••• ••••</div>
                        <div class="card-bottom"><div><small>Titular</small><span data-c="nome">NOME COMO NO CARTÃO</span></div><div><small>Validade</small><span class="num" data-c="validade">MM/AA</span></div></div>
                    </div>
                    <div class="form-grid mt-4">
                        <div class="field span-2"><label for="co-num">Número do cartão</label><input class="input num" id="co-num" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000" maxlength="23"><span class="hint">Demonstração: use um cartão de teste, como 4242 4242 4242 4242.</span></div>
                        <div class="field span-2"><label for="co-nome">Nome impresso</label><input class="input" id="co-nome" autocomplete="off" placeholder="Como aparece no cartão" maxlength="26"></div>
                        <div class="field"><label for="co-val">Validade</label><input class="input num" id="co-val" inputmode="numeric" autocomplete="off" placeholder="MM/AA" maxlength="5"></div>
                        <div class="field"><label for="co-cvv">CVV</label><input class="input num" id="co-cvv" inputmode="numeric" autocomplete="off" placeholder="•••" maxlength="4"></div>
                        <div class="field span-2"><label for="co-parc">Parcelas</label><select class="input" id="co-parc">${raw(parcelas.map((p) => `<option value="${p}">${p}x de ${moeda(Number(co.total) / p)} sem juros</option>`).join(''))}</select></div>
                    </div>
                </div>

                <div class="co-pane" data-p="BOLETO">
                    <div class="boleto">
                        <div class="barcode" aria-hidden="true">${raw(Array.from({ length: 64 }, (_, i) => `<i style="width:${1 + ((co.linhaDigitavel.charCodeAt(i % co.linhaDigitavel.length) + i) % 3)}px"></i>`).join(''))}</div>
                        <label class="field-label" for="co-linha">Linha digitável</label>
                        <div class="copy-box"><code class="num" id="co-linha">${co.linhaDigitavel}</code><button type="button" class="btn btn-sm" data-copiar="boleto"><i class="fas fa-copy"></i> Copiar</button></div>
                        <div class="row wrap mt-4"><button type="button" class="btn btn-sm btn-ghost" data-ver-boleto><i class="fas fa-file-invoice"></i> Visualizar boleto</button><span class="faint co-nota">Compensação real leva até 3 dias úteis; aqui ela é simulada na hora.</span></div>
                    </div>
                </div>
                ${raw(aoEnviarComprovante ? '<button type="button" class="btn btn-sm btn-ghost co-alt" data-comprovante><i class="fas fa-paperclip"></i> Já paguei por fora — enviar comprovante</button>' : '')}
            </section>
        </div>`;

    let metodo = 'PIX';
    const rotulos = { PIX: `Simular confirmação do PIX · ${moeda(co.total)}`, CARTAO_CREDITO: `Pagar ${moeda(co.total)}`, BOLETO: `Simular compensação · ${moeda(co.total)}` };

    modal({
        titulo: 'Pagamento',
        subtitulo: `${f.titulo}`,
        largo: true,
        corpo,
        confirmar: rotulos.PIX,
        onAbrir: (form, m) => {
            m.el.classList.add('modal-checkout');
            const btn = m.el.querySelector('[data-next]');
            const $ = (s) => form.querySelector(s);

            form.querySelector('.co-tabs').addEventListener('click', (e) => {
                const b = e.target.closest('[data-m]');
                if (!b) return;
                metodo = b.dataset.m;
                form.querySelectorAll('.co-tabs [data-m]').forEach((x) => {
                    x.classList.toggle('is-active', x === b);
                    x.setAttribute('aria-selected', String(x === b));
                });
                form.querySelectorAll('.co-pane').forEach((p) => p.classList.toggle('is-current', p.dataset.p === metodo));
                btn.textContent = rotulos[metodo];
                m.erro(null);
                if (metodo === 'CARTAO_CREDITO') $('#co-num').focus();
            });

            form.addEventListener('click', (e) => {
                const c = e.target.closest('[data-copiar]');
                if (c) copiar(c.dataset.copiar === 'pix' ? co.pixCopiaCola : co.linhaDigitavel.replace(/\D/g, ''), c.dataset.copiar === 'pix' ? 'Código PIX' : 'Linha digitável')
                    .then((ok) => { if (ok) { c.innerHTML = '<i class="fas fa-check"></i> Copiado'; setTimeout(() => { c.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 1800); } });
                if (e.target.closest('[data-ver-boleto]')) verBoleto(co);
                if (e.target.closest('[data-comprovante]')) { m.fechar(); aoEnviarComprovante?.(f); }
            });

            // Prévia ao vivo do cartão
            const card = form.querySelector('[data-card]');
            const set = (k, v) => { card.querySelector(`[data-c="${k}"]`).textContent = v; };
            $('#co-num').addEventListener('input', (e) => {
                e.target.value = formatarNumero(e.target.value);
                const b = bandeira(e.target.value);
                set('numero', e.target.value || '•••• •••• •••• ••••');
                set('brand', b);
                card.dataset.brand = b.toLowerCase();
            });
            $('#co-nome').addEventListener('input', (e) => set('nome', e.target.value.toUpperCase() || 'NOME COMO NO CARTÃO'));
            $('#co-val').addEventListener('input', (e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
                set('validade', e.target.value || 'MM/AA');
            });
            $('#co-cvv').addEventListener('focus', () => card.classList.add('is-flipped'));
            $('#co-cvv').addEventListener('blur', () => card.classList.remove('is-flipped'));
            $('#co-cvv').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
        },
        onSubmit: async (_, form) => {
            const corpoReq = { forma: metodo };
            if (metodo === 'CARTAO_CREDITO') {
                const numero = form.querySelector('#co-num').value;
                const nome = form.querySelector('#co-nome').value.trim();
                const val = form.querySelector('#co-val').value;
                const cvv = form.querySelector('#co-cvv').value;
                if (!luhn(numero)) throw new Error('Número de cartão inválido. Confira os dígitos.');
                if (nome.length < 3) throw new Error('Informe o nome impresso no cartão.');
                const [mm, aa] = val.split('/').map(Number);
                const fimMes = new Date(2000 + (aa || 0), mm || 0, 0, 23, 59);
                if (!mm || mm > 12 || !aa || fimMes < new Date()) throw new Error('Validade inválida ou cartão vencido.');
                if (!/^\d{3,4}$/.test(cvv)) throw new Error('CVV inválido.');
                corpoReq.parcelas = Number(form.querySelector('#co-parc').value);
                corpoReq.cartaoFinal = numero.replace(/\D/g, '').slice(-4);
                corpoReq.bandeira = bandeira(numero);
            }
            const comprovante = await api.post(`${S}/faturas/${f.id}/pagar`, corpoReq, { silencioso: true });
            toastOk('Pagamento confirmado', `${f.titulo} está quitada.`);
            aoPagar?.(comprovante);
            setTimeout(() => mostrarComprovante(comprovante), 280);
        },
    });
}

function verBoleto(co) {
    const f = co.fatura;
    modal({
        titulo: 'Boleto (visualização)',
        subtitulo: 'Documento simulado — não é um boleto bancário válido.',
        confirmar: 'Fechar',
        corpo: html`
            <div class="boleto-doc">
                <div class="row between"><strong>VibeDance Studio</strong><span class="num">999-9</span></div>
                <code class="num boleto-linha">${co.linhaDigitavel}</code>
                <dl class="kv mt-4"><dt>Pagador</dt><dd>${f.alunoNome}</dd><dt>Referente a</dt><dd>${f.titulo}</dd><dt>Vencimento</dt><dd class="num">${data(f.dataVencimento)}</dd><dt>Valor do documento</dt><dd class="num">${moeda(co.total)}</dd></dl>
                <div class="barcode mt-4" aria-hidden="true">${raw(Array.from({ length: 90 }, (_, i) => `<i style="width:${1 + ((co.linhaDigitavel.charCodeAt(i % co.linhaDigitavel.length) * 7 + i) % 3)}px"></i>`).join(''))}</div>
            </div>`,
        onSubmit: () => {},
    });
}

// ------------------------------------------------------------------ comprovante

const FORMAS = { PIX: 'PIX', CARTAO_CREDITO: 'Cartão de crédito', BOLETO: 'Boleto', COMPROVANTE_MANUAL: 'Comprovante / outro' };

export function mostrarComprovante(c) {
    const ajuste = Number(c.ajuste || 0);
    modal({
        titulo: 'Comprovante de pagamento',
        confirmar: 'Concluir',
        corpo: html`
            <div class="receipt">
                <header class="receipt-banner">
                    <img class="receipt-arte" src="../img/recibo-arte.jpg" alt="">
                    <div class="receipt-marca"><img src="../img/vibedance-simbolo.svg" alt="" width="30" height="30"><span>VibeDance</span></div>
                    <span class="receipt-kicker">Comprovante de pagamento</span>
                    <p class="receipt-valor num">${moeda(c.total)}</p>
                    <p class="receipt-quando">Pago em ${dataHora(c.pagoEm)}</p>
                    <span class="receipt-selo"><i class="fas fa-check"></i> Pagamento confirmado</span>
                </header>
                <p class="receipt-ola">Obrigado, ${(c.alunoNome || '').split(' ')[0]}! Seu pagamento mantém o palco aceso.</p>
                <dl class="receipt-dados">
                    <div><dt>Transação</dt><dd class="num">${c.transacao}</dd></div>
                    <div><dt>Aluno(a)</dt><dd>${c.alunoNome}</dd></div>
                    <div><dt>Referente a</dt><dd>${c.titulo}</dd></div>
                    ${raw(c.turmaNome ? `<div><dt>Turma</dt><dd>${esc(c.turmaNome)}</dd></div>` : '')}
                    <div><dt>Forma</dt><dd>${FORMAS[c.forma] || c.forma}${c.metodoDetalhe ? raw(`<br><small class="faint">${esc(c.metodoDetalhe)}</small>`) : ''}</dd></div>
                    <div><dt>Valor base</dt><dd class="num">${moeda(c.valorBase)}</dd></div>
                    ${raw(ajuste ? `<div><dt>${ajuste > 0 ? 'Multa e juros' : 'Desconto'}</dt><dd class="num">${ajuste > 0 ? '+' : '−'} ${moeda(Math.abs(ajuste))}</dd></div>` : '')}
                    <div class="receipt-total"><dt>Total pago</dt><dd class="num">${moeda(c.total)}</dd></div>
                </dl>
                <div class="receipt-count" aria-hidden="true">${raw([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span>${n}</span>`).join(''))}</div>
                <button type="button" class="btn btn-primary btn-block mt-4" data-pdf><i class="fas fa-file-pdf"></i> Baixar comprovante em PDF</button>
            </div>`,
        onAbrir: (form, m) => {
            m.el.classList.add('modal-receipt');
            // o modal foca o primeiro botão (o do PDF, no fim); volta a rolagem para o cabeçalho
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const btn = form.querySelector('[data-next]');
                btn?.focus({ preventScroll: true });
                form.querySelector('.modal-body').scrollTop = 0;
            }));
            form.querySelector('[data-pdf]').onclick = (e) => {
                const b = e.currentTarget;
                b.classList.add('is-loading');
                api.arquivo(`/api/aluno/pagamentos/${c.pagamentoId}/recibo`, { baixar: true, nome: `comprovante-${c.transacao}.pdf` })
                    .finally(() => b.classList.remove('is-loading'));
            };
        },
        onSubmit: () => {},
    });
}

export async function abrirComprovante(pagamentoId) {
    const c = await api.get(`${S}/pagamentos/${pagamentoId}/comprovante`);
    mostrarComprovante(c);
}
