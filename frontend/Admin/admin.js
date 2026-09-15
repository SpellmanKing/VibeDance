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