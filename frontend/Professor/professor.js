/**
 * VibeDance Professor Controller
 * Agenda Semanal Interativa, Chamada Virtual com 1 Clique e Mural de Músicas
 */

let chamadaEstadoAtual = []; // Mantém o estado da chamada em memória para a turma/data
let alunosChamadaAtual = [];
let turmasAgendaProfessor = [];
let dataReferenciaAgenda = new Date();
let modoAgendaProfessor = 'semana';

document.addEventListener('DOMContentLoaded', () => {
    inicializarPainelProfessor();

    // Listener do formulário de novo comunicado
    const formComunicado = document.getElementById('form-novo-comunicado');
    if (formComunicado) {
        formComunicado.addEventListener('submit', salvarNovoComunicado);
    }
});

async function inicializarPainelProfessor() {
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

    await popularSelectsTurma(user);
    await carregarDashboardProfessor();
    await carregarListaChamada();
    await renderizarMuralComunicados();

    // Sincronização em tempo real: reflete aprovações do admin ou pagamentos do aluno instantaneamente
    if (window.VibeStore && typeof window.VibeStore.onSync === 'function') {
        window.VibeStore.onSync(() => {
            carregarListaChamada();
        });
    }
}

async function carregarDashboardProfessor() {
    const token = sessionStorage.getItem('vibedance_token');

    if (!token) return;

    try {
        const resposta = await fetch('/api/professor/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!resposta.ok) {
            console.error('Erro ao carregar dashboard do professor:', resposta.status);
            return;
        }

        const dados = await resposta.json();

        const alunosEl = document.getElementById('stat-prof-alunos');
        const presencaEl = document.getElementById('stat-prof-presenca');
        const proximaEl = document.getElementById('stat-prof-proxima');
        const detalheEl = document.getElementById('stat-prof-proxima-detalhe');
        const dataEl = document.getElementById('stat-prof-proxima-data');

        if (alunosEl) {
            alunosEl.textContent = dados.totalAlunos;
        }

        if (presencaEl) {
            presencaEl.textContent = `${dados.presencaMedia}%`;
        }

        if (proximaEl) {
            proximaEl.textContent = dados.proximaAulaHorario;
        }

        if (dataEl) {
            if (dados.proximaAulaData) {
                const partes = dados.proximaAulaData.split('-').map(Number);
                const data = new Date(partes[0], partes[1] - 1, partes[2]);

                dataEl.textContent = data.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } else {
                dataEl.textContent = 'Sem próxima aula';
            }
        }

        if (detalheEl) {
            detalheEl.textContent = dados.proximaAulaDetalhe;
        }

    } catch (erro) {
        console.error('Erro ao consultar dashboard:', erro);
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
 * Renderiza os cards da Agenda Semanal usando turmas do backend
 */
function renderizarAgendaProfessor(turmas) {
    const container = document.getElementById('container-agenda-professor');
    if (!container) return;

    turmasAgendaProfessor = turmas || [];

    const countEl = document.getElementById('stat-prof-turmas');
    if (countEl) countEl.textContent = turmasAgendaProfessor.length;

    atualizarCalendarioProfessor();
}

function obterDataLocal(data) {
    return new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate()
    );
}

function formatarDataAgenda(data) {
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
    });
}

function turmaAconteceNoDia(turma, dia) {
    if (!turma.diasSemana) return false;

    const dias = turma.diasSemana
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const nomesDias = [
        'domingo',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado'
    ];

    return dias.includes(nomesDias[dia]);
}

function atualizarCalendarioProfessor() {
    const container = document.getElementById('container-agenda-professor');
    const periodo = document.getElementById('agenda-periodo');
    const inputData = document.getElementById('agenda-data');

    if (!container) return;
    container.classList.toggle(
        'agenda-modo-dia',
        modoAgendaProfessor === 'dia'
    );

    const dataBase = obterDataLocal(dataReferenciaAgenda);

    if (inputData) {
        inputData.value = [
            dataBase.getFullYear(),
            String(dataBase.getMonth() + 1).padStart(2, '0'),
            String(dataBase.getDate()).padStart(2, '0')
        ].join('-');
    }

    const inicioSemana = new Date(dataBase);
    const diaSemana = inicioSemana.getDay();

    inicioSemana.setDate(
        inicioSemana.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1)
    );

    const dias = [];

    if (modoAgendaProfessor === 'dia') {
        dias.push(dataBase);
    } else {
        for (let i = 0; i < 7; i++) {
            const dia = new Date(inicioSemana);
            dia.setDate(inicioSemana.getDate() + i);
            dias.push(dia);
        }
    }

    if (periodo) {
        if (modoAgendaProfessor === 'dia') {
            periodo.textContent = dataBase.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } else {
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(inicioSemana.getDate() + 6);

            periodo.textContent =
                `${formatarDataAgenda(inicioSemana)} até ${formatarDataAgenda(fimSemana)}`;
        }
    }

    document.getElementById('btn-agenda-semana')?.classList.toggle(
        'active',
        modoAgendaProfessor === 'semana'
    );

    document.getElementById('btn-agenda-dia')?.classList.toggle(
        'active',
        modoAgendaProfessor === 'dia'
    );

    if (turmasAgendaProfessor.length === 0) {
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; color: var(--text-muted);">
                Nenhuma turma atribuída a este professor no momento.
            </div>
        `;
        return;
    }

    container.innerHTML = dias.map(data => {
        const turmasDoDia = turmasAgendaProfessor.filter(turma =>
            turmaAconteceNoDia(turma, data.getDay())
        );

        turmasDoDia.sort((a, b) =>
            String(a.horario || '').localeCompare(String(b.horario || ''))
        );

        return `
            <section class="agenda-dia">
                <div class="agenda-dia-cabecalho">
                    <strong>
                        ${data.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </strong>
                    <span>${formatarDataAgenda(data)}</span>
                </div>

                <div class="agenda-dia-aulas">
                    ${
                        turmasDoDia.length
                            ? turmasDoDia.map(turma => `
                                <article class="agenda-aula">
                                    <strong>${turma.nomeTurma || 'Turma'}</strong>
                                    <span>${turma.modalidade?.nome || 'Modalidade'}</span>
                                    <span>
                                        <i class="fas fa-clock"></i>
                                        ${turma.horario ? String(turma.horario).substring(0, 5) : '--:--'}
                                        ${turma.horarioFim ? ' - ' + String(turma.horarioFim).substring(0, 5) : ''}
                                    </span>
                                    <span>${turma.nivel || 'Geral'}</span>

                                    <button
                                        class="btn-vibe-primary"
                                        onclick="abrirChamadaTurma(${turma.id})"
                                    >
                                        <i class="fas fa-user-check"></i>
                                        Iniciar chamada
                                    </button>
                                </article>
                            `).join('')
                            : '<p class="agenda-sem-aula">Nenhuma aula neste dia.</p>'
                    }
                </div>
            </section>
        `;
    }).join('');
}

function navegarAgendaProfessor(direcao) {
    const quantidade = modoAgendaProfessor === 'semana' ? 7 : 1;

    dataReferenciaAgenda.setDate(
        dataReferenciaAgenda.getDate() + (direcao * quantidade)
    );

    atualizarCalendarioProfessor();
}

function alterarDataAgendaProfessor(valor) {
    if (!valor) return;

    const partes = valor.split('-').map(Number);

    dataReferenciaAgenda = new Date(
        partes[0],
        partes[1] - 1,
        partes[2]
    );

    atualizarCalendarioProfessor();
}

function alterarModoAgendaProfessor(modo) {
    if (modo !== 'dia' && modo !== 'semana') return;

    modoAgendaProfessor = modo;
    atualizarCalendarioProfessor();
}

window.navegarAgendaProfessor = navegarAgendaProfessor;
window.alterarDataAgendaProfessor = alterarDataAgendaProfessor;
window.alterarModoAgendaProfessor = alterarModoAgendaProfessor;

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
async function popularSelectsTurma(user) {
    const selectChamada = document.getElementById('select-turma-chamada');
    const selectComunicado = document.getElementById('comunicado-turma-select');

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Faça login novamente para carregar suas turmas.', 'error');
        return;
    }

    try {
        const resposta = await fetch('/api/professor/presencas/turmas', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error(await resposta.text());
        }

        const turmas = await resposta.json();
        renderizarAgendaProfessor(turmas);

        const optionsHtml = turmas.map(t =>
            `<option value="${t.id}">${t.nomeTurma} (${t.diasSemana})</option>`
        ).join('');

        if (selectChamada) {
            selectChamada.innerHTML = optionsHtml;
        }

        // Usa as mesmas turmas reais do backend no formulário de comunicados.
        if (selectComunicado) {
            selectComunicado.innerHTML = optionsHtml;
        }

    } catch (erro) {
        console.error('Erro ao carregar turmas:', erro);
        window.VibeUI.showToast('Não foi possível carregar suas turmas.', 'error');
    }
}

/**
 * Carrega a lista de alunos da turma selecionada para a Chamada Virtual
 */
async function carregarListaChamada() {
    const selectTurma = document.getElementById('select-turma-chamada');
    const inputData = document.getElementById('input-data-chamada');
    const tbody = document.getElementById('tabela-alunos-chamada');
    const tituloTurma = document.getElementById('titulo-chamada-turma');

    if (!selectTurma || !tbody || !selectTurma.value) return;

    const turmaId = Number(selectTurma.value);
    const data = inputData ? inputData.value : new Date().toISOString().split('T')[0];
    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        window.VibeUI.showToast('Faça login novamente.', 'error');
        return;
    }

    if (tituloTurma) {
        tituloTurma.textContent = `Lista de Presença: ${selectTurma.selectedOptions[0].textContent}`;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:30px;">
                Carregando alunos...
            </td>
        </tr>
    `;

    try {
        const resposta = await fetch(
            `/api/professor/presencas/${turmaId}?data=${encodeURIComponent(data)}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }
        );

        if (!resposta.ok) {
            throw new Error(await resposta.text());
        }

        const alunos = await resposta.json();
        alunosChamadaAtual = alunos;

        tbody.innerHTML = '';
        chamadaEstadoAtual = [];

        if (alunos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">
                        Nenhum aluno matriculado nesta turma.
                    </td>
                </tr>
            `;
            atualizarTaxaPresenca();
            return;
        }

        alunos.forEach(aluno => {
            const presente = aluno.presente;

            chamadaEstadoAtual.push({
                alunoId: aluno.id,
                presente: presente
            });

            const initials = aluno.nome
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

            const tr = document.createElement('tr');
            tr.id = `row-aluno-${aluno.id}`;

            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="user-avatar-circle" style="width:34px; height:34px; font-size:0.8rem;">
                            ${initials}
                        </div>
                        <div>
                            <strong style="color:#fff;">${aluno.nome}</strong>
                        </div>
                    </div>
                </td>
                <td>${aluno.email || '—'}</td>
                <td>${aluno.telefone || '—'}</td>
                <td>
                    ${aluno.dataMatricula
                        ? new Date(aluno.dataMatricula).toLocaleDateString('pt-BR')
                        : '—'}
                </td>
                <td>
                    <span style="color:var(--text-dim); font-size:0.8rem;">—</span>
                </td>
                <td style="text-align:center;">
                    <span style="color:var(--text-dim); font-size:0.8rem;">—</span>
                </td>
                <td style="text-align:center;">
                    <div class="attendance-toggle-group">
                        <button type="button"
                            class="attendance-chip btn-presente ${presente === true ? 'active' : ''}"
                            onclick="togglePresenca(${aluno.id}, true)">
                            <i class="fas fa-check"></i> Presente
                        </button>
                        <button type="button"
                            class="attendance-chip btn-ausente ${presente === false ? 'active' : ''}"
                            onclick="togglePresenca(${aluno.id}, false)">
                            <i class="fas fa-times"></i> Ausente
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });

        atualizarTaxaPresenca();

    } catch (erro) {
        console.error('Erro ao carregar chamada:', erro);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#ef4444;">
                    Não foi possível carregar os alunos.
                </td>
            </tr>
        `;

        window.VibeUI.showToast('Erro ao carregar chamada.', 'error');
    }
}
window.carregarListaChamada = carregarListaChamada;

function exportarListaAlunos() {
    if (!alunosChamadaAtual || alunosChamadaAtual.length === 0) {
        window.VibeUI.showToast('Não há alunos para exportar.', 'error');
        return;
    }

    const linhas = [
        ['Nome', 'E-mail', 'Telefone', 'Data da Matrícula']
    ];

    alunosChamadaAtual.forEach(aluno => {
        const data = aluno.dataMatricula
            ? new Date(aluno.dataMatricula).toLocaleDateString('pt-BR')
            : '';

        linhas.push([
            aluno.nome || '',
            aluno.email || '',
            aluno.telefone || '',
            data
        ]);
    });

    const csv = '\uFEFF' + linhas.map(linha =>
        linha.map(valor =>
            '"' + String(valor).replace(/"/g, '""') + '"'
        ).join(';')
    ).join('\n');

    const arquivo = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'alunos-da-turma.csv';
    link.click();

    URL.revokeObjectURL(url);
}

window.exportarListaAlunos = exportarListaAlunos;

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
 * Salva a Chamada Virtual no banco de dados
 */
async function salvarChamadaVirtual() {
    const selectTurma = document.getElementById('select-turma-chamada');
    const inputData = document.getElementById('input-data-chamada');

    if (!selectTurma || !selectTurma.value || chamadaEstadoAtual.length === 0) {
        window.VibeUI.showToast('Nenhum aluno para registrar chamada.', 'error');
        return;
    }

    const turmaId = Number(selectTurma.value);
    const data = inputData ? inputData.value : null;
    const token = sessionStorage.getItem('vibedance_token');

    if (!data) {
        window.VibeUI.showToast('Selecione a data da chamada.', 'error');
        return;
    }

    if (!token) {
        window.VibeUI.showToast('Faça login novamente.', 'error');
        return;
    }

    const chamadaIncompleta = chamadaEstadoAtual.some(
        aluno => typeof aluno.presente !== 'boolean'
    );

    if (chamadaIncompleta) {
        window.VibeUI.showToast(
            'Marque todos os alunos como presentes ou ausentes.',
            'warning'
        );
        return;
    }

    try {
        const resposta = await fetch(`/api/professor/presencas/${turmaId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                data: data,
                alunos: chamadaEstadoAtual
            })
        });

        if (!resposta.ok) {
            const erro = await resposta.text();
            throw new Error(erro);
        }

        window.VibeUI.showToast(
            `Chamada registrada com sucesso para ${data}!`,
            'success'
        );

        await carregarListaChamada();
        await carregarDashboardProfessor();

    } catch (erro) {
        console.error('Erro ao salvar chamada:', erro);
        window.VibeUI.showToast(
            'Não foi possível salvar a chamada: ' + erro.message,
            'error'
        );
    }
}
window.salvarChamadaVirtual = salvarChamadaVirtual;

/**
 * Salva e publica novo comunicado ou música
 */
async function salvarNovoComunicado(e) {
    e.preventDefault();

    const token = sessionStorage.getItem('vibedance_token');

    const turmaId = Number(document.getElementById('comunicado-turma-select').value);
    const titulo = document.getElementById('comunicado-titulo').value.trim();
    const conteudo = document.getElementById('comunicado-conteudo').value.trim();
    const link = document.getElementById('comunicado-link').value.trim();
    const urgente = document.getElementById('comunicado-urgente').checked;

    if (!token) {
        window.VibeUI.showToast('Faça login novamente.', 'error');
        return;
    }

    if (!turmaId || !titulo || !conteudo) {
        window.VibeUI.showToast('Preencha os campos obrigatórios.', 'warning');
        return;
    }

    try {
        // Se houver link, cadastra também como material da aula.
        if (link) {
            let tipo = 'LINK_EXTERNO';
            const linkMinusculo = link.toLowerCase();

            if (linkMinusculo.includes('spotify.com')) {
                tipo = 'PLAYLIST';
            } else if (
                linkMinusculo.includes('youtube.com') ||
                linkMinusculo.includes('youtu.be')
            ) {
                tipo = 'VIDEO_COREOGRAFIA';
            } else if (linkMinusculo.split('?')[0].endsWith('.pdf')) {
                tipo = 'DOCUMENTO_PDF';
            }

            const respostaMaterial = await fetch('/api/professor/materiais', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    turmaId,
                    titulo,
                    tipo,
                    url: link,
                    descricao: conteudo
                })
            });

            if (!respostaMaterial.ok) {
                throw new Error(await respostaMaterial.text());
            }
        }

        // Salva o comunicado no banco de dados.
        const respostaComunicado = await fetch('/api/professor/comunicados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                turmaId,
                titulo,
                conteudo,
                link,
                urgente
            })
        });

        if (!respostaComunicado.ok) {
            throw new Error(await respostaComunicado.text());
        }

        window.VibeUI.showToast(
            link
                ? 'Comunicado e material publicados com sucesso!'
                : 'Comunicado publicado com sucesso!',
            'success'
        );

        document.getElementById('form-novo-comunicado').reset();

        await renderizarMuralComunicados();

    } catch (erro) {
        console.error('Erro ao publicar:', erro);
        window.VibeUI.showToast(
            'Não foi possível publicar: ' + erro.message,
            'error'
        );
    }
}

/**
 * Carrega os comunicados publicados pelo professor.
 */
async function renderizarMuralComunicados() {
    const container = document.getElementById('container-lista-comunicados');
    if (!container) return;

    const token = sessionStorage.getItem('vibedance_token');

    if (!token) {
        container.innerHTML = '<p>Faça login novamente para consultar os comunicados.</p>';
        return;
    }

    try {
        const resposta = await fetch('/api/professor/comunicados', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!resposta.ok) {
            throw new Error(await resposta.text());
        }

        const comunicados = await resposta.json();
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

            const dataFormatada = c.data
                ? new Date(c.data).toLocaleString('pt-BR')
                : 'Agora';

            const linkHtml = c.link ? `
                <div style="margin-top: 12px;">
                    <a href="${c.link}" target="_blank" rel="noopener noreferrer"
                       class="btn-vibe-outline"
                       style="font-size: 0.8rem; text-decoration: none;">
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
                        <h4 style="color: #fff; font-size: 1.05rem; font-family: var(--font-heading);"></h4>
                    </div>
                    <span style="font-size: 0.78rem; color: var(--text-dim);">${dataFormatada}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5;"></p>
                ${linkHtml}
            `;

            item.querySelector('h4').textContent = c.titulo;
            item.querySelector('p').textContent = c.conteudo;

            container.appendChild(item);
        });

    } catch (erro) {
        console.error('Erro ao carregar comunicados:', erro);
        container.innerHTML = '<p>Não foi possível carregar os comunicados.</p>';
    }
}