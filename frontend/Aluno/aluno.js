/**
 * VibeDance Aluno Controller
 * Gerenciador de aulas, playlists interativas, histórico de frequência e matrículas
 */

document.addEventListener('DOMContentLoaded', () => {
    inicializarPainelAluno();
});

function inicializarPainelAluno() {
    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    if (!user) return;

    // Saudação dinâmica
    const saudacaoEl = document.getElementById('saudacao-texto');
    if (saudacaoEl && window.VibeUI) {
        saudacaoEl.textContent = window.VibeUI.getSaudacao();
    }

    renderizarMinhasAulas(user.id);
    renderizarMateriais();
    renderizarHistorico(user.id);
    renderizarTodasTurmas(user.id);
}

/**
 * Alterna as abas internas do painel
 */
function trocarAba(tabId, btnElement) {
    document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetPanel = document.getElementById(`tab-${tabId}`);
    if (targetPanel) targetPanel.classList.add('active');

    if (btnElement) {
        btnElement.classList.add('active');
    }
}
window.trocarAba = trocarAba;

/**
 * Renderiza as turmas onde o aluno está atualmente matriculado
 */
function renderizarMinhasAulas(alunoId) {
    const container = document.getElementById('container-minhas-turmas');
    const turmas = window.VibeStore.getTurmasDoAluno(alunoId);

    // Atualiza contador nas métricas
    const countEl = document.getElementById('stat-turmas-matriculadas');
    if (countEl) countEl.textContent = turmas.length;

    if (!container) return;
    container.innerHTML = '';

    if (turmas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 40px; text-align: center; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <i class="fas fa-calendar-times" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h3 style="color: #fff;">Nenhuma turma matriculada</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Vá até a aba "Explorar Turmas" para encontrar o seu ritmo!</p>
                <button class="btn-vibe-primary" onclick="trocarAba('explorar', null)">Explorar Turmas Agora</button>
            </div>
        `;
        return;
    }

    turmas.forEach(turma => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span class="class-time-tag">
                    <i class="fas fa-calendar-day"></i> ${turma.dias}
                </span>
                <span class="badge badge-purple">${turma.nivel || 'Geral'}</span>
            </div>

            <div>
                <h3 style="color: #fff; font-size: 1.25rem; font-family: var(--font-heading); margin-bottom: 6px;">
                    ${turma.nome}
                </h3>
                <p style="color: var(--neon-pink); font-size: 0.88rem; font-weight: 600;">
                    <i class="fas fa-layer-group"></i> ${turma.modalidadeNome}
                </p>
            </div>

            <div class="card-meta-list" style="margin-bottom: 10px;">
                <div class="meta-item">
                    <i class="fas fa-user-circle"></i>
                    <span>Instrutor(a): <strong>${turma.professorNome}</strong></span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>Horário: <strong>${turma.horario}</strong></span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Sala: <strong>${turma.salaNome || 'Studio Principal'}</strong></span>
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: auto;">
                <button class="btn-vibe-primary" style="flex: 1; padding: 10px 14px; font-size: 0.88rem;" onclick="confirmarPresenca(${turma.id})">
                    <i class="fas fa-check"></i> Confirmar Presença
                </button>
                <button class="btn-vibe-secondary" style="padding: 10px 14px; font-size: 0.88rem;" onclick="trocarAba('materiais', null)">
                    <i class="fas fa-music"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function confirmarPresenca(turmaId) {
    window.VibeUI.showToast('Presença antecipada confirmada para a próxima aula! Seu professor foi notificado.', 'success');
}
window.confirmarPresenca = confirmarPresenca;

/**
 * Renderiza os Materiais de Apoio (Playlists e Vídeos)
 */
function renderizarMateriais() {
    const container = document.getElementById('container-materiais-aluno');
    const materiais = window.VibeStore.getMateriais();

    if (!container) return;
    container.innerHTML = '';

    materiais.forEach(mat => {
        const isPlaylist = mat.tipo === 'PLAYLIST';
        const card = document.createElement('div');
        card.className = isPlaylist ? 'playlist-card' : 'vibe-card';

        if (isPlaylist) {
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="badge badge-cyan"><i class="fas fa-headphones"></i> Playlist da Aula</span>
                    <div class="soundwave-visualizer">
                        <div class="soundwave-bar"></div>
                        <div class="soundwave-bar"></div>
                        <div class="soundwave-bar"></div>
                        <div class="soundwave-bar"></div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 14px; margin-top: 6px;">
                    <div class="audio-disc-icon">
                        <i class="fas fa-compact-disc"></i>
                    </div>
                    <div>
                        <h4 style="color: #fff; font-size: 1.15rem; font-family: var(--font-heading);">${mat.titulo}</h4>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${mat.faixas || '24 faixas'} • Duração: ${mat.duracao || '1h 20m'}</span>
                    </div>
                </div>

                <p style="color: var(--text-secondary); font-size: 0.86rem; line-height: 1.5; margin: 4px 0;">${mat.descricao}</p>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="${mat.url}" target="_blank" class="btn-vibe-primary" style="flex: 1; text-decoration: none; padding: 10px 14px; font-size: 0.85rem;">
                        <i class="fab fa-spotify"></i> Ouvir no Spotify
                    </a>
                    <button class="btn-vibe-secondary" onclick="abrirPlayerModal('${mat.titulo}', '${mat.descricao}', '${mat.url}')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            `;
        } else {
            // Vídeo de Coreografia
            card.innerHTML = `
                <div class="card-top-banner" style="background: linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(168, 85, 247, 0.4));">
                    <i class="fas fa-play-circle" style="font-size: 3rem; color: #fff; cursor: pointer; text-shadow: 0 0 20px rgba(0,0,0,0.5);" onclick="abrirPlayerModal('${mat.titulo}', '${mat.descricao}', '${mat.url}')"></i>
                    <span class="card-badge badge-pink">Vídeo Tutorial</span>
                </div>
                <div class="card-body">
                    <h4 class="card-title">${mat.titulo}</h4>
                    <p class="card-desc">${mat.descricao}</p>
                    <div class="card-meta-list">
                        <div class="meta-item">
                            <i class="fas fa-video"></i>
                            <span>Duração do vídeo: ${mat.duracao || '15 min'}</span>
                        </div>
                    </div>
                    <button class="btn-vibe-primary" style="width: 100%;" onclick="abrirPlayerModal('${mat.titulo}', '${mat.descricao}', '${mat.url}')">
                        <i class="fas fa-play"></i> Assistir Ensaio
                    </button>
                </div>
            `;
        }

        container.appendChild(card);
    });
}

function abrirPlayerModal(titulo, desc, url) {
    document.getElementById('modal-player-titulo').textContent = titulo;
    document.getElementById('modal-player-desc').textContent = desc;
    document.getElementById('modal-player-link').href = url;
    window.VibeUI.openModal('modal-player');
}
window.abrirPlayerModal = abrirPlayerModal;

/**
 * Renderiza o histórico de presenças do aluno
 */
function renderizarHistorico(alunoId) {
    const tbody = document.getElementById('tabela-historico-presencas');
    if (!tbody) return;

    const presencas = window.VibeStore.getPresencas().filter(p => p.alunoId === Number(alunoId));
    const turmas = window.VibeStore.getTurmas();

    tbody.innerHTML = '';

    if (presencas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Nenhum registro de frequência registrado ainda.
                </td>
            </tr>
        `;
        return;
    }

    presencas.forEach(p => {
        const turma = turmas.find(t => t.id === p.turmaId) || {};
        const tr = document.createElement('tr');
        const badge = p.presente 
            ? '<span class="badge badge-green"><i class="fas fa-check"></i> Presente</span>'
            : '<span class="badge badge-pink"><i class="fas fa-times"></i> Falta</span>';

        tr.innerHTML = `
            <td><strong>${p.data || 'Hoje'}</strong></td>
            <td style="color: #fff; font-weight: 600;">${turma.nome || 'Turma Regular'}</td>
            <td>${turma.professorNome || 'Instrutor'}</td>
            <td>${turma.horario || 'Noite'}</td>
            <td>${badge}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Renderiza todas as turmas abertas para matrícula
 */
function renderizarTodasTurmas(alunoId) {
    const container = document.getElementById('container-todas-turmas');
    if (!container) return;

    const turmas = window.VibeStore.getTurmas();
    const minhasTurmasIds = window.VibeStore.getTurmasDoAluno(alunoId).map(t => t.id);

    container.innerHTML = '';

    turmas.forEach(t => {
        const jaMatriculado = minhasTurmasIds.includes(t.id);
        const vagasRestantes = Math.max(0, (t.vagas || 25) - (t.ocupadas || 0));
        const lotada = vagasRestantes <= 0;

        const card = document.createElement('div');
        card.className = 'vibe-card';

        let botaoAcao = '';
        if (jaMatriculado) {
            botaoAcao = `<button class="btn-vibe-secondary" disabled style="width: 100%; opacity: 0.8;"><i class="fas fa-check-circle" style="color: var(--neon-emerald);"></i> Já Matriculado</button>`;
        } else if (lotada) {
            botaoAcao = `<button class="btn-vibe-secondary" disabled style="width: 100%; opacity: 0.5;"><i class="fas fa-ban"></i> Turma Lotada</button>`;
        } else {
            botaoAcao = `<button class="btn-vibe-primary" style="width: 100%;" onclick="realizarMatricula(${alunoId}, ${t.id})"><i class="fas fa-plus"></i> Matricular-se Agora</button>`;
        }

        card.innerHTML = `
            <div class="card-top-banner">
                <i class="fas fa-music banner-bg-icon"></i>
                <span class="card-badge badge-purple">${t.nivel || 'Geral'}</span>
            </div>
            <div class="card-body">
                <h4 class="card-title">${t.nome}</h4>
                <p class="card-desc">Instrutor: <strong>${t.professorNome}</strong> • Sala: ${t.salaNome || 'Studio A'}</p>

                <div class="card-meta-list">
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Dias: <strong>${t.dias}</strong></span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock"></i>
                        <span>Horário: <strong>${t.horario}</strong></span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-users"></i>
                        <span>Vagas: <strong>${vagasRestantes} disponíveis</strong> (${t.ocupadas}/${t.vagas})</span>
                    </div>
                </div>

                ${botaoAcao}
            </div>
        `;
        container.appendChild(card);
    });
}

function realizarMatricula(alunoId, turmaId) {
    const res = window.VibeStore.matricularAluno(alunoId, turmaId);
    if (res.success) {
        window.VibeUI.showToast(res.message, 'success');
        inicializarPainelAluno();
    } else {
        window.VibeUI.showToast(res.message, 'error');
    }
}
window.realizarMatricula = realizarMatricula;