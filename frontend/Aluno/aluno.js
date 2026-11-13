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

    const botaoSolicitarParticular = document.getElementById('btn-solicitar-particular');

    if (botaoSolicitarParticular) {
        botaoSolicitarParticular.disabled = false;
        botaoSolicitarParticular.onclick = solicitarAulaParticular;
    }

    // Saudação dinâmica
    const saudacaoEl = document.getElementById('saudacao-texto');
    if (saudacaoEl && window.VibeUI) {
        saudacaoEl.textContent = window.VibeUI.getSaudacao();
    }

    renderizarMinhasAulas(user.id);
    renderizarFaturasAluno(user.id);
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
    } else {
        const correspondingBtn = document.getElementById(`tab-btn-${tabId}`);
        if (correspondingBtn) correspondingBtn.classList.add('active');
    }

    if (tabId === 'particulares') {
        carregarAulasParticulares();
    }
}
window.trocarAba = trocarAba;

async function solicitarAulaParticular() {

    const modalidade = document.getElementById('particular-modalidade');
    const professor = document.getElementById('particular-professor');
    const dataHora = document.getElementById('particular-datahora');
    const duracao = document.getElementById('particular-duracao');
    const observacoes = document.getElementById('particular-observacoes');
    const botao = document.getElementById('btn-solicitar-particular');

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Sessão expirada. Faça login novamente.', 'error');
        return;
    }

    const idModalidade = Number(modalidade.value);
    const idProfessor = Number(professor.value);
    const minutos = duracao.value ? Number(duracao.value) : 60;

    if (!idModalidade || !idProfessor || !dataHora.value) {
        window.VibeUI.showToast('Preencha todos os campos obrigatórios.', 'error');
        return;
    }

    if (!Number.isInteger(minutos) || minutos < 30 || minutos > 180) {
        window.VibeUI.showToast('A duração deve ser entre 30 e 180 minutos.', 'error');
        return;
    }

    const textoOriginal = botao.textContent;

    try {
        botao.disabled = true;
        botao.textContent = 'Enviando solicitação...';

        const resposta = await fetch('/api/aluno/aulas-particulares', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                idModalidade: idModalidade,
                idProfessor: idProfessor,
                dataHora: dataHora.value + ':00',
                duracaoMinutos: minutos,
                observacoes: observacoes.value.trim()
            })
        });

        const resultado = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                resultado.erro || 'Não foi possível solicitar a aula.'
            );
        }

        window.VibeUI.showToast(
            'Aula particular solicitada com sucesso!',
            'sucess'
        );

        modalidade.value = '';
        professor.value = '';
        dataHora.value = '';
        duracao.value = '60';
        observacoes.value = '';

        await carregarAulasParticulares();

    } catch (erro) {
        console.error('Erro ao solicitar aula particular:', erro);

        window.VibeUI.showToast(
            erro.message || 'Erro ao enviar solicitação.',
            'error'
        );

    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}   

async function carregarAulasParticulares() {
    const container = document.getElementById('container-aulas-particulares');

    if (!container) return;

    container.textContent = 'Carregando agendamentos...';

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        container.textContent = 'Sessão expirada. Faça login novamente.';
        return;
    }

    try {
        const resposta = await fetch('/api/aluno/aulas-particulares', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error('Erro ao consultar agendamentos.');
        }

        const aulas = await resposta.json();

        const [resModalidades, resProfessores] = await Promise.all([
            fetch('/api/modalidades'),
            fetch('/api/aluno/professores', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            })
        ]);

        if (!resModalidades.ok || !resProfessores.ok) {
            throw new Error('Não foi possivel consultar modalidades ou professores.');
        }

        const modalidades = await resModalidades.json();
        const professores = await resProfessores.json();

        //Preenche as modalidades disponiveis
        const selectModalidade = document.getElementById('particular-modalidade');

        if (selectModalidade) {
            selectModalidade.replaceChildren(
                new Option('Selecione uma modalidade', '')
            );

            modalidades.forEach(modalidade => {
                selectModalidade.add(
                    new Option(modalidade.nome, modalidade.id)
                );
            });
        }

        //Preenche os professores ativos
        const selectProfessor = document.getElementById('particular-professor');

        if (selectProfessor) {
            selectProfessor.replaceChildren(
                new Option('Selecione um professor', '')
            );

            professores.forEach(professor => {
                selectProfessor.add(
                    new Option(professor.nome, professor.id)
                );
            });
        }

        container.innerHTML = '';

        if (aulas.length === 0) {
            container.textContent = 'Você ainda não solicitou aulas particulares.';
            return;
        }

        aulas.forEach(aula => {
            const card = document.createElement('div');
            card.className = 'particular-card';

            const statusClasse = {
                SOLICITADO: 'status-solicitado',
                CONFIRMADO: 'status-confirmado',
                CONCLUIDO: 'status-concluido',
                CANCELADO: 'status-cancelado'
            }[aula.status] || 'status-solicitado';

            const dataFormatada = new Date(aula.dataHora).toLocaleString('pt-br', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            card.innerHTML = `
                <div class="particular-topo">
                    <div>
                        <h3>Aula Particular #${aula.id}</h3>
                        <div class="particular-subtitulo">Agendamento individual</div>
                    </div>
                    <span class="particular-status ${statusClasse}">${aula.status}</span>
                </div>

                <div class="particular-grid">
                    <div class="particular-info">
                        <span>Modalidade</span>
                        <strong class="nome-modalidade"></strong>
                    </div>

                    <div class="particular-info">
                        <span>Professor</span>
                        <strong class="nome-professor"></strong>
                    </div>

                    <div class="particular-info">
                        <span>Data e horário</span>
                        <strong>${dataFormatada}</strong>
                    </div>

                    <div class="particular-info">
                        <span>Duração</span>
                        <strong>${aula.duracaoMinutos} min</strong>
                    </div>
                </div>
            `;

            if (aula.observacoes) {
                const observacao = document.createElement('div');
                observacao.className = 'particular-observacao';

                const titulo = document.createElement('strong');
                titulo.textContent = 'Observações:';

                observacao.appendChild(titulo);
                observacao.appendChild(document.createElement('br'));
                observacao.appendChild(
                    document.createTextNode(aula.observacoes)
                );

                card.appendChild(observacao);
            }

            const modalidade = modalidades.find(
                m => Number(m.id) === Number(aula.idModalidade)
            );

            const professor = professores.find(
                p => Number(p.id) === Number(aula.idProfessor)
            );

            card.querySelector('.nome-modalidade').textContent =
                modalidade?.nome || 'Modalidade não encontrada';

            card.querySelector('.nome-professor').textContent =
                aula.idProfessor == null
                    ? 'A definir.'
                    : (professor?.nome || 'professor não encontrado.');

            
            container.appendChild(card);
        });

    } catch (erro) {
        console.error('Erro nas aulas particulares:', erro);
        container.textContent = 'Não foi possível carregar os agendamentos.';
    }
}

/**
 * Renderiza as turmas onde o aluno está atualmente matriculado
 */
async function renderizarMinhasAulas(alunoId) {
    const container = document.getElementById('container-minhas-turmas');
    let turmas = [];

    try {
        const token = sessionStorage.getItem('vibedance_token');

        if (!token) {
            throw new Error('Sessao expirada. Faca login novamente.');
        }

        const headers = {
            'Authorization': 'Bearer ' + token
        };

        const [resTurmas, resMatriculas, resProfessores] = await Promise.all([
            fetch('/api/turmas'),
            fetch('/api/aluno/matriculas', { headers }),
            fetch('/api/aluno/professores', { headers })
        ]);

        if (!resTurmas.ok || !resMatriculas.ok || !resProfessores.ok) {
            throw new Error('Nao foi possivel consultar o backend.');
        }

        const todasTurmas = await resTurmas.json();
        const matriculas = await resMatriculas.json();
        const professores = await resProfessores.json();

        turmas = matriculas
            .filter(m => m.status === 'ATIVA' && Number(m.idAluno) === Number(alunoId))
            .map(m => {
                const t = todasTurmas.find(t => Number(t.id) === Number(m.idTurma));

                if (!t) return null;

                return {
                    id: t.id,
                    idMatricula: m.id,
                    nome: t.nomeTurma,
                    modalidadeNome: t.modalidade?.nome || 'Nao informada',
                    dias: t.diasSemana,
                    nivel: ({
                        INICIANTE: 'Iniciante',
                        INTERMEDIARIO: 'Intermediário',
                        AVANCADO: 'Avançado',
                        TODOS_OS_NIVEIS: 'Todos os níveis'
                    })[String(t.nivel || '').trim().toUpperCase()] || t.nivel || 'Geral',
                    horario: (t.horario || '').slice(0, 5) + ' - ' +
                             (t.horarioFim || '').slice(0, 5),
                    professorNome: professores.find(p => Number(p.id) === Number(t.professorId))?.nome || 'Nao informado',
                    salaNome: t.salaId ? 'Sala ' + t.salaId : 'Nao informada'
                }
            })
            .filter(Boolean);
    } catch (erro) {
        console.error('Erro ao carregar matriculas:', erro);
        if (container) {
            container.textContent = 'Nao foi possivel carregar suas aulas.';
        }
        return;
    }

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

            <button class="btn-vibe-secondary"
                style="width: 100%; margin-top: 10px; padding: 10px 14px; font-size: 0.85rem;"
                onclick="cancelarMatricula(${turma.idMatricula})">
                <i class="fas fa-ban"></i> Cancelar Matricula
            </button>
        `;
        container.appendChild(card);
    });
}

function confirmarPresenca(turmaId) {
    window.VibeUI.showToast(
        'A presença será registrada pelo professor durante a chamada da aula.',
        'info'
    );
}
window.confirmarPresenca = confirmarPresenca;

async function cancelarMatricula(idMatricula) {
    const confirmou = window.confirm(
        'Tem certeza que deseja cancelar esta matricula?'
    );

    if (!confirmou) return;

    const token =sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Faca login novamente.', 'error');
        return;
    }

    try {
        const resposta = await fetch(
            `/api/aluno/matriculas/${idMatricula}/cancelar`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            window.VibeUI.showToast(
                dados.erro || 'Nao foi possivel cancelar a matricula.',
                'error'
            );
            return;
        }

        window.VibeUI.showToast(
            'Matricula cancelada com sucesso!',
            'success'
        );

        inicializarPainelAluno();

    } catch (erro) {
        console.error('Erro ao cancelar matricula:', erro);
        window.VibeUI.showToast(
            'Erro de comunicacao com o servidor.',
            'error'
        );
    }
}

window.cancelarMatricula = cancelarMatricula;

/**
 * Renderiza os Materiais de Apoio (Playlists e Vídeos)
 */
async function renderizarMateriais() {
    const container = document.getElementById('container-materiais-aluno');

    if (!container) return;

    container.innerHTML = '';

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        container.textContent = 'Faça login novamente para visualizar os materiais.';
        return;
    }

    try {
        const resposta = await fetch('/api/aluno/materiais', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar os materiais.');
        }

        const materiais = await resposta.json();

        if (materiais.length === 0) {
            container.textContent = 'Nenhum material disponível para suas turmas.';
            return;
        }

        materiais.forEach(mat => {
            const card = document.createElement('div');
            const isPlaylist = mat.tipo === 'PLAYLIST';
            const duracao = mat.duracaoMinutos
                ? `${mat.duracaoMinutos} min`
                : 'Não informada';

            card.className = isPlaylist ? 'playlist-card' : 'vibe-card';

            if (isPlaylist) {
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge badge-cyan">
                            <i class="fas fa-headphones"></i> Playlist da Aula
                        </span>
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
                            <span style="font-size: 0.8rem; color: var(--text-muted);">
                                Duração: ${duracao}
                            </span>
                        </div>
                    </div>

                    <p style="color: var(--text-secondary); font-size: 0.86rem; line-height: 1.5; margin: 4px 0;">
                        ${mat.descricao || ''}
                    </p>

                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <a href="${mat.url}" target="_blank" rel="noopener noreferrer"
                           class="btn-vibe-primary"
                           style="flex: 1; text-decoration: none; padding: 10px 14px; font-size: 0.85rem;">
                            <i class="fab fa-spotify"></i> Abrir playlist
                        </a>
                    </div>
                `;
            } else {
                const ehVideo = mat.tipo === 'VIDEO_COREOGRAFIA';
                const ehPdf = mat.tipo === 'DOCUMENTO_PDF';

                const icone = ehVideo ? 'fa-video' : ehPdf ? 'fa-file-pdf' : 'fa-external-link-alt';
                const tipoTexto = ehVideo ? 'Vídeo Tutorial' : ehPdf ? 'Documento PDF' : 'Link Externo';
                const acaoTexto = ehVideo ? 'Assistir Ensaio' : ehPdf ? 'Abrir Documento' : 'Acessar Material';

                card.innerHTML = `
                    <div class="card-top-banner" style="background: linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(168, 85, 247, 0.4));">
                        <i class="fas ${icone}" style="font-size: 3rem; color: #fff;"></i>
                        <span class="card-badge badge-pink">${tipoTexto}</span>
                    </div>
                    <div class="card-body">
                        <h4 class="card-title">${mat.titulo}</h4>
                        <p class="card-desc">${mat.descricao || ''}</p>
                        <div class="card-meta-list">
                            <div class="meta-item">
                                <i class="fas fa-clock"></i>
                                <span>Duração: ${duracao}</span>
                            </div>
                        </div>
                        <a href="${mat.url}" target="_blank" rel="noopener noreferrer"
                           class="btn-vibe-primary"
                           style="display: block; width: 100%; text-align: center; text-decoration: none;">
                            <i class="fas ${icone}"></i> ${acaoTexto}
                        </a>
                    </div>
                `;
            }

            container.appendChild(card);
        });

    } catch (erro) {
        console.error('Erro ao carregar materiais:', erro);
        container.textContent = 'Não foi possível carregar os materiais. Tente novamente.';
    }
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
async function renderizarHistorico(alunoId) {
    const tbody = document.getElementById('tabela-historico-presencas');
    if (!tbody) return;

    const token = sessionStorage.getItem('vibedance_token');

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 30px;">
                Carregando histórico de frequência...
            </td>
        </tr>
    `;

    try {
        const resposta = await fetch('/api/aluno/presencas', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar o histórico de frequência.');
        }

        const presencas = await resposta.json();

        // Atualiza o resumo mensal de aulas
        try {
            const respostaResumo = await fetch('/api/aluno/presencas/resumo', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (respostaResumo.ok) {
                const resumo = await respostaResumo.json();

                const elementoAulas = document.getElementById('stat-total-aulas');
                const elementoMeta = document.getElementById('stat-meta-aulas');

                if (elementoAulas) {
                    elementoAulas.textContent = resumo.aulasConcluidas;
                }

                if (elementoMeta) {
                    elementoMeta.textContent =
                        `Meta mensal: ${resumo.metaMensal} aulas`;
                }
            }
        } catch (erroResumo) {
            console.error('Erro ao carregar resumo mensal:', erroResumo);
        }

        const totalAulas = presencas.length;
        const totalPresencas = presencas.filter(p => p.presente).length;

        const percentual = totalAulas > 0
            ? Math.round((totalPresencas / totalAulas) * 100)
            : 0;

        const elementoPercentual = document.getElementById('frequencia-percentual');
        const elementoBarra = document.getElementById('frequencia-barra');
        const elementoDescricao = document.getElementById('frequencia-descricao');

        if (elementoPercentual) {
            elementoPercentual.textContent = percentual + '%';
        }

        if (elementoBarra) {
            elementoBarra.style.width = percentual + '%';
        }

        if (elementoDescricao) {
            elementoDescricao.textContent =
                `${totalPresencas} presenças em ${totalAulas} aulas registradas`;
        }

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
            const tr = document.createElement('tr');

            const badge = p.presente
                ? '<span class="badge badge-green"><i class="fas fa-check"></i> Presente</span>'
                : '<span class="badge badge-pink"><i class="fas fa-times"></i> Falta</span>';

            tr.innerHTML = `
                <td><strong>${p.data || 'Hoje'}</strong></td>
                <td style="color: #fff; font-weight: 600;">${p.turmaNome || 'Turma Regular'}</td>
                <td>${p.professorNome || 'Instrutor'}</td>
                <td>${p.horario || 'Noite'}</td>
                <td>${badge}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (erro) {
        console.error('Erro ao carregar histórico:', erro);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Não foi possível carregar o histórico de frequência.
                </td>
            </tr>
        `;
    }
}

/**
 * Renderiza todas as turmas abertas para matrícula
 */
async function renderizarTodasTurmas(alunoId) {
    const container = document.getElementById('container-todas-turmas');
    if (!container) return;

    let turmas = [];
    let minhasTurmasIds = [];
    let turmasCanceladasIds = [];

    try {
        const token = sessionStorage.getItem('vibedance_token');

        if (!token) {
            throw new Error('Sessao nao encontrada.');
        }

        const [resTurmas, resMatriculas] = await Promise.all([
            fetch('/api/turmas'),
            fetch('/api/aluno/matriculas', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            })
        ]);

        if (!resTurmas.ok || !resMatriculas.ok) {
            throw new Error('Falha ao consultar o backend.');
        }

        const dadosTurmas = await resTurmas.json();
        const matriculas = await resMatriculas.json();

        turmas = dadosTurmas
            .filter(t => t.ativo === true)
            .map(t => ({
                id: t.id,
                nome: t.nomeTurma,
                nivel: ({
                    INICIANTE: 'Iniciante',
                    INTERMEDIARIO: 'Intermediário',
                    AVANCADO: 'Avançado',
                    TODOS_OS_NIVEIS: 'Todos os níveis'
                })[String(t.nivel || '').trim().toUpperCase()] || t.nivel || 'Geral',
                professorNome: t.professorId ? 'ID ' + t.professorId : 'Nao informado',
                salaNome: t.salaId ? 'Sala ' + t.salaId : 'Nao informada',
                dias: t.diasSemana,
                horario: (t.horario || '').slice(0, 5) + ' - ' +
                         (t.horarioFim || '').slice(0, 5),
                vagas: t.limiteVagas,
                ocupadas: t.vagasOcupadas || 0
            }));

        minhasTurmasIds = matriculas
            .filter(m => m.status === 'ATIVA')
            .map(m => Number(m.idTurma));

        turmasCanceladasIds = matriculas
            .filter(m => m.status === 'CANCELADA')
            .map(m => Number(m.idTurma));

    } catch (erro) {
        console.error('Erro ao carregar turmas:', erro);
        container.textContent = 'Nao foi possivel carregar as turmas.';
        return;
    }

    container.innerHTML = '';

    turmas.forEach(t => {
        const jaMatriculado = minhasTurmasIds.includes(t.id);
        const matriculaCancelada = turmasCanceladasIds.includes(t.id);
        const vagasRestantes = Math.max(0, (t.vagas || 25) - (t.ocupadas || 0));
        const lotada = vagasRestantes <= 0;

        const card = document.createElement('div');
        card.className = 'vibe-card';

        let botaoAcao = '';
        if (jaMatriculado) {
            botaoAcao = `<button class="btn-vibe-secondary" disabled style="width: 100%; opacity: 0.8;"><i class="fas fa-check-circle" style="color: var(--neon-emerald);"></i> Já Matriculado</button>`;
        }  else if (matriculaCancelada) {
            botaoAcao = `<button class= "btn-vibe-secondary" disabled style="width: 100%; opacity: 0.8;"><i class="fas fa-ban"></i> Matricula Cancelada</button>`;
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

async function realizarMatricula(alunoId, turmaId) {
    try {
        const token = sessionStorage.getItem('vibedance_token');

        if (!token) {
            window.VibeUI.showToast('Faca login novamente.', 'error');
            return;
        }

        const resposta = await fetch('/api/aluno/matriculas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                idTurma: turmaId
            })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            window.VibeUI.showToast('Matricula realizada com sucesso!', 'success');
            inicializarPainelAluno();
        } else {
            window.VibeUI.showToast(
                dados.erro || 'Nao foi possivel realizar a matricula.',
                'error'
            );
        }

    } catch (erro) {
        console.error('Erro ao realizar matricula:', erro);
        window.VibeUI.showToast('Erro de comunicacao com o servidor.', 'error');
    }
}
window.realizarMatricula = realizarMatricula;

// =========================================================================
// --- MÓDULO DO ALUNO: GESTÃO DE FATURAS, PAGAMENTOS E COMPROVANTES ---
// =========================================================================

let faturaSelecionadaPix = null;

function atualizarStatusAcessoTopo(faturas) {
    const fatura = Array.isArray(faturas) ? faturas[0] : null;

    let statusInfo;

    if (!fatura) {
        statusInfo = {
            status: 'AUTORIZADO',
            label: 'Acesso Liberado (Cortesia/Trial)',
            badgeClass: 'badge-green',
            icon: 'fa-check-circle'
        };
    } else if (fatura.status === 'CONFIRMADO') {
        statusInfo = {
            status: 'AUTORIZADO',
            label: 'Acesso Autorizado',
            badgeClass: 'badge-green',
            icon: 'fa-check-circle'
        };
    } else if (fatura.status === 'EM_ANALISE') {
        statusInfo = {
            status: 'EM_ANALISE',
            label: 'Comprovante em Análise',
            badgeClass: 'badge-amber',
            icon: 'fa-hourglass-half'
        };
    } else if (fatura.status === 'VENCIDO') {
        statusInfo = {
            status: 'BLOQUEADO',
            label: 'Acesso Bloqueado (Vencido)',
            badgeClass: 'badge-red',
            icon: 'fa-ban'
        };
    } else {
        statusInfo = {
            status: 'PENDENTE',
            label: 'Acesso Tolerância (Pendente)',
            badgeClass: 'badge-cyan',
            icon: 'fa-clock'
        };
    }

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

    atualizarStatusAcessoTopo(faturas);

    if (cardStatus) {
        cardStatus.innerHTML = `
            <span class="badge ${statusInfo.badgeClass}" style="font-size: 0.95rem; padding: 10px 18px;">
                <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
        `;
    }
}

window.atualizarStatusAcessoTopo = atualizarStatusAcessoTopo;

async function renderizarFaturasAluno(alunoId) {
    const container = document.getElementById('container-faturas-aluno');
    if (!container) return;

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        container.innerHTML = '<p>Faça login novamente para consultar suas faturas.</p>';
        return;
    }

    try {
        const headers = {
            'Authorization': 'Bearer ' + token
        };

        // Busca as faturas e os pagamentos reais do aluno
        const [respostaFaturas, respostaPagamentos] = await Promise.all([
            fetch('/api/aluno/faturas', { headers }),
            fetch('/api/aluno/pagamentos', { headers })
        ]);

        if (!respostaFaturas.ok || !respostaPagamentos.ok) {
            throw new Error('Não foi possível carregar os dados financeiros.');
        }

        const faturas = await respostaFaturas.json();
        const pagamentos = await respostaPagamentos.json();

        container.innerHTML = '';

        // Atualiza contador de faturas pendentes
        const pendentesCount = faturas.filter(f =>
            f.status === 'PENDENTE' || f.status === 'VENCIDO'
        ).length;

        const badgeSide = document.getElementById('badge-faturas-pendentes');

        if (badgeSide) {
            badgeSide.textContent = `${pendentesCount} pendente(s)`;
            badgeSide.style.display = pendentesCount > 0 ? 'inline-block' : 'none';
        }

        if (faturas.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 40px; text-align: center; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                    <i class="fas fa-receipt" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px;"></i>
                    <h3 style="color: #fff;">Nenhuma fatura encontrada</h3>
                    <p style="color: var(--text-muted);">Suas cobranças aparecerão aqui.</p>
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

            // Procura o pagamento mais recente que possui comprovante
            const pagamentosFatura = pagamentos.filter(p =>
                String(p.idFatura) === String(fatura.id)
            );

            const pagamento = pagamentosFatura.find(p =>
                p.possuiComprovante
            );

            // Se existe comprovante, mostra a opção de visualização
            if (pagamento) {
                if (pagamento.status === 'CONFIRMADO') {
                    badgeStatus = '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Confirmado</span>';
                } else if (pagamento.status === 'EM_ANALISE') {
                    badgeStatus = '<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>';
                } else {
                    badgeStatus = `<span class="badge badge-cyan">${fatura.status}</span>`;
                }

                botoesAcao = `
                    <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;" onclick="verComprovanteAluno(${fatura.id})">
                            <i class="fas fa-eye"></i> Visualizar Comprovante Enviado
                        </button>
                        ${pagamento.status === 'EM_ANALISE'
                            ? '<span style="font-size: 0.78rem; color: var(--text-muted); text-align: center;">Aguardando aprovação do administrador</span>'
                            : ''}
                    </div>
                `;
            } else if (fatura.status === 'CONFIRMADO') {
                badgeStatus = '<span class="badge badge-green"><i class="fas fa-check-circle"></i> Confirmado</span>';
                botoesAcao = '<p style="margin-top: 16px; color: var(--text-muted); text-align: center;">Pagamento confirmado.</p>';
            } else if (fatura.status === 'EM_ANALISE') {
                badgeStatus = '<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>';
                botoesAcao = '<p style="margin-top: 16px; color: var(--text-muted); text-align: center;">Pagamento aguardando análise.</p>';
            
            } else if (fatura.status === 'VENCIDO') {
                badgeStatus = '<span class="badge badge-red"><i class="fas fa-exclamation-triangle"></i> Vencido</span>';
                botoesAcao = `
                    <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn-vibe-primary" style="width: 100%;"
                                onclick="abrirModalPix(${fatura.id})">
                            <i class="fas fa-credit-card"></i> Pagar Online
                        </button>
                        <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;"
                                onclick="abrirModalUploadComprovante(${fatura.id})">
                            <i class="fas fa-upload"></i> Anexar Comprovante Manual
                        </button>
                    </div>
                `;
            } else {
                badgeStatus = '<span class="badge badge-cyan"><i class="fas fa-clock"></i> Pendente</span>';
                botoesAcao = `
                    <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn-vibe-primary" style="width: 100%;"
                                onclick="abrirModalPix(${fatura.id})">
                            <i class="fas fa-credit-card"></i> Pagar Online
                        </button>
                        <button class="btn-vibe-secondary" style="width: 100%; font-size: 0.84rem;"
                                onclick="abrirModalUploadComprovante(${fatura.id})">
                            <i class="fas fa-upload"></i> Anexar Comprovante
                        </button>
                    </div>
                `;
            }


            const dataVencFormatada = fatura.dataVencimento
                ? fatura.dataVencimento.split('-').reverse().join('/')
                : '-';

            const valorFormatado = Number(fatura.valor).toLocaleString(
                'pt-BR',
                { style: 'currency', currency: 'BRL' }
            );

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <span class="class-time-tag">
                            <i class="fas fa-calendar-alt"></i> Vencimento: ${dataVencFormatada}
                        </span>
                        ${badgeStatus}
                    </div>

                    <h3 style="color: #fff; font-size: 1.15rem; font-family: var(--font-heading); margin-bottom: 6px;">
                        ${fatura.titulo || 'Fatura'}
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
                            <strong style="color: var(--text-secondary);">${fatura.mesReferencia || '-'}</strong>
                        </div>
                    </div>
                </div>

                ${botoesAcao}
            `;

            container.appendChild(card);
        });

    } catch (erro) {
        console.error('Erro ao carregar faturas:', erro);
        container.innerHTML = `
            <p style="color: var(--neon-pink); text-align: center;">
                ${erro.message}
            </p>
        `;
    }
}

window.renderizarFaturasAluno = renderizarFaturasAluno;


let paymentBrickController = null;

async function inicializarPaymentBrick(fatura, token) {
    const container = document.getElementById('paymentBrick_container');
    const resultadoElemento = document.getElementById('resultado-pagamento');

    container.innerHTML = '';
    container.style.display = 'block';
    resultadoElemento.style.display = 'none';

    const respostaConfig = await fetch(
        '/api/aluno/pagamentos/configuracao',
        {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }
    );

    if (respostaConfig.status === 503) {
        throw new Error(
            'Pagamento online temporariamente indisponível. As credenciais do Mercado Pago ainda não foram configuradas. Utilize o envio de comprovante.'
        );
    }

    if (!respostaConfig.ok) {
        throw new Error('Erro ao consultar a configuração do pagamento.');
    }

    const configuracao = await respostaConfig.json();

    if (!configuracao.publicKey) {
        throw new Error(
            'Pagamento online indisponível. Utilize o envio de comprovante.'
        );
    }

    if (typeof MercadoPago === 'undefined') {
        throw new Error('A biblioteca do Mercado Pago não foi carregada.');
    }

    const mp = new MercadoPago(configuracao.publicKey);
    const bricksBuilder = mp.bricks();

    const settings = {
        initialization: {
            amount: Number(fatura.valor)
        },

        locale: 'pt-BR',

        customization: {
            paymentMethods: {
                creditCard: 'all',
                bankTransfer: 'pix'
            }
        },

        callbacks: {
            onReady: () => {
                console.log('Payment Brick carregado.');
            },

            onError: (erro) => {
                console.error('Erro no Payment Brick:', erro);
            },

            onSubmit: async ({ selectedPaymentMethod, formData }) => {
                try {
                    const metodo = (
                        selectedPaymentMethod === 'bank_transfer'
                        || formData.payment_method_id === 'pix'
                    )
                        ? 'pix'
                        : formData.payment_method_id;

                    if (!metodo) {
                        throw new Error('Meio de pagamento não identificado.');
                    }

                    const dadosPagamento = {
                        idFatura: fatura.id,
                        token: formData.token || null,
                        payment_method_id: metodo,
                        installments: formData.installments
                            ? Number(formData.installments)
                            : null,
                        issuer_id: formData.issuer_id
                            ? Number(formData.issuer_id)
                            : null
                    };

                    const resposta = await fetch(
                        '/api/aluno/pagamentos/online',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify(dadosPagamento)
                        }
                    );

                    const pagamento = await resposta.json();

                    if (!resposta.ok) {
                        throw new Error(
                            pagamento.erro || 'Não foi possível processar o pagamento.'
                        );
                    }

                    container.style.display = 'none';
                    resultadoElemento.style.display = 'block';

                    const titulo = document.getElementById(
                        'resultado-pagamento-titulo'
                    );

                    const imagem = document.getElementById(
                        'resultado-pix-qrcode'
                    );

                    const areaCopia = document.getElementById(
                        'resultado-pix-copiacola'
                    );

                    const campoCopia = document.getElementById(
                        'modal-pix-copiacola'
                    );

                    const mensagem = document.getElementById(
                        'resultado-pagamento-mensagem'
                    );

                    imagem.style.display = 'none';
                    areaCopia.style.display = 'none';
                    campoCopia.value = '';

                    if (metodo === 'pix') {
                        titulo.textContent = 'PIX gerado';

                        if (pagamento.qrCodeBase64) {
                            imagem.src = 'data:image/png;base64,' +
                                pagamento.qrCodeBase64;
                            imagem.style.display = 'block';
                        }

                        if (pagamento.qrCode) {
                            campoCopia.value = pagamento.qrCode;
                            areaCopia.style.display = 'block';
                        }

                        mensagem.textContent =
                            'Escaneie o QR Code ou copie o código PIX para realizar o pagamento.';
                    } else {
                        titulo.textContent = 'Pagamento enviado';

                        mensagem.textContent =
                            'Status recebido: ' + pagamento.status +
                            '. A confirmação depende do retorno do Mercado Pago.';
                    }

                    return Promise.resolve();

                } catch (erro) {
                    console.error('Erro ao processar pagamento:', erro);
                    window.VibeUI.showToast(erro.message, 'error');
                    throw erro;
                }
            }
        }
    };

    paymentBrickController = await bricksBuilder.create(
        'payment',
        'paymentBrick_container',
        settings
    );
}

async function abrirModalPix(faturaId) {
    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast(
            'Sua sessão expirou. Faça login novamente.',
            'error'
        );
        return;
    }

    try {
        const respostaFatura = await fetch(
            `/api/aluno/faturas/${faturaId}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }
        );

        if (!respostaFatura.ok) {
            throw new Error('Não foi possível localizar esta fatura.');
        }

        const fatura = await respostaFatura.json();

        faturaSelecionadaPix = fatura;

        document.getElementById('modal-pix-fatura-titulo').textContent =
            fatura.titulo || 'Fatura VibeDance';

        document.getElementById('modal-pix-valor').textContent =
            Number(fatura.valor).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

        window.VibeUI.openModal('modal-pix');

        await inicializarPaymentBrick(fatura, token);

    } catch (erro) {
        console.error('Erro ao abrir pagamento:', erro);
        window.VibeUI.showToast(erro.message, 'error');
    }
}

window.abrirModalPix = abrirModalPix;


function copiarPixChave() {
    const input = document.getElementById('modal-pix-copiacola');

    if (!input || !input.value) {
        return;
    }

    navigator.clipboard.writeText(input.value)
        .then(() => {
            window.VibeUI.showToast('Código PIX copiado!', 'success');
        })
        .catch(() => {
            input.select();
            document.execCommand('copy');
            window.VibeUI.showToast('Código PIX copiado!', 'success');
        });
}

window.copiarPixChave = copiarPixChave;


async function fecharModalPagamento() {
    if (paymentBrickController) {
        try {
            await paymentBrickController.unmount();
        } catch (erro) {
            console.error('Erro ao fechar Payment Brick:', erro);
        }

        paymentBrickController = null;
    }

    faturaSelecionadaPix = null;

    window.VibeUI.closeModal('modal-pix');
}

window.fecharModalPagamento = fecharModalPagamento;

async function abrirModalUploadComprovante(faturaId) {
    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Sua sessão expirou. Faça login novamente.', 'error');
        return
    }

    try {
        const resposta = await fetch(`/api/aluno/faturas/${faturaId}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error('Não foi possível localizar esta fatura.');
        }

        const fatura = await resposta.json();
    
        document.getElementById('modal-upload-fatura-id').value = fatura.id;
        document.getElementById('modal-upload-titulo').textContent = 
            `${fatura.titulo} - ${Number(fatura.valor).toLocaleString('pt-BR', { 
                style: 'currency',
                currency: 'BRL' 
            })}`;
        document.getElementById('label-arquivo-selecionado').textContent =
            'Clique para selecionar o comprovante';
        document.getElementById('input-arquivo-comprovante').value = '';
        document.getElementById('comprovante-obs').value = '';
        
        window.VibeUI.openModal('modal-upload-comprovante');

    } catch (erro) {
        console.error('Erro ao abrir envio do comprovante:', erro);
        window.VibeUI.showToast(erro.message, 'error');
    }
}

window.abrirModalUploadComprovante = abrirModalUploadComprovante;

function arquivoSelecionadoHandler(input) {
    const file = input.files && input.files[0];

    if (!file) {
        return;
    }

    const extensoesPermitidas = ['pdf', 'jpg', 'jpeg', 'png'];
    const extensao = file.name.split('.').pop().toLowerCase();

    if (!extensoesPermitidas.includes(extensao)) {
        window.VibeUI.showToast(
            'Formato inválido. Envie PDF, JPG ou PNG.',
            'error'
        );
        input.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        window.VibeUI.showToast(
            'O arquivo deve ter no máximo 5 MB.',
            'error'
        );
        input.value = '';
        return;
    }

    document.getElementById('label-arquivo-selecionado').innerHTML = `
        <span style="color: var(--neon-emerald); font-weight: 700;">
            <i class="fas fa-check-circle"></i> ${file.name}
        </span>
        <br>
        <small style="color: var(--text-muted); font-size: 0.75rem;">
            (${(file.size / 1024).toFixed(1)} KB)
        </small>
    `;
}

window.arquivoSelecionadoHandler = arquivoSelecionadoHandler;

async function enviarComprovanteSubmit(event) {
    event.preventDefault();

    const faturaId = document.getElementById('modal-upload-fatura-id').value;
    const arquivo = document.getElementById('input-arquivo-comprovante').files[0];
    const observacao = document.getElementById('comprovante-obs').value.trim();

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Sua sessão expirou. Faça login novamente.', 'error');
        return;
    }

    if (!arquivo) {
        window.VibeUI.showToast('Selecione um comprovante antes de enviar.', 'error');
        return;
    }

    if (!faturaId) {
        window.VibeUI.showToast('Não foi possível identificar a fatura.', 'error');
        return;
    }

    const dados = new FormData();
    dados.append('idFatura', faturaId);
    dados.append('arquivo', arquivo);
    dados.append('observacao', observacao);

    try {

        const resposta = await fetch('/api/aluno/comprovantes', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: dados
        });

        const resultado = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(resultado.erro || 'Não foi possível enviar o comprovante.');
        }

        window.VibeUI.closeModal('modal-upload-comprovante');

        window.VibeUI.showToast(
            resultado.mensagem || 'Comprovante enviado para análise.',
            'success'
        );

        document.getElementById('form-upload-comprovante').reset();

        const labelArquivo = document.getElementById('label-arquivo-selecionado');
        if (labelArquivo) {
            labelArquivo.textContent = 'Clique para selecionar o comprovante';
        }

        const usuario = window.VibeAuth.getUser();

        if (usuario) {
            await renderizarFaturasAluno(usuario.id);
        }

    } catch (erro) {
        console.error('Erro ao enviar comprovante:', erro);
        window.VibeUI.showToast(erro.message, 'error');
    }
}

window.enviarComprovanteSubmit = enviarComprovanteSubmit;

async function verComprovanteAluno(faturaId) {
    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Sua sessão expirou. Faça login novamente.', 'error');
        return;
    }

    const imgEl = document.getElementById('modal-ver-comprovante-img');
    const pdfEl = document.getElementById('modal-ver-comprovante-pdf');
    const nomeEl = document.getElementById('modal-ver-comprovante-nome');
    const statusEl = document.getElementById('modal-ver-comprovante-status');
    const dataEl = document.getElementById('modal-ver-comprovante-data');

    try {
        if (window.comprovanteObjetoUrlAtual) {
            URL.revokeObjectURL(window.comprovanteObjetoUrlAtual);
            window.comprovanteObjetoUrlAtual = null;
        }

        imgEl.src = '';
        pdfEl.src = '';
        imgEl.style.display = 'none';
        pdfEl.style.display = 'none';

        const respostaPagamentos = await fetch(
            `/api/aluno/pagamentos/fatura/${faturaId}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }
        );

        if (!respostaPagamentos.ok) {
            throw new Error('Não foi possível consultar o pagamento dessa fatura.');
        }

        const pagamentos = await respostaPagamentos.json();

        if (!pagamentos.length) {
            throw new Error('Nenhum pagamento encontrado para esta fatura.');
        }

        const pagamento = pagamentos.find(p => p.possuiComprovante);

        if (!pagamento) {
            throw new Error('Essa fatura ainda não possui comprovante enviado.');
        }

        const respostaArquivo = await fetch(
            `/api/aluno/comprovantes/pagamento/${pagamento.id}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }
        );

        if (!respostaArquivo.ok) {
            throw new Error('Não foi possível carregar o arquivo do comprovante.');
        }

        const arquivo = await respostaArquivo.blob();
        const nomeArquivo = pagamento.comprovanteNome || 'comprovante';
        const tipoArquivo = arquivo.type.toLowerCase();

        const urlArquivo = URL.createObjectURL(arquivo);
        window.comprovanteObjetoUrlAtual = urlArquivo;

        if (tipoArquivo.includes('pdf') || nomeArquivo.toLowerCase().endsWith('pdf')) {
            pdfEl.src = urlArquivo;
            pdfEl.style.display = 'block';
        } else if (tipoArquivo.startsWith('image/')) {
            imgEl.src = urlArquivo;
            imgEl.style.display = 'block';
        } else {
            URL.revokeObjectURL(urlArquivo);
            window.comprovanteObjetoUrlAtual = null;
            throw new Error('Formato de comprovante não suportado para visualização.');
        }

        if (nomeEl) {
            nomeEl.textContent = nomeArquivo;
        }

        if (statusEl) {
            const st = pagamento.status || 'PENDENTE';

            if (st === 'CONFIRMADO') {
                statusEl.innerHTML = '<span class="badge badge-green"><i class="fas fa-check"></i> Pago & Confirmado</span>';
            } else if (st === 'EM_ANALISE') {
                statusEl.innerHTML = '<span class="badge badge-amber"><i class="fas fa-hourglass-half"></i> Em Análise</span>';
            } else {
                statusEl.innerHTML = `<span class="badge badge-cyan">${st}</span>`;
            }
        }

        if (dataEl) {
            dataEl.textContent = pagamento.comprovanteEnviadoEm
                ? new Date(pagamento.comprovanteEnviadoEm).toLocaleString('pt-BR')
                : 'Data não disponível';
        }

        window.VibeUI.openModal('modal-ver-comprovante');

    } catch (erro) {
        console.error('Erro ao visualizar comprovante:', erro);
        window.VibeUI.showToast(erro.message, 'error');
    }
}

window.verComprovanteAluno = verComprovanteAluno;

function fecharComprovanteAluno() {
    if (window.comprovanteObjetoUrlAtual) {
        URL.revokeObjectURL(window.comprovanteObjetoUrlAtual);
        window.comprovanteObjetoUrlAtual = null;
    }

    const imgEl = document.getElementById('modal-ver-comprovante-img');
    const pdfEl = document.getElementById('modal-ver-comprovante-pdf');

    imgEl.src = '';
    pdfEl.src = '';

    imgEl.style.display = 'none';
    pdfEl.style.display = 'none';

    window.VibeUI.closeModal('modal-ver-comprovante');
}

window.fecharComprovanteAluno = fecharComprovanteAluno;