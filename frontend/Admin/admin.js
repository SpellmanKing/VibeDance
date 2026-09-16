/**
 * VibeDance Admin Controller
 * Painel Executivo com KPIs em Tempo Real, CRUD de Usuários e Alocação de Salas
 */

let filtroPerfilAtivo = 'TODOS';

document.addEventListener('DOMContentLoaded', () => {
    inicializarPainelAdmin();

    // Listeners dos formulários
    const formUsuario = document.getElementById('form-usuario-crud');
    if (formUsuario) formUsuario.addEventListener('submit', salvarUsuarioCRUD);

    const formTurma = document.getElementById('form-cadastrar-turma');
    if (formTurma) formTurma.addEventListener('submit', salvarNovaTurmaAdmin);

    const formMod = document.getElementById('form-cadastrar-modalidade');
    if (formMod) formMod.addEventListener('submit', salvarNovaModalidadeAdmin);
});

function inicializarPainelAdmin() {
    atualizarKpis();
    renderizarDestaquesTurmas();
    renderizarTabelaUsuarios();
    popularSelectsTurmaAdmin();
    renderizarTabelaTurmasAdmin();
    renderizarTabelaModalidadesAdmin();

    // Módulo Financeiro
    renderizarKpisFinanceirosAdmin();
    renderizarFilaComprovantesAdmin();
    popularSelectTurmasFinanceiro();
    renderizarTabelaTransacoesAdmin();

    // Sincronização em tempo real (quando aluno anexa comprovante ou paga via Pix)
    if (window.VibeStore && typeof window.VibeStore.onSync === 'function') {
        window.VibeStore.onSync(() => {
            renderizarKpisFinanceirosAdmin();
            renderizarFilaComprovantesAdmin();
            renderizarTabelaTransacoesAdmin();
            atualizarKpis();
        });
    }
}

/**
 * Alterna entre abas do painel executivo
 */
function trocarAbaAdmin(tabId, btnElement) {
    document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');

    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        const correspondingBtn = document.getElementById(`tab-btn-${tabId}`);
        if (correspondingBtn) correspondingBtn.classList.add('active');
    }
}
window.trocarAbaAdmin = trocarAbaAdmin;

/**
 * Atualiza os indicadores de KPI nos cards do topo
 */
function atualizarKpis() {
    const kpis = window.VibeStore.getKpis();

    const elAlunos = document.getElementById('kpi-alunos-ativos');
    const elOcupacao = document.getElementById('kpi-taxa-ocupacao');
    const elFaturamento = document.getElementById('kpi-faturamento');
    const elTurmas = document.getElementById('kpi-total-turmas');

    if (elAlunos) elAlunos.textContent = kpis.alunosAtivos;
    if (elOcupacao) elOcupacao.textContent = kpis.taxaOcupacao;
    if (elFaturamento) elFaturamento.textContent = kpis.faturamentoEstimado;
    if (elTurmas) elTurmas.textContent = kpis.totalTurmas;
}

/**
 * Renderiza os cards de turmas mais cheias e ocupação
 */
function renderizarDestaquesTurmas() {
    const container = document.getElementById('container-destaques-turmas');
    if (!container) return;

    const turmas = window.VibeStore.getTurmas();
    container.innerHTML = '';

    turmas.forEach(t => {
        const perc = Math.round(((t.ocupadas || 0) / (t.vagas || 25)) * 100);
        const card = document.createElement('div');
        card.className = 'vibe-card';

        card.innerHTML = `
            <div class="card-top-banner" style="height: 80px;">
                <span class="card-badge badge-cyan">${t.salaNome || 'Studio Principal'}</span>
            </div>
            <div class="card-body">
                <h4 class="card-title" style="font-size: 1.1rem;">${t.nome}</h4>
                <p class="card-desc" style="font-size: 0.85rem; margin-bottom: 10px;">
                    ${t.modalidadeNome} • Prof. <strong>${t.professorNome}</strong>
                </p>

                <div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 6px;">
                        <span style="color: var(--text-muted);">Capacidade da Sala:</span>
                        <strong style="color: #fff;">${t.ocupadas || 0} de ${t.vagas} vagas (${perc}%)</strong>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: var(--radius-full); overflow: hidden;">
                        <div style="width: ${perc}%; height: 100%; background: ${perc >= 85 ? 'var(--neon-pink)' : 'var(--grad-primary)'};"></div>
                    </div>
                </div>

                <div class="card-meta-list" style="margin-bottom: 0;">
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${t.dias} • ${t.horario}</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/* ==========================================================================
   CRUD COMPLETO DE USUÁRIOS (Alunos, Professores e Administradores)
   ========================================================================== */

function filtrarPerfilUsuario(perfil, btnElement) {
    filtroPerfilAtivo = perfil;
    document.querySelectorAll('.filter-pills .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    filtrarTabelaUsuarios();
}
window.filtrarPerfilUsuario = filtrarPerfilUsuario;

function filtrarTabelaUsuarios() {
    const busca = (document.getElementById('filtro-busca-usuarios').value || '').toLowerCase();
    renderizarTabelaUsuarios(filtroPerfilAtivo, busca);
}
window.filtrarTabelaUsuarios = filtrarTabelaUsuarios;

function renderizarTabelaUsuarios(perfilFiltro = 'TODOS', buscaTexto = '') {
    const tbody = document.getElementById('tabela-usuarios-corpo');
    if (!tbody) return;

    let usuarios = window.VibeStore.getUsuarios();

    if (perfilFiltro !== 'TODOS') {
        usuarios = usuarios.filter(u => u.perfil === perfilFiltro);
    }

    if (buscaTexto) {
        usuarios = usuarios.filter(u => 
            (u.nome && u.nome.toLowerCase().includes(buscaTexto)) ||
            (u.email && u.email.toLowerCase().includes(buscaTexto)) ||
            (u.cpf && u.cpf.includes(buscaTexto))
        );
    }

    tbody.innerHTML = '';

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Nenhum usuário encontrado com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    usuarios.forEach(u => {
        const tr = document.createElement('tr');
        const initials = u.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

        let badgePerfil = '';
        if (u.perfil === 'ADMINISTRADOR') badgePerfil = '<span class="badge badge-amber"><i class="fas fa-crown"></i> Admin</span>';
        else if (u.perfil === 'PROFESSOR') badgePerfil = '<span class="badge badge-pink"><i class="fas fa-chalkboard-teacher"></i> Professor</span>';
        else badgePerfil = '<span class="badge badge-cyan"><i class="fas fa-music"></i> Aluno</span>';

        const statusBadge = u.ativo !== false 
            ? '<span class="badge badge-green"><i class="fas fa-check"></i> Ativo</span>'
            : '<span class="badge" style="background: rgba(239,68,68,0.2); color: #f87171;">Inativo</span>';

        tr.innerHTML = `
            <td>#${u.id}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar-circle" style="width: 32px; height: 32px; font-size: 0.75rem;">${initials}</div>
                    <strong style="color: #fff;">${u.nome}</strong>
                </div>
            </td>
            <td>${u.email}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${u.cpf}</td>
            <td>${u.telefone || '(61) 98888-0000'}</td>
            <td>${badgePerfil}</td>
            <td>${statusBadge}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button class="btn-vibe-outline" style="padding: 5px 10px; font-size: 0.78rem; margin-right: 6px;" onclick="abrirModalUsuario(${u.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-vibe-danger" style="padding: 5px 10px; font-size: 0.78rem;" onclick="excluirUsuarioCRUD(${u.id}, '${u.nome}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalUsuario(usuarioId = null) {
    const form = document.getElementById('form-usuario-crud');
    form.reset();

    const idInput = document.getElementById('usuario-id');
    const tituloModal = document.getElementById('modal-usuario-titulo');

    if (usuarioId) {
        const u = window.VibeStore.getUsuarios().find(usr => usr.id === Number(usuarioId));
        if (u) {
            tituloModal.textContent = `Editar Usuário: ${u.nome}`;
            idInput.value = u.id;
            document.getElementById('usuario-nome').value = u.nome;
            document.getElementById('usuario-email').value = u.email;
            document.getElementById('usuario-cpf').value = u.cpf;
            document.getElementById('usuario-telefone').value = u.telefone || '';
            document.getElementById('usuario-perfil').value = u.perfil;
            document.getElementById('usuario-senha').value = u.senha;
        }
    } else {
        tituloModal.textContent = 'Cadastrar Novo Usuário';
        idInput.value = '';
    }

    window.VibeUI.openModal('modal-usuario-crud');
}
window.abrirModalUsuario = abrirModalUsuario;

function salvarUsuarioCRUD(e) {
    e.preventDefault();

    const id = document.getElementById('usuario-id').value;
    const nome = document.getElementById('usuario-nome').value.trim();
    const email = document.getElementById('usuario-email').value.trim();
    const cpf = document.getElementById('usuario-cpf').value.trim();
    const telefone = document.getElementById('usuario-telefone').value.trim();
    const perfil = document.getElementById('usuario-perfil').value;
    const senha = document.getElementById('usuario-senha').value.trim();

    const usuario = {
        id: id ? Number(id) : null,
        nome,
        email,
        cpf,
        telefone,
        perfil,
        senha,
        ativo: true
    };

    window.VibeStore.salvarUsuario(usuario);
    window.VibeUI.closeModal('modal-usuario-crud');
    window.VibeUI.showToast(id ? 'Dados do usuário atualizados com sucesso!' : 'Novo usuário cadastrado no estúdio!', 'success');

    atualizarKpis();
    renderizarTabelaUsuarios(filtroPerfilAtivo);
    popularSelectsTurmaAdmin();
}

function excluirUsuarioCRUD(id, nome) {
    if (confirm(`Tem certeza de que deseja remover o usuário "${nome}"? Esta ação removerá seus acessos.`)) {
        window.VibeStore.excluirUsuario(id);
        window.VibeUI.showToast(`Usuário ${nome} excluído com sucesso.`, 'info');
        atualizarKpis();
        renderizarTabelaUsuarios(filtroPerfilAtivo);
        popularSelectsTurmaAdmin();
    }
}
window.excluirUsuarioCRUD = excluirUsuarioCRUD;

/* ==========================================================================
   QUADRO DE HORÁRIOS & ALOCAÇÃO DE SALAS
   ========================================================================== */

function popularSelectsTurmaAdmin() {
    const mods = window.VibeStore.getModalidades();
    const profs = window.VibeStore.getUsuarios().filter(u => u.perfil === 'PROFESSOR');
    const salas = window.VibeStore.getSalas();

    const selectMod = document.getElementById('turma-modalidade');
    const selectProf = document.getElementById('turma-professor');
    const selectSala = document.getElementById('turma-sala');

    if (selectMod) {
        selectMod.innerHTML = mods.map(m => `<option value="${m.id}" data-nome="${m.nome}">${m.nome} (${m.categoria || 'Geral'})</option>`).join('');
    }
    if (selectProf) {
        selectProf.innerHTML = profs.map(p => `<option value="${p.id}" data-nome="${p.nome}">${p.nome}</option>`).join('');
    }
    if (selectSala) {
        selectSala.innerHTML = salas.map(s => `<option value="${s.id}" data-nome="${s.nome}">${s.nome} (Capacidade: ${s.capacidade})</option>`).join('');
    }
}

function renderizarTabelaTurmasAdmin() {
    const tbody = document.getElementById('tabela-turmas-admin-corpo');
    if (!tbody) return;

    const turmas = window.VibeStore.getTurmas();
    tbody.innerHTML = '';

    turmas.forEach(t => {
        const perc = Math.round(((t.ocupadas || 0) / (t.vagas || 25)) * 100);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>
                <strong style="color: #fff;">${t.nome}</strong>
                <div style="font-size: 0.78rem; color: var(--neon-pink);">${t.modalidadeNome}</div>
            </td>
            <td>${t.professorNome}</td>
            <td><span class="badge badge-purple">${t.salaNome || 'Studio A'}</span></td>
            <td>${t.dias} • <strong>${t.horario}</strong></td>
            <td>
                <div class="capacity-bar-container">
                    <div class="capacity-bar-fill" style="width: ${perc}%;"></div>
                </div>
                <span style="font-size: 0.8rem;">${t.ocupadas || 0}/${t.vagas}</span>
            </td>
            <td style="text-align: right;">
                <button class="btn-vibe-danger" style="padding: 5px 8px; font-size: 0.75rem;" onclick="excluirTurmaAdmin(${t.id}, '${t.nome}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function salvarNovaTurmaAdmin(e) {
    e.preventDefault();

    const nome = document.getElementById('turma-nome').value.trim();
    const selectMod = document.getElementById('turma-modalidade');
    const selectProf = document.getElementById('turma-professor');
    const selectSala = document.getElementById('turma-sala');

    const modalidadeId = Number(selectMod.value);
    const modalidadeNome = selectMod.options[selectMod.selectedIndex].dataset.nome || selectMod.options[selectMod.selectedIndex].text;

    const professorId = Number(selectProf.value);
    const professorNome = selectProf.options[selectProf.selectedIndex].dataset.nome || selectProf.options[selectProf.selectedIndex].text;

    const salaId = Number(selectSala.value);
    const salaNome = selectSala.options[selectSala.selectedIndex].dataset.nome || selectSala.options[selectSala.selectedIndex].text;

    const dias = document.getElementById('turma-dias').value.trim();
    const horario = document.getElementById('turma-horario').value.trim();
    const vagas = Number(document.getElementById('turma-vagas').value);
    const nivel = document.getElementById('turma-nivel').value;

    window.VibeStore.salvarTurma({
        nome,
        modalidadeId,
        modalidadeNome,
        professorId,
        professorNome,
        salaId,
        salaNome,
        dias,
        horario,
        vagas,
        nivel,
        ocupadas: 0
    });

    window.VibeUI.showToast(`Turma "${nome}" cadastrada e alocada na ${salaNome}!`, 'success');
    document.getElementById('form-cadastrar-turma').reset();
    
    atualizarKpis();
    renderizarDestaquesTurmas();
    renderizarTabelaTurmasAdmin();
}

function excluirTurmaAdmin(id, nome) {
    if (confirm(`Deseja realmente remover a turma "${nome}"?`)) {
        window.VibeStore.excluirTurma(id);
        window.VibeUI.showToast(`Turma "${nome}" removida.`, 'info');
        atualizarKpis();
        renderizarDestaquesTurmas();
        renderizarTabelaTurmasAdmin();
    }
}
window.excluirTurmaAdmin = excluirTurmaAdmin;

/* ==========================================================================
   MODALIDADES & SALAS
   ========================================================================== */

function renderizarTabelaModalidadesAdmin() {
    const tbody = document.getElementById('tabela-modalidades-admin-corpo');
    if (!tbody) return;

    const modalidades = window.VibeStore.getModalidades();
    tbody.innerHTML = '';

    modalidades.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: #fff;"><i class="fas ${m.icone || 'fa-music'}" style="color: var(--neon-purple); margin-right: 8px;"></i> ${m.nome}</strong></td>
            <td><span class="badge badge-cyan">${m.categoria || 'Geral'}</span></td>
            <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 300px;">${m.descricao}</td>
            <td style="text-align: right;"><span class="badge badge-green">Ativa</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function salvarNovaModalidadeAdmin(e) {
    e.preventDefault();

    const nome = document.getElementById('modalidade-nome-input').value.trim();
    const categoria = document.getElementById('modalidade-categoria-input').value;
    const descricao = document.getElementById('modalidade-desc-input').value.trim();

    window.VibeStore.salvarModalidade({
        nome,
        categoria,
        descricao,
        icone: 'fa-music'
    });

    window.VibeUI.showToast(`Nova modalidade "${nome}" criada com sucesso!`, 'success');
    document.getElementById('form-cadastrar-modalidade').reset();

    popularSelectsTurmaAdmin();
    renderizarTabelaModalidadesAdmin();
}

// =========================================================================
// --- MÓDULO DO ADMINISTRADOR: GESTÃO FINANCEIRA, COMPROVANTES E AUDITORIA ---
// =========================================================================

let filtroStatusTransacao = 'TODOS';
let pagamentoSelecionadoAdminId = null;

function renderizarKpisFinanceirosAdmin() {
    const kpis = window.VibeStore.getKpisFinanceirosAdmin();

    const elReceita = document.getElementById('kpi-fin-receita');
    const elPendente = document.getElementById('kpi-fin-pendente');
    const elInadimplencia = document.getElementById('kpi-fin-inadimplencia');
    const elInadimplenteValor = document.getElementById('kpi-fin-inadimplente-valor');
    const elProjecao = document.getElementById('kpi-fin-projecao');
    const elCompCount = document.getElementById('kpi-fin-comprovantes-count');
    const badgeSidebar = document.getElementById('badge-admin-comprovantes-pendentes');
    const badgeFila = document.getElementById('badge-total-fila-comprovantes');

    if (elReceita) elReceita.textContent = kpis.receitaTotal;
    if (elPendente) elPendente.textContent = kpis.valorPendente;
    if (elInadimplencia) elInadimplencia.textContent = kpis.taxaInadimplencia;
    if (elInadimplenteValor) elInadimplenteValor.textContent = `${kpis.totalInadimplente} em atraso`;
    if (elProjecao) elProjecao.textContent = kpis.projecaoMensal;

    if (elCompCount) {
        elCompCount.textContent = `${kpis.comprovantesEmAnaliseQtd} comprovante(s) em análise`;
    }

    if (badgeSidebar) {
        if (kpis.comprovantesEmAnaliseQtd > 0) {
            badgeSidebar.textContent = `${kpis.comprovantesEmAnaliseQtd} novo(s)`;
            badgeSidebar.style.display = 'inline-block';
        } else {
            badgeSidebar.style.display = 'none';
        }
    }

    if (badgeFila) {
        badgeFila.textContent = `${kpis.comprovantesEmAnaliseQtd} pendente(s)`;
    }
}
window.renderizarKpisFinanceirosAdmin = renderizarKpisFinanceirosAdmin;

function renderizarFilaComprovantesAdmin() {
    const container = document.getElementById('container-fila-comprovantes');
    if (!container) return;

    const pendentes = window.VibeStore.getComprovantesPendentes();
    container.innerHTML = '';

    if (pendentes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 36px; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
                <i class="fas fa-check-circle" style="font-size: 2.2rem; color: var(--neon-emerald); margin-bottom: 10px;"></i>
                <h4 style="color: #fff; margin-bottom: 4px;">Fila de Comprovantes Zerada!</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Todos os comprovantes anexados pelos alunos foram devidamente auditados e validados.</p>
            </div>
        `;
        return;
    }

    pendentes.forEach(p => {
        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '18px';
        card.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        card.style.gap = '14px';

        const valorFormatado = Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataFormatada = p.dataEnvio ? new Date(p.dataEnvio).toLocaleString('pt-BR') : 'Hoje';

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <strong style="color: #fff; font-size: 1.05rem; display: block;">${p.alunoNome}</strong>
                        <span style="font-size: 0.78rem; color: var(--text-muted);">${p.alunoEmail || ''}</span>
                    </div>
                    <span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>
                </div>

                <div style="display: flex; gap: 14px; align-items: center; background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 10px;">
                    <div style="width: 55px; height: 55px; border-radius: 6px; overflow: hidden; background: #000; flex-shrink: 0; border: 1px solid var(--border-subtle); cursor: pointer;" onclick="abrirModalAprovarComprovante(${p.id})">
                        <img src="${p.comprovanteUrl || 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600'}" alt="Comprovante" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <span style="font-size: 0.78rem; color: var(--neon-cyan); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <i class="fas fa-music"></i> ${p.turmaNome}
                        </span>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--neon-emerald); font-family: var(--font-heading);">
                            ${valorFormatado}
                        </div>
                        <span style="font-size: 0.72rem; color: var(--text-dim);">Enviado em: ${dataFormatada}</span>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 8px;">
                <button class="btn-vibe-secondary" style="flex: 1; font-size: 0.8rem; padding: 7px 10px;" onclick="abrirModalAprovarComprovante(${p.id})">
                    <i class="fas fa-eye"></i> Analisar
                </button>
                <button class="btn-vibe-secondary" style="border-color: rgba(239, 68, 68, 0.4); color: #ef4444; font-size: 0.8rem; padding: 7px 10px;" onclick="abrirModalRejeitarAdmin(${p.id})">
                    <i class="fas fa-times"></i> Recusar
                </button>
                <button class="btn-vibe-primary" style="flex: 1.2; font-size: 0.8rem; padding: 7px 10px;" onclick="aprovarComprovanteDireto(${p.id})">
                    <i class="fas fa-check"></i> Aprovar
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}
window.renderizarFilaComprovantesAdmin = renderizarFilaComprovantesAdmin;

function popularSelectTurmasFinanceiro() {
    const select = document.getElementById('filtro-turma-transacoes');
    if (!select) return;

    const turmas = window.VibeStore.getTurmas();
    select.innerHTML = '<option value="TODAS">Todas as Turmas</option>' + 
        turmas.map(t => `<option value="${t.id}">${t.nome}</option>`).join('');
}

function filtrarStatusTransacao(status, btnElement) {
    filtroStatusTransacao = status;

    const container = btnElement.parentElement;
    if (container) {
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    renderizarTabelaTransacoesAdmin();
}
window.filtrarStatusTransacao = filtrarStatusTransacao;

function filtrarTabelaTransacoes() {
    renderizarTabelaTransacoesAdmin();
}
window.filtrarTabelaTransacoes = filtrarTabelaTransacoes;

function renderizarTabelaTransacoesAdmin() {
    const tbody = document.getElementById('tabela-transacoes-corpo');
    if (!tbody) return;

    const buscaInput = document.getElementById('filtro-busca-transacoes');
    const turmaSelect = document.getElementById('filtro-turma-transacoes');

    const filtros = {
        status: filtroStatusTransacao,
        turmaId: turmaSelect ? turmaSelect.value : 'TODAS',
        busca: buscaInput ? buscaInput.value : ''
    };

    const transacoes = window.VibeStore.getTransacoesAnaliticas(filtros);
    tbody.innerHTML = '';

    if (transacoes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Nenhuma transação encontrada com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    transacoes.forEach(t => {
        const tr = document.createElement('tr');

        let statusBadge = '';
        if (t.status === 'CONFIRMADO') {
            statusBadge = `<span class="badge badge-green"><i class="fas fa-check-circle"></i> Confirmado</span>`;
        } else if (t.status === 'EM_ANALISE') {
            statusBadge = `<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>`;
        } else if (t.status === 'VENCIDO') {
            statusBadge = `<span class="badge badge-red"><i class="fas fa-exclamation-triangle"></i> Vencido</span>`;
        } else {
            statusBadge = `<span class="badge badge-cyan"><i class="fas fa-clock"></i> Pendente</span>`;
        }

        let comprovanteCol = `<span style="color: var(--text-dim); font-size: 0.8rem;">-</span>`;
        if (t.comprovanteUrl) {
            comprovanteCol = `
                <button class="btn-vibe-secondary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="abrirModalAprovarComprovante(${t.pagamentoId})">
                    <i class="fas fa-file-invoice"></i> Ver Anexo
                </button>
            `;
        }

        let acoesCol = '';
        if (t.status === 'EM_ANALISE' && t.pagamentoId) {
            acoesCol = `
                <button class="btn-vibe-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="aprovarComprovanteDireto(${t.pagamentoId})" title="Aprovar Comprovante">
                    <i class="fas fa-check"></i> Aprovar
                </button>
                <button class="btn-vibe-secondary" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444;" onclick="abrirModalRejeitarAdmin(${t.pagamentoId})" title="Recusar">
                    <i class="fas fa-times"></i>
                </button>
            `;
        } else if (t.status === 'CONFIRMADO') {
            acoesCol = `<span style="font-size: 0.78rem; color: var(--neon-emerald);"><i class="fas fa-lock"></i> Liberado</span>`;
        } else {
            acoesCol = `<span style="font-size: 0.78rem; color: var(--text-muted);">Aguardando</span>`;
        }

        const dataVencFormatada = t.dataVencimento ? t.dataVencimento.split('-').reverse().join('/') : '-';
        const valorFormatado = Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        tr.innerHTML = `
            <td>
                <strong style="color: #fff; display: block; font-size: 0.88rem;">${t.titulo}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Ref: ${t.mesReferencia}</span>
            </td>
            <td>
                <span style="color: #fff; font-weight: 600;">${t.alunoNome}</span>
                <div style="font-size: 0.74rem; color: var(--text-muted);">${t.alunoEmail}</div>
            </td>
            <td><span class="badge badge-purple" style="font-size: 0.75rem;">${t.turmaNome}</span></td>
            <td><strong style="color: var(--neon-emerald); font-family: var(--font-heading);">${valorFormatado}</strong></td>
            <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${dataVencFormatada}</span></td>
            <td>${statusBadge}</td>
            <td>${comprovanteCol}</td>
            <td style="text-align: right; white-space: nowrap;">${acoesCol}</td>
        `;

        tbody.appendChild(tr);
    });
}
window.renderizarTabelaTransacoesAdmin = renderizarTabelaTransacoesAdmin;

function abrirModalAprovarComprovante(pagamentoId) {
    const pagamentos = window.VibeStore.getPagamentos();
    const pagamento = pagamentos.find(p => p.id === Number(pagamentoId));
    if (!pagamento) return;

    pagamentoSelecionadoAdminId = pagamento.id;
    const fatura = window.VibeStore.getFaturaById(pagamento.faturaId);
    const aluno = window.VibeStore.getUsuarios().find(u => u.id === pagamento.alunoId);

    const alunoEl = document.getElementById('modal-admin-comp-aluno');
    const valorEl = document.getElementById('modal-admin-comp-valor');
    const turmaEl = document.getElementById('modal-admin-comp-turma');
    const dataEl = document.getElementById('modal-admin-comp-data');
    const imgEl = document.getElementById('modal-admin-comp-img');
    const btnAprovar = document.getElementById('btn-admin-aprovar-comp');
    const btnRejeitar = document.getElementById('btn-admin-rejeitar-comp');

    if (alunoEl) alunoEl.textContent = aluno ? aluno.nome : pagamento.alunoNome;
    if (valorEl) valorEl.textContent = Number(pagamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (turmaEl) turmaEl.textContent = fatura ? (fatura.turmaNome || 'Turma Regular') : 'Mensalidade Vibe';
    if (dataEl) dataEl.textContent = pagamento.dataEnvio ? new Date(pagamento.dataEnvio).toLocaleString('pt-BR') : 'Hoje';
    if (imgEl) imgEl.src = pagamento.comprovanteUrl || 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600';

    if (pagamento.status === 'CONFIRMADO') {
        if (btnAprovar) btnAprovar.style.display = 'none';
        if (btnRejeitar) btnRejeitar.style.display = 'none';
    } else {
        if (btnAprovar) btnAprovar.style.display = 'inline-flex';
        if (btnRejeitar) btnRejeitar.style.display = 'inline-flex';
    }

    window.VibeUI.openModal('modal-admin-ver-comprovante');
}
window.abrirModalAprovarComprovante = abrirModalAprovarComprovante;

function confirmarAprovacaoAdmin() {
    if (!pagamentoSelecionadoAdminId) return;

    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    const adminId = user ? user.id : 1;
    const adminNome = user ? user.nome : 'Administrador Vibe';

    const res = window.VibeStore.aprovarComprovanteAdmin(pagamentoSelecionadoAdminId, adminId, adminNome);
    window.VibeUI.closeModal('modal-admin-ver-comprovante');

    if (res.success) {
        window.VibeUI.showToast(res.message, 'success');
        renderizarKpisFinanceirosAdmin();
        renderizarFilaComprovantesAdmin();
        renderizarTabelaTransacoesAdmin();
    } else {
        window.VibeUI.showToast(res.message, 'error');
    }
}
window.confirmarAprovacaoAdmin = confirmarAprovacaoAdmin;

function aprovarComprovanteDireto(pagamentoId) {
    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    const adminId = user ? user.id : 1;
    const adminNome = user ? user.nome : 'Administrador Vibe';

    const res = window.VibeStore.aprovarComprovanteAdmin(pagamentoId, adminId, adminNome);
    if (res.success) {
        window.VibeUI.showToast(res.message, 'success');
        renderizarKpisFinanceirosAdmin();
        renderizarFilaComprovantesAdmin();
        renderizarTabelaTransacoesAdmin();
    } else {
        window.VibeUI.showToast(res.message, 'error');
    }
}
window.aprovarComprovanteDireto = aprovarComprovanteDireto;

function abrirModalRejeitarAdmin(pagamentoId = null) {
    if (pagamentoId) {
        pagamentoSelecionadoAdminId = pagamentoId;
    }
    document.getElementById('admin-rejeicao-motivo').value = 'Comprovante ilegível ou cortado';
    document.getElementById('group-outro-motivo').style.display = 'none';
    document.getElementById('admin-rejeicao-texto').value = '';

    window.VibeUI.openModal('modal-admin-rejeitar');
}
window.abrirModalRejeitarAdmin = abrirModalRejeitarAdmin;

function motivoPredefinidoHandler(select) {
    const groupOutro = document.getElementById('group-outro-motivo');
    if (groupOutro) {
        groupOutro.style.display = select.value === 'OUTRO' ? 'block' : 'none';
    }
}
window.motivoPredefinidoHandler = motivoPredefinidoHandler;

function confirmarRejeicaoAdmin() {
    if (!pagamentoSelecionadoAdminId) return;

    const select = document.getElementById('admin-rejeicao-motivo');
    const textoOutro = document.getElementById('admin-rejeicao-texto');
    const motivo = select.value === 'OUTRO' ? (textoOutro.value || 'Comprovante inconsistente') : select.value;

    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    const adminId = user ? user.id : 1;
    const adminNome = user ? user.nome : 'Administrador Vibe';

    const res = window.VibeStore.rejeitarComprovanteAdmin(pagamentoSelecionadoAdminId, adminId, adminNome, motivo);

    window.VibeUI.closeModal('modal-admin-rejeitar');
    window.VibeUI.closeModal('modal-admin-ver-comprovante');

    if (res.success) {
        window.VibeUI.showToast(res.message, 'warning');
        renderizarKpisFinanceirosAdmin();
        renderizarFilaComprovantesAdmin();
        renderizarTabelaTransacoesAdmin();
    } else {
        window.VibeUI.showToast(res.message, 'error');
    }
}
window.confirmarRejeicaoAdmin = confirmarRejeicaoAdmin;

function abrirModalAuditoria() {
    const tbody = document.getElementById('tabela-auditoria-corpo');
    if (!tbody) return;

    const logs = window.VibeStore.getAuditoria();
    tbody.innerHTML = '';

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">
                    Nenhum registro de auditoria gerado ainda.
                </td>
            </tr>
        `;
    } else {
        logs.forEach(l => {
            const tr = document.createElement('tr');
            let transicao = '';
            if (l.statusAnterior && l.statusNovo) {
                transicao = `<span style="font-size: 0.78rem;">${l.statusAnterior} &rarr; <strong style="color: var(--neon-cyan);">${l.statusNovo}</strong></span>`;
            } else {
                transicao = `<span style="font-size: 0.78rem; color: var(--text-dim);">-</span>`;
            }

            tr.innerHTML = `
                <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${l.dataHora}</span></td>
                <td><strong style="color: #fff; font-size: 0.85rem;">${l.operadorNome || 'Sistema'}</strong></td>
                <td><span class="badge badge-purple" style="font-size: 0.72rem;">${l.acao}</span></td>
                <td>${transicao}</td>
                <td style="font-size: 0.82rem; color: var(--text-muted); max-width: 260px;">${l.observacao || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.VibeUI.openModal('modal-admin-auditoria');
}
window.abrirModalAuditoria = abrirModalAuditoria;