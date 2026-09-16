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
    renderizarFaturasAluno(user.id);
    atualizarStatusAcessoTopo(user.id);
    renderizarMateriais();
    renderizarHistorico(user.id);
    renderizarTodasTurmas(user.id);

    // Sincronização em tempo real (quando admin aprova ou há mudanças em qualquer aba)
    if (window.VibeStore && typeof window.VibeStore.onSync === 'function') {
        window.VibeStore.onSync(() => {
            renderizarFaturasAluno(user.id);
            atualizarStatusAcessoTopo(user.id);
        });
    }
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
    } else {
        const correspondingBtn = document.getElementById(`tab-btn-${tabId}`);
        if (correspondingBtn) correspondingBtn.classList.add('active');
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

// =========================================================================
// --- MÓDULO DO ALUNO: GESTÃO DE FATURAS, PAGAMENTOS E COMPROVANTES ---
// =========================================================================

let faturaSelecionadaPix = null;
let comprovanteBase64Temp = null;

function atualizarStatusAcessoTopo(alunoId) {
    const statusInfo = window.VibeStore.getStatusAcessoAluno(alunoId);
    const pill = document.getElementById('aluno-access-badge-pill');
    const textEl = document.getElementById('aluno-access-badge-text');
    const iconEl = document.getElementById('aluno-access-icon');
    const cardStatus = document.getElementById('status-acesso-fatura-card');

    if (pill && textEl && iconEl) {
        textEl.textContent = statusInfo.label;
        iconEl.className = `fas ${statusInfo.icon}`;
        
        if (statusInfo.status === 'AUTORIZADO') {
            pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            pill.style.background = 'rgba(16, 185, 129, 0.12)';
            textEl.style.color = 'var(--neon-emerald)';
            iconEl.style.color = 'var(--neon-emerald)';
        } else if (statusInfo.status === 'EM_ANALISE') {
            pill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            pill.style.background = 'rgba(245, 158, 11, 0.12)';
            textEl.style.color = 'var(--neon-amber)';
            iconEl.style.color = 'var(--neon-amber)';
        } else if (statusInfo.status === 'BLOQUEADO') {
            pill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            pill.style.background = 'rgba(239, 68, 68, 0.12)';
            textEl.style.color = '#ef4444';
            iconEl.style.color = '#ef4444';
        } else {
            pill.style.borderColor = 'rgba(6, 182, 212, 0.4)';
            pill.style.background = 'rgba(6, 182, 212, 0.12)';
            textEl.style.color = 'var(--neon-cyan)';
            iconEl.style.color = 'var(--neon-cyan)';
        }
    }

    if (cardStatus) {
        cardStatus.innerHTML = `
            <span class="badge ${statusInfo.badgeClass}" style="font-size: 0.95rem; padding: 10px 18px;">
                <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
        `;
    }
}
window.atualizarStatusAcessoTopo = atualizarStatusAcessoTopo;

function renderizarFaturasAluno(alunoId) {
    const container = document.getElementById('container-faturas-aluno');
    if (!container) return;

    const faturas = window.VibeStore.getFaturas(alunoId);
    container.innerHTML = '';

    // Atualiza contador de faturas pendentes na sidebar
    const pendentesCount = faturas.filter(f => f.status === 'PENDENTE' || f.status === 'VENCIDO').length;
    const badgeSide = document.getElementById('badge-faturas-pendentes');
    if (badgeSide) {
        if (pendentesCount > 0) {
            badgeSide.textContent = `${pendentesCount} pendente(s)`;
            badgeSide.style.display = 'inline-block';
        } else {
            badgeSide.style.display = 'none';
        }
    }

    if (faturas.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 40px; text-align: center; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <i class="fas fa-receipt" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h3 style="color: #fff;">Nenhuma fatura em aberto</h3>
                <p style="color: var(--text-muted);">Suas cobranças e histórico aparecerão aqui quando você estiver matriculado em uma turma ativa.</p>
            </div>
        `;
        return;
    }

    faturas.forEach(fatura => {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        let badgeStatus = '';
        let botoesAcao = '';

        const pagamento = window.VibeStore.getPagamentoByFatura(fatura.id);

        if (fatura.status === 'CONFIRMADO') {
            badgeStatus = `<span class="badge badge-green"><i class="fas fa-check-circle"></i> Confirmado</span>`;
            botoesAcao = `
                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;" onclick="verComprovanteAluno(${fatura.id})">
                        <i class="fas fa-file-invoice"></i> Ver Recibo / Comprovante
                    </button>
                </div>
            `;
        } else if (fatura.status === 'EM_ANALISE') {
            badgeStatus = `<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>`;
            botoesAcao = `
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;" onclick="verComprovanteAluno(${fatura.id})">
                        <i class="fas fa-eye"></i> Visualizar Comprovante Enviado
                    </button>
                    <span style="font-size: 0.78rem; color: var(--text-muted); text-align: center;">Aguardando aprovação do administrador</span>
                </div>
            `;
        } else if (fatura.status === 'VENCIDO') {
            badgeStatus = `<span class="badge badge-red"><i class="fas fa-exclamation-triangle"></i> Vencido</span>`;
            botoesAcao = `
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn-vibe-primary" style="width: 100%; font-size: 0.84rem; background: var(--grad-sunset);" onclick="abrirModalPix(${fatura.id})">
                        <i class="fab fa-pix"></i> Pagar Agora via PIX
                    </button>
                    <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;" onclick="abrirModalUploadComprovante(${fatura.id})">
                        <i class="fas fa-upload"></i> Anexar Comprovante Manual
                    </button>
                </div>
            `;
        } else {
            // PENDENTE
            badgeStatus = `<span class="badge badge-cyan"><i class="fas fa-clock"></i> Pendente</span>`;
            botoesAcao = `
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn-vibe-primary" style="width: 100%; font-size: 0.84rem;" onclick="abrirModalPix(${fatura.id})">
                        <i class="fab fa-pix"></i> Pagar via Pix Instantâneo
                    </button>
                    <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;" onclick="abrirModalUploadComprovante(${fatura.id})">
                        <i class="fas fa-upload"></i> Anexar Comprovante
                    </button>
                </div>
            `;
        }

        const dataVencFormatada = fatura.dataVencimento ? fatura.dataVencimento.split('-').reverse().join('/') : '-';
        const valorFormatado = Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span class="class-time-tag">
                        <i class="fas fa-calendar-alt"></i> Vencimento: ${dataVencFormatada}
                    </span>
                    ${badgeStatus}
                </div>

                <h3 style="color: #fff; font-size: 1.15rem; font-family: var(--font-heading); margin-bottom: 6px;">
                    ${fatura.titulo}
                </h3>
                <p style="color: var(--neon-cyan); font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">
                    <i class="fas fa-layer-group"></i> ${fatura.turmaNome || 'Assinatura Mensal Geral'}
                </p>

                <div style="background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-size: 0.82rem; color: var(--text-muted);">Valor Total:</span>
                        <span style="font-size: 1.35rem; font-weight: 800; color: #fff; font-family: var(--font-heading);">${valorFormatado}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
                        <span>Mês de Referência:</span>
                        <strong style="color: var(--text-secondary);">${fatura.mesReferencia}</strong>
                    </div>
                </div>
            </div>

            ${botoesAcao}
        `;

        container.appendChild(card);
    });
}
window.renderizarFaturasAluno = renderizarFaturasAluno;

function abrirModalPix(faturaId) {
    const fatura = window.VibeStore.getFaturaById(faturaId);
    if (!fatura) return;

    faturaSelecionadaPix = fatura;

    const tituloEl = document.getElementById('modal-pix-fatura-titulo');
    const valorEl = document.getElementById('modal-pix-valor');
    const copiacolaEl = document.getElementById('modal-pix-copiacola');
    const qrEl = document.getElementById('modal-pix-qrcode');

    const valorFormatado = Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (tituloEl) tituloEl.textContent = fatura.titulo;
    if (valorEl) valorEl.textContent = valorFormatado;
    if (copiacolaEl) copiacolaEl.value = fatura.pixCopiaCola || `00020126580014br.gov.bcb.pix0136vibedance-${fatura.id}-${fatura.valor}`;
    if (qrEl) {
        qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(copiacolaEl.value)}`;
    }

    window.VibeUI.openModal('modal-pix');
}
window.abrirModalPix = abrirModalPix;

function copiarPixChave() {
    const input = document.getElementById('modal-pix-copiacola');
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value).then(() => {
            window.VibeUI.showToast('Código PIX Copia-e-Cola copiado para a área de transferência!', 'success');
        }).catch(() => {
            document.execCommand('copy');
            window.VibeUI.showToast('Código PIX copiado com sucesso!', 'success');
        });
    }
}
window.copiarPixChave = copiarPixChave;

function confirmarSimulacaoPix() {
    if (!faturaSelecionadaPix) return;

    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    const alunoId = user ? user.id : faturaSelecionadaPix.alunoId;

    const btn = document.getElementById('btn-simular-pix');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processando no Banco Central...`;
    }

    setTimeout(() => {
        const res = window.VibeStore.simularPagamentoPix(faturaSelecionadaPix.id, alunoId);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-check-circle"></i> Simular Confirmação Bancária Instantânea`;
        }

        window.VibeUI.closeModal('modal-pix');

        if (res.success) {
            window.VibeUI.showToast(res.message, 'success');
            renderizarFaturasAluno(alunoId);
            atualizarStatusAcessoTopo(alunoId);
        } else {
            window.VibeUI.showToast(res.message, 'error');
        }
    }, 700);
}
window.confirmarSimulacaoPix = confirmarSimulacaoPix;

function abrirModalUploadComprovante(faturaId) {
    const fatura = window.VibeStore.getFaturaById(faturaId);
    if (!fatura) return;

    document.getElementById('modal-upload-fatura-id').value = fatura.id;
    document.getElementById('modal-upload-titulo').textContent = `${fatura.titulo} - ${Number(fatura.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    document.getElementById('label-arquivo-selecionado').textContent = 'Clique para selecionar o comprovante';
    document.getElementById('input-arquivo-comprovante').value = '';
    document.getElementById('comprovante-obs').value = '';
    comprovanteBase64Temp = null;

    window.VibeUI.openModal('modal-upload-comprovante');
}
window.abrirModalUploadComprovante = abrirModalUploadComprovante;

function arquivoSelecionadoHandler(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        document.getElementById('label-arquivo-selecionado').innerHTML = `
            <span style="color: var(--neon-emerald); font-weight: 700;">
                <i class="fas fa-check-circle"></i> ${file.name}
            </span>
            <br><small style="color: var(--text-muted); font-size: 0.75rem;">(${(file.size / 1024).toFixed(1)} KB)</small>
        `;

        const reader = new FileReader();
        reader.onload = function(e) {
            comprovanteBase64Temp = {
                nome: file.name,
                url: e.target.result
            };
        };
        reader.readAsDataURL(file);
    }
}
window.arquivoSelecionadoHandler = arquivoSelecionadoHandler;

function enviarComprovanteSubmit(event) {
    event.preventDefault();
    const faturaId = document.getElementById('modal-upload-fatura-id').value;
    const user = window.VibeAuth ? window.VibeAuth.getUser() : null;
    const alunoId = user ? user.id : 4;

    const filePayload = comprovanteBase64Temp || {
        nome: 'recibo_transferencia_aluno.jpg',
        url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600'
    };

    const res = window.VibeStore.enviarComprovante(faturaId, alunoId, filePayload);
    window.VibeUI.closeModal('modal-upload-comprovante');

    if (res.success) {
        window.VibeUI.showToast(res.message, 'success');
        renderizarFaturasAluno(alunoId);
        atualizarStatusAcessoTopo(alunoId);
    } else {
        window.VibeUI.showToast(res.message, 'error');
    }
}
window.enviarComprovanteSubmit = enviarComprovanteSubmit;

function verComprovanteAluno(faturaId) {
    const fatura = window.VibeStore.getFaturaById(faturaId);
    const pagamento = window.VibeStore.getPagamentoByFatura(faturaId);

    const imgEl = document.getElementById('modal-ver-comprovante-img');
    const nomeEl = document.getElementById('modal-ver-comprovante-nome');
    const statusEl = document.getElementById('modal-ver-comprovante-status');
    const dataEl = document.getElementById('modal-ver-comprovante-data');

    if (imgEl) {
        imgEl.src = (pagamento && pagamento.comprovanteUrl) ? pagamento.comprovanteUrl : 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600';
    }
    if (nomeEl) {
        nomeEl.textContent = (pagamento && pagamento.comprovanteNome) ? pagamento.comprovanteNome : 'comprovante_pagamento.pdf';
    }
    if (statusEl) {
        const st = fatura ? fatura.status : (pagamento ? pagamento.status : 'CONFIRMADO');
        if (st === 'CONFIRMADO') {
            statusEl.innerHTML = `<span class="badge badge-green"><i class="fas fa-check"></i> Pago & Confirmado</span>`;
        } else if (st === 'EM_ANALISE') {
            statusEl.innerHTML = `<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>`;
        } else {
            statusEl.innerHTML = `<span class="badge badge-cyan">${st}</span>`;
        }
    }
    if (dataEl) {
        dataEl.textContent = (pagamento && pagamento.dataEnvio) ? new Date(pagamento.dataEnvio).toLocaleString('pt-BR') : '16/09/2026';
    }

    window.VibeUI.openModal('modal-ver-comprovante');
}
window.verComprovanteAluno = verComprovanteAluno;