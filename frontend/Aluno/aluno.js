const API_URL = 'http://localhost:8080/api';

document.addEventListener('DOMContentLoaded', () => {
    carregarModalidades();
});

/**
 * Busca as modalidades ativas e renderiza os cards
 */
async function carregarModalidades() {
    try {
        const response = await fetch(`${API_URL}/modalidades`);
        if (!response.ok) throw new Error('Erro ao buscar modalidades');
        
        const modalidades = await response.json();
        renderizarModalidades(modalidades);
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('modalidades-grid').innerHTML = '<p>Erro ao carregar as modalidades. Tente novamente mais tarde.</p>';
    }
}

function renderizarModalidades(modalidades) {
    const grid = document.getElementById('modalidades-grid');
    grid.innerHTML = ''; // Limpa o "Carregando..."

    if (modalidades.length === 0) {
        grid.innerHTML = '<p>Nenhuma modalidade disponível no momento.</p>';
        return;
    }

    modalidades.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${mod.nome}</h3>
            <p>${mod.descricao}</p>
            <button onclick="verTurmas(${mod.id}, '${mod.nome}')">Ver Turmas</button>
        `;
        grid.appendChild(card);
    });
}

/**
 * Busca as turmas de uma modalidade específica e exibe a tabela
 */
async function verTurmas(modalidadeId, modalidadeNome) {
    const section = document.getElementById('turmas-section');
    const titulo = document.getElementById('titulo-turmas');
    const tbody = document.getElementById('tabela-turmas');
    
    // Mostra a seção de turmas e atualiza o título
    section.style.display = 'block';
    titulo.textContent = `Turmas de ${modalidadeNome}`;
    tbody.innerHTML = '<tr><td colspan="4">Carregando turmas...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/turmas/modalidade/${modalidadeId}`);
        if (!response.ok) throw new Error('Erro ao buscar turmas');
        
        const turmas = await response.json();
        renderizarTurmas(turmas);
    } catch (error) {
        console.error('Erro:', error);
        tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar as turmas desta modalidade.</td></tr>';
    }
}

function renderizarTurmas(turmas) {
    const tbody = document.getElementById('tabela-turmas');
    tbody.innerHTML = '';

    if (turmas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhuma turma aberta para esta modalidade.</td></tr>';
        return;
    }

    turmas.forEach(turma => {
        // Cálculo de vagas restantes
        const vagasRestantes = turma.limiteVagas - turma.vagasOcupadas;
        
        let botaoMatricular = '';
        
        // Bloqueia o botão se não houver vagas
        if (vagasRestantes > 0) {
            botaoMatricular = `<button class="btn-matricular" onclick="iniciarMatricula(${turma.id})">Matricular-se</button>`;
        } else {
            botaoMatricular = `<button class="btn-esgotado" disabled>Turma Lotada</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${turma.diasSemana}</td>
            <td>${turma.horario}</td>
            <td><strong>${vagasRestantes}</strong> de ${turma.limiteVagas}</td>
            <td>${botaoMatricular}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Gancho para a futura integração da API de Matrículas
 */
function iniciarMatricula(turmaId) {
    // Aqui chamaremos a API de matrículas no futuro
    alert(`Preparando matrícula para a turma ID: ${turmaId}...\n(O backend de matrículas será o próximo passo!)`);
}