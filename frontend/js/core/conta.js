import { api } from './api.js';
import { Session } from './session.js';
import {
    esc, html, raw, moeda, dataHora, avatar, badge, toastOk, toast, comBotao, vazio, DIAS, NIVEIS, urlArquivo,
} from './ui.js';

/**
 * "Minha conta" — comum a ADM, Professor e Aluno: foto de perfil, dados cadastrais,
 * contato, turmas e troca de senha.
 */
const PERFIS = { ADMINISTRADOR: 'Administrador(a)', PROFESSOR: 'Professor(a)', ALUNO: 'Aluno(a)' };
const MAX_FOTO = 3 * 1024 * 1024;

/** Atualiza a foto do rodapé da barra lateral sem recarregar a página. */
export function pintarAvatarLateral(u) {
    const el = document.getElementById('me-avatar');
    if (!el || !u) return;
    if (u.avatarUrl) {
        el.textContent = '';
        el.classList.add('has-photo');
        el.style.backgroundImage = `url('${urlArquivo(u.avatarUrl)}')`;
    } else {
        el.classList.remove('has-photo');
        el.style.backgroundImage = '';
        el.textContent = (u.nome || '').replace(/^(Prof(a)?\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    }
}

const horario = (t) => `${(t.dias || []).map((d) => DIAS[d - 1]).join(' · ')} · ${t.horarioInicio}–${t.horarioFim}`;

export async function telaConta(ctx) {
    const d = await api.get('/api/me/dados');
    const u = d.usuario;
    const ehAluno = u.perfil === 'ALUNO';
    const ehProf = u.perfil === 'PROFESSOR';

    ctx.el.innerHTML = html`
        <div class="page-head"><div><h1>Minha conta</h1><p>Sua foto, seus dados e a segurança do seu acesso.</p></div></div>

        <section class="profile-card">
            <div class="profile-photo">
                <div class="profile-avatar" id="pf-avatar">${raw(avatar(u, 'xl'))}</div>
                <label class="profile-photo-btn" for="pf-arquivo" title="Trocar foto"><i class="fas fa-camera"></i><span class="sr-only">Trocar foto</span></label>
                <input type="file" id="pf-arquivo" accept="image/jpeg,image/png,image/webp" hidden>
            </div>
            <div class="profile-main">
                <span class="eyebrow">${PERFIS[u.perfil] || u.perfil}</span>
                <h2>${u.nome}</h2>
                <p class="muted">${u.email}</p>
                <div class="profile-chips">
                    <span class="chip-info"><i class="fas fa-id-badge"></i> ${d.codigo}</span>
                    <span class="chip-info"><i class="fas fa-calendar"></i> Desde ${u.dataCadastro ? new Date(u.dataCadastro).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'}</span>
                    ${raw(badge(u.ativo ? 'ATIVO' : 'SUSPENSO'))}
                </div>
            </div>
            <div class="profile-actions">
                <button class="btn" data-acao="trocar"><i class="fas fa-camera"></i> ${u.avatarUrl ? 'Trocar foto' : 'Adicionar foto'}</button>
                ${raw(u.avatarUrl ? '<button class="btn btn-ghost" data-acao="remover"><i class="fas fa-trash-can"></i> Remover</button>' : '')}
                <small class="faint">JPG, PNG ou WebP até 3 MB</small>
            </div>
        </section>

        <section class="grid grid-3 mt-4">
            ${raw(ehAluno ? `
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-layer-group"></i> Turmas ativas</span><span class="kpi-value num">${d.turmas.length}</span><span class="kpi-foot">matrícula ${d.turmas.length ? 'ativa' : 'sem turmas'}</span></div>
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-wallet"></i> Em aberto</span><span class="kpi-value num">${moeda(d.valorEmAberto)}</span><span class="kpi-foot">${d.faturasEmAberto} cobrança(s)</span></div>`
                : ehProf ? `
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-layer-group"></i> Turmas que leciona</span><span class="kpi-value num">${d.turmas.length}</span><span class="kpi-foot">na grade atual</span></div>
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-user-graduate"></i> Alunos</span><span class="kpi-value num">${d.turmas.reduce((a, t) => a + (t.ocupadas || 0), 0)}</span><span class="kpi-foot">matriculados nas suas turmas</span></div>`
                : `
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-shield-halved"></i> Acesso</span><span class="kpi-value" style="font-size:1.4rem">Administrador</span><span class="kpi-foot">controle total do estúdio</span></div>
                <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-at"></i> Domínio</span><span class="kpi-value" style="font-size:1.4rem">@vibedance.com</span><span class="kpi-foot">conta institucional</span></div>`)}
            <div class="data-card kpi"><span class="kpi-label"><i class="fas fa-bell"></i> Notificações</span><span class="kpi-value num">${d.notificacoesNaoLidas}</span><span class="kpi-foot">não lida(s)</span></div>
        </section>

        <section class="grid grid-main mt-4">
            <article class="panel">
                <div class="panel-head"><div><h3>Dados pessoais</h3><span class="muted">Nome, e-mail e CPF são mantidos pela administração.</span></div></div>
                <dl class="kv">
                    <dt>Nome completo</dt><dd>${u.nome}</dd>
                    <dt>E-mail</dt><dd>${u.email}</dd>
                    <dt>CPF</dt><dd class="num">${u.cpf ? u.cpf.replace(/^(\d{3})\D?\d{3}\D?\d{3}\D?(\d{2})$/, '$1.•••.•••-$2') : '—'}</dd>
                    <dt>Perfil</dt><dd>${PERFIS[u.perfil] || u.perfil}</dd>
                    <dt>Matrícula</dt><dd class="num">${d.codigo}</dd>
                    <dt>Cadastro</dt><dd class="num">${dataHora(u.dataCadastro)}</dd>
                </dl>
                <form class="form-inline mt-5" id="pf-contato" novalidate>
                    <div class="field">
                        <label for="pf-tel">Telefone para contato</label>
                        <div class="input-icon"><i class="fas fa-phone"></i><input class="input" id="pf-tel" name="telefone" inputmode="tel" maxlength="20" placeholder="(11) 90000-0000" value="${u.telefone || ''}"></div>
                    </div>
                    <button class="btn btn-primary" type="submit"><i class="fas fa-check"></i> Salvar contato</button>
                </form>
            </article>

            <div class="stack">
                ${raw(ehAluno || ehProf ? `
                <article class="panel">
                    <div class="panel-head"><div><h3>${ehAluno ? 'Minhas turmas' : 'Turmas que leciono'}</h3><span class="muted">${d.turmas.length} turma(s)</span></div></div>
                    ${d.turmas.length ? `<ul class="list-plain">${d.turmas.map((t) => `<li><span class="list-ico"><i class="fas ${esc(t.modalidadeIcone || 'fa-music')}"></i></span><span style="flex:1;min-width:0"><strong>${esc(t.nome)}</strong><br><small class="faint">${esc(horario(t))} · ${esc(t.salaNome)}</small></span>${badge('', NIVEIS[t.nivel] || t.nivel)}</li>`).join('')}</ul>`
                        : vazio('fa-layer-group', 'Nenhuma turma', ehAluno ? 'Explore as turmas e escolha a sua.' : 'Quando a administração alocar uma turma, ela aparece aqui.')}
                </article>` : '')}
                <article class="panel">
                    <div class="panel-head"><div><h3>Segurança</h3><span class="muted">Troque sua senha periodicamente.</span></div></div>
                    <form class="stack" id="pf-senha" novalidate autocomplete="off">
                        <div class="field"><label for="pf-atual">Senha atual</label><input class="input" type="password" id="pf-atual" name="senhaAtual" autocomplete="current-password" required></div>
                        <div class="field"><label for="pf-nova">Nova senha</label><input class="input" type="password" id="pf-nova" name="novaSenha" autocomplete="new-password" minlength="6" required><span class="hint">Mínimo de 6 caracteres.</span></div>
                        <div class="field"><label for="pf-conf">Confirmar nova senha</label><input class="input" type="password" id="pf-conf" name="confirmacao" autocomplete="new-password" required></div>
                        <button class="btn" type="submit"><i class="fas fa-key"></i> Alterar senha</button>
                    </form>
                </article>
            </div>
        </section>`;

    const entrada = ctx.el.querySelector('#pf-arquivo');
    const aplicarUsuario = (novo) => {
        Session.atualizarUsuario({ avatarUrl: novo.avatarUrl || null });
        pintarAvatarLateral({ ...Session.user, ...novo });
    };

    entrada.addEventListener('change', async () => {
        const arq = entrada.files[0];
        entrada.value = '';
        if (!arq) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(arq.type)) { toast('Formato não suportado', { tipo: 'warn', texto: 'Envie uma foto JPG, PNG ou WebP.' }); return; }
        if (arq.size > MAX_FOTO) { toast('Foto muito grande', { tipo: 'warn', texto: 'O limite é de 3 MB.' }); return; }
        // prévia imediata enquanto envia
        const previa = URL.createObjectURL(arq);
        const alvo = ctx.el.querySelector('#pf-avatar .avatar');
        alvo.classList.add('has-photo', 'is-uploading');
        alvo.textContent = '';
        alvo.style.backgroundImage = `url('${previa}')`;
        const fd = new FormData();
        fd.append('arquivo', arq);
        try {
            const novo = await api.post('/api/me/avatar', fd);
            aplicarUsuario(novo);
            toastOk('Foto atualizada', 'Ela já aparece no portal e para a equipe.');
            ctx.recarregar();
        } catch {
            ctx.recarregar();
        } finally {
            URL.revokeObjectURL(previa);
        }
    });

    ctx.el.querySelector('.profile-actions').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        if (b.dataset.acao === 'trocar') entrada.click();
        if (b.dataset.acao === 'remover') {
            const novo = await comBotao(b, () => api.del('/api/me/avatar'));
            aplicarUsuario(novo);
            toastOk('Foto removida');
            ctx.recarregar();
        }
    });

    ctx.el.querySelector('#pf-contato').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        await comBotao(btn, () => api.patch('/api/me', { telefone: e.target.telefone.value.trim() }));
        toastOk('Contato salvo');
    });

    ctx.el.querySelector('#pf-senha').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        if (!f.senhaAtual.value || !f.novaSenha.value) { toast('Preencha as senhas', { tipo: 'warn' }); return; }
        if (f.novaSenha.value.length < 6) { toast('Senha curta', { tipo: 'warn', texto: 'Use ao menos 6 caracteres.' }); return; }
        if (f.novaSenha.value !== f.confirmacao.value) { toast('As senhas não conferem', { tipo: 'warn', texto: 'Digite a nova senha igual nos dois campos.' }); return; }
        await comBotao(f.querySelector('button'), () => api.post('/api/me/senha', { senhaAtual: f.senhaAtual.value, novaSenha: f.novaSenha.value }));
        f.reset();
        toastOk('Senha alterada', 'Use a nova senha no próximo acesso.');
    });
}
