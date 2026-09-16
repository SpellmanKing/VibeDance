/**
 * VibeDance Professor Controller
 * Agenda Semanal Interativa, Chamada Virtual com 1 Clique e Mural de Músicas
 */

let chamadaEstadoAtual = []; // Mantém o estado da chamada em memória para a turma/data

document.addEventListener('DOMContentLoaded', () => {
    inicializarPainelProfessor();

    // Listener do formulário de novo comunicado
    const formComunicado = document.getElementById('form-novo-comunicado');
    if (formComunicado) {
        formComunicado.addEventListener('submit', salvarNovoComunicado);
    }
});

function inicializarPainelProfessor() {
    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    if (!user) return;

    // Saudação
    const saudacaoEl = document.getElementById('saudacao-docente');
    if (saudacaoEl && window.VibeUI) {
        saudacaoEl.textContent = window.VibeUI.getSaudacao();
    }

    // Configura data de hoje no input de chamada
    const inputData = document.getElementById('input-data-chamada');
    if (inputData) {
        const hoje = new Date().toISOString().split('T')[0];
        inputData.value = hoje;
    }

    renderizarAgendaProfessor(user);
    popularSelectsTurma(user);
    carregarListaChamada();
    renderizarMuralComunicados(user);

    // Sincronização em tempo real: reflete aprovações do admin ou pagamentos do aluno instantaneamente
    if (window.VibeStore && typeof window.VibeStore.onSync === 'function') {
        window.VibeStore.onSync(() => {
            carregarListaChamada();
        });
    }
}

/**
 * Alterna entre as abas do painel
 */
function trocarAbaDocente(tabId, btnElement) {
    document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');

    if (btnElement) {
        btnElement.classList.add('active');
    }
}
window.trocarAbaDocente = trocarAbaDocente;

/**
 * Renderiza os cards da Agenda Semanal
 */
function renderizarAgendaProfessor(user) {
    const container = document.getElementById('container-agenda-professor');
    if (!container) return;

    // Turmas do professor ou todas se for Admin em modo docente
    const todasTurmas = window.VibeStore.getTurmas();
    const turmas = todasTurmas.filter(t => t.professorId === user.id || user.perfil === 'ADMINISTRADOR');

    // Atualiza contadores
    const countEl = document.getElementById('stat-prof-turmas');
    if (countEl) countEl.textContent = turmas.length;

    container.innerHTML = '';

    if (turmas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
                Nenhuma turma atribuída a este professor no momento.
            </div>
        `;
        return;
    }

    turmas.forEach(t => {
        const card = document.createElement('div');
        card.className = 'vibe-card';
        card.innerHTML = `
            <div class="card-top-banner">
                <i class="fas fa-calendar-alt banner-bg-icon"></i>
                <span class="card-badge badge-purple">${t.nivel || 'Geral'}</span>
            </div>
            <div class="card-body">
                <h4 class="card-title">${t.nome}</h4>
                <p class="card-desc">${t.modalidadeNome} • <strong>${t.salaNome || 'Studio A'}</strong></p>

                <div class="card-meta-list">
                    <div class="meta-item">
                        <i class="fas fa-calendar-week"></i>
                        <span>Dias: <strong>${t.dias}</strong></span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>Horário: <strong>${t.horario}</strong></span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-users"></i>
                        <span>Alunos matriculados: <strong>${t.ocupadas || 0}</strong></span>
                    </div>
                </div>

                <button class="btn-vibe-primary" style="width: 100%;" onclick="abrirChamadaTurma(${t.id})">
                    <i class="fas fa-user-check"></i> Iniciar Chamada Desta Turma
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function abrirChamadaTurma(turmaId) {
    const select = document.getElementById('select-turma-chamada');
    if (select) select.value = turmaId;
    trocarAbaDocente('chamada', null);
    carregarListaChamada();
}
window.abrirChamadaTurma = abrirChamadaTurma;

/**
 * Preenche os selects com as turmas do professor
 */
function popularSelectsTurma(user) {
    const todasTurmas = window.VibeStore.getTurmas();
    const turmas = todasTurmas.filter(t => t.professorId === user.id || user.perfil === 'ADMINISTRADOR');

    const selectChamada = document.getElementById('select-turma-chamada');
    const selectComunicado = document.getElementById('comunicado-turma-select');

    const optionsHtml = turmas.map(t => `<option value="${t.id}">${t.nome} (${t.dias})</option>`).join('');

    if (selectChamada) selectChamada.innerHTML = optionsHtml;
    if (selectComunicado) selectComunicado.innerHTML = optionsHtml;
}

/**
 * Carrega a lista de alunos da turma selecionada para a Chamada Virtual
 */
function carregarListaChamada() {
    const selectTurma = document.getElementById('select-turma-chamada');
    const inputData = document.getElementById('input-data-chamada');
    const tbody = document.getElementById('tabela-alunos-chamada');
    const tituloTurma = document.getElementById('titulo-chamada-turma');

    if (!selectTurma || !tbody) return;

    const turmaId = Number(selectTurma.value);
    const data = inputData ? inputData.value : new Date().toISOString().split('T')[0];

    const turma = window.VibeStore.getTurmas().find(t => t.id === turmaId);
    if (turma && tituloTurma) {
        tituloTurma.textContent = `Lista de Presença: ${turma.nome}`;
    }

    const alunos = window.VibeStore.getAlunosDaTurma(turmaId);
    const presencasGravadas = window.VibeStore.getPresencas(turmaId, data);

    tbody.innerHTML = '';
    chamadaEstadoAtual = [];

    if (alunos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Nenhum aluno matriculado nesta turma ainda.
                </td>
            </tr>
        `;
        atualizarTaxaPresenca();
        return;
    }

    alunos.forEach(aluno => {
        // Verifica se já havia registro de presença salvo
        const gravado = presencasGravadas.find(p => p.alunoId === aluno.id);
        const presente = gravado ? gravado.presente : true; // Por padrão, presente

        chamadaEstadoAtual.push({ alunoId: aluno.id, presente: presente });

        // Consulta de status financeiro e liberação de acesso (Regra de Negócio RBAC)
        const acessoInfo = window.VibeStore.getStatusAcessoAluno(aluno.id, turmaId);

        let badgeAcessoHtml = '';
        if (acessoInfo.status === 'AUTORIZADO') {
            badgeAcessoHtml = `<span class="badge badge-green" title="Pagamento confirmado"><i class="fas fa-check-circle"></i> Acesso Autorizado</span>`;
        } else if (acessoInfo.status === 'EM_ANALISE') {
            badgeAcessoHtml = `<span class="badge badge-amber" title="Comprovante anexado aguardando ADM"><i class="fas fa-hourglass-half"></i> Em Análise</span>`;
        } else if (acessoInfo.status === 'BLOQUEADO') {
            badgeAcessoHtml = `<span class="badge badge-red" title="Mensalidade vencida sem quitação"><i class="fas fa-ban"></i> Acesso Bloqueado</span>`;
        } else {
            badgeAcessoHtml = `<span class="badge badge-cyan" title="Dentro do prazo de vencimento"><i class="fas fa-clock"></i> Tolerância</span>`;
        }

        let comprovanteHtml = `<span style="color: var(--text-dim); font-size: 0.8rem;">-</span>`;
        if (acessoInfo.pagamento && acessoInfo.pagamento.comprovanteUrl) {
            comprovanteHtml = `
                <button class="btn-vibe-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="abrirModalComprovanteProf(${aluno.id}, ${turmaId})">
                    <i class="fas fa-receipt"></i> Ver Comprovante
                </button>
            `;
        }

        const tr = document.createElement('tr');
        tr.id = `row-aluno-${aluno.id}`;

        const initials = aluno.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="user-avatar-circle" style="width: 34px; height: 34px; font-size: 0.8rem;">${initials}</div>
                    <div>
                        <strong style="color: #fff;">${aluno.nome}</strong>
                        ${!acessoInfo.autorizado && acessoInfo.status === 'BLOQUEADO' ? '<div style="font-size: 0.72rem; color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Inadimplente</div>' : ''}
                    </div>
                </div>
            </td>
            <td>${aluno.email}</td>
            <td>${badgeAcessoHtml}</td>
            <td style="text-align: center;">${comprovanteHtml}</td>
            <td style="text-align: center;">
                <div class="attendance-toggle-group">
                    <button type="button" class="attendance-chip btn-presente ${presente ? 'active' : ''}" onclick="togglePresenca(${aluno.id}, true)">
                        <i class="fas fa-check"></i> Presente
                    </button>
                    <button type="button" class="attendance-chip btn-ausente ${!presente ? 'active' : ''}" onclick="togglePresenca(${aluno.id}, false)">
                        <i class="fas fa-times"></i> Ausente
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    atualizarTaxaPresenca();
}
window.carregarListaChamada = carregarListaChamada;

function abrirModalComprovanteProf(alunoId, turmaId) {
    const aluno = window.VibeStore.getUsuarios().find(u => u.id === Number(alunoId));
    const acessoInfo = window.VibeStore.getStatusAcessoAluno(alunoId, turmaId);

    if (!acessoInfo || !acessoInfo.pagamento) {
        window.VibeUI.showToast('Nenhum comprovante anexado para este aluno.', 'warning');
        return;
    }

    const pagamento = acessoInfo.pagamento;
    const fatura = acessoInfo.fatura;

    const nomeEl = document.getElementById('modal-prof-aluno-nome');
    const tituloEl = document.getElementById('modal-prof-fatura-titulo');
    const imgEl = document.getElementById('modal-prof-comprovante-img');
    const badgeEl = document.getElementById('modal-prof-status-badge');
    const dataEl = document.getElementById('modal-prof-data-envio');

    if (nomeEl) nomeEl.textContent = aluno ? aluno.nome : 'Aluno Vibe';
    if (tituloEl) tituloEl.textContent = fatura ? fatura.titulo : 'Mensalidade da Turma';
    if (imgEl) imgEl.src = pagamento.comprovanteUrl || 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600';
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="badge ${acessoInfo.badgeClass}"><i class="fas ${acessoInfo.icon}"></i> ${acessoInfo.label}</span>`;
    }
    if (dataEl) {
        dataEl.textContent = pagamento.dataEnvio ? new Date(pagamento.dataEnvio).toLocaleString('pt-BR') : '16/09/2026';
    }

    window.VibeUI.openModal('modal-ver-comprovante-prof');
}
window.abrirModalComprovanteProf = abrirModalComprovanteProf;

/**
 * Altera a presença de um aluno individual
 */
function togglePresenca(alunoId, isPresente) {
    const item = chamadaEstadoAtual.find(c => c.alunoId === alunoId);
    if (item) {
        item.presente = isPresente;
    }

    const row = document.getElementById(`row-aluno-${alunoId}`);
    if (row) {
        const btnP = row.querySelector('.btn-presente');
        const btnA = row.querySelector('.btn-ausente');
        if (isPresente) {
            btnP.classList.add('active');
            btnA.classList.remove('active');
        } else {
            btnP.classList.remove('active');
            btnA.classList.add('active');
        }
    }

    atualizarTaxaPresenca();
}
window.togglePresenca = togglePresenca;

/**
 * Marca todos como presentes ou ausentes
 */
function marcarTodos(isPresente) {
    chamadaEstadoAtual.forEach(item => {
        item.presente = isPresente;
        const row = document.getElementById(`row-aluno-${item.alunoId}`);
        if (row) {
            const btnP = row.querySelector('.btn-presente');
            const btnA = row.querySelector('.btn-ausente');
            if (isPresente) {
                btnP.classList.add('active');
                btnA.classList.remove('active');
            } else {
                btnP.classList.remove('active');
                btnA.classList.add('active');
            }
        }
    });
    atualizarTaxaPresenca();
    window.VibeUI.showToast('Todos os alunos foram marcados como presentes!', 'info');
}
window.marcarTodos = marcarTodos;

function atualizarTaxaPresenca() {
    const total = chamadaEstadoAtual.length;
    const presentes = chamadaEstadoAtual.filter(c => c.presente).length;
    const taxa = total > 0 ? Math.round((presentes / total) * 100) : 100;

    const label = document.getElementById('taxa-presenca-rotulo');
    if (label) {
        label.textContent = `${taxa}%`;
        label.style.color = taxa >= 80 ? 'var(--neon-emerald)' : 'var(--neon-pink)';
    }
}

/**
 * Salva a Chamada Virtual no LocalStorage / State
 */
function salvarChamadaVirtual() {
    const selectTurma = document.getElementById('select-turma-chamada');
    const inputData = document.getElementById('input-data-chamada');

    if (!selectTurma || chamadaEstadoAtual.length === 0) {
        window.VibeUI.showToast('Nenhum aluno para registrar chamada.', 'error');
        return;
    }

    const turmaId = Number(selectTurma.value);
    const data = inputData.value;

    window.VibeStore.salvarPresencaBatch(turmaId, data, chamadaEstadoAtual);
    window.VibeUI.showToast(`Chamada virtual salva com sucesso para ${data}!`, 'success');
}
window.salvarChamadaVirtual = salvarChamadaVirtual;

/**
 * Salva e publica novo comunicado ou música
 */
function salvarNovoComunicado(e) {
    e.preventDefault();

    const user = window.VibeAuth.getUser();
    const turmaId = Number(document.getElementById('comunicado-turma-select').value);
    const titulo = document.getElementById('comunicado-titulo').value.trim();
    const conteudo = document.getElementById('comunicado-conteudo').value.trim();
    const link = document.getElementById('comunicado-link').value.trim();
    const urgente = document.getElementById('comunicado-urgente').checked;

    window.VibeStore.salvarComunicado({
        turmaId,
        professorId: user.id,
        professorNome: user.nome,
        titulo,
        conteudo,
        link,
        urgente
    });

    // Se tiver link com spotify ou música, também adiciona aos materiais da turma
    if (link) {
        window.VibeStore.salvarMaterial({
            turmaId,
            professorId: user.id,
            titulo: titulo,
            tipo: link.includes('spotify') ? 'PLAYLIST' : 'VIDEO_COREOGRAFIA',
            url: link,
            descricao: conteudo,
            duracao: 'Atualizado hoje'
        });
    }

    window.VibeUI.showToast('Comunicado e materiais enviados para a turma com sucesso!', 'success');
    document.getElementById('form-novo-comunicado').reset();
    renderizarMuralComunicados(user);
}

function renderizarMuralComunicados(user) {
    const container = document.getElementById('container-lista-comunicados');
    if (!container) return;

    const comunicados = window.VibeStore.getComunicados();
    container.innerHTML = '';

    if (comunicados.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
                Nenhum comunicado publicado ainda.
            </div>
        `;
        return;
    }

    comunicados.forEach(c => {
        const item = document.createElement('div');
        item.className = 'glass-panel';
        item.style.padding = '18px 22px';

        const linkHtml = c.link ? `
            <div style="margin-top: 12px;">
                <a href="${c.link}" target="_blank" class="btn-vibe-outline" style="font-size: 0.8rem; text-decoration: none;">
                    <i class="fas fa-link"></i> Acessar Anexo / Playlist
                </a>
            </div>
        ` : '';

        const badgeUrgente = c.urgente 
            ? '<span class="badge badge-pink" style="margin-bottom: 6px;"><i class="fas fa-fire"></i> Destaque</span>' 
            : '';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                    ${badgeUrgente}
                    <h4 style="color: #fff; font-size: 1.05rem; font-family: var(--font-heading);">${c.titulo}</h4>
                </div>
                <span style="font-size: 0.78rem; color: var(--text-dim);">${c.data || 'Hoje'}</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5;">${c.conteudo}</p>
            ${linkHtml}
        `;
        container.appendChild(item);
    });
}
