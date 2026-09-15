const API_URL = 'http://localhost:8080/api';

// Inicializa as funções quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    carregarModalidades();
    
    // Intercepta os envios dos formulários
    document.getElementById('form-modalidade').addEventListener('submit', salvarModalidade);
    
    // NOVO: Escuta o formulário de Turmas
    document.getElementById('form-turma').addEventListener('submit', salvarTurma);
});

/* ==========================================
   GERENCIAMENTO DE MODALIDADES
========================================== */

async function carregarModalidades() {
    try {
        const response = await fetch(`${API_URL}/modalidades`);
        if (!response.ok) throw new Error('Erro ao buscar modalidades');
        
        const modalidades = await response.json();
        
        atualizarTabelaModalidades(modalidades);
        atualizarSelectModalidades(modalidades);
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados. O servidor backend está rodando?');
    }
}

async function salvarModalidade(evento) {
    evento.preventDefault(); 

    const modalidade = {
        nome: document.getElementById('nome').value,
        descricao: document.getElementById('descricao').value
    };

    try {
        const response = await fetch(`${API_URL}/modalidades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(modalidade)
        });

        if (response.ok) {
            alert('Modalidade salva com sucesso!');
            document.getElementById('form-modalidade').reset(); 
            carregarModalidades(); 
        } else {
            alert('Erro ao salvar a modalidade.');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

function atualizarTabelaModalidades(modalidades) {
    const tbody = document.getElementById('tabela-modalidades');
    tbody.innerHTML = ''; 

    modalidades.forEach(mod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${mod.id}</td>
            <td><strong>${mod.nome}</strong></td>
            <td>${mod.descricao}</td>
            <td>
                <button style="background-color: #2196F3;">Editar</button>
                <button style="background-color: #f44336;">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarSelectModalidades(modalidades) {
    const select = document.getElementById('modalidade-select');
    select.innerHTML = '<option value="">Selecione uma modalidade...</option>';

    modalidades.forEach(mod => {
        const option = document.createElement('option');
        option.value = mod.id;
        option.textContent = mod.nome;
        select.appendChild(option);
    });
}

/* ==========================================
   NOVO: GERENCIAMENTO DE TURMAS
========================================== */

async function salvarTurma(evento) {
    evento.preventDefault();

    const modalidadeId = document.getElementById('modalidade-select').value;
    const dias = document.getElementById('dias').value;
    let horario = document.getElementById('horario').value;
    const vagas = document.getElementById('vagas').value;

    if (!modalidadeId) {
        alert('Por favor, selecione uma modalidade.');
        return;
    }

    // O input type="time" do HTML retorna "HH:MM". 
    // O Java LocalTime espera "HH:MM:SS". Adicionamos ":00" para evitar erros de Parse no backend.
    if (horario.length === 5) {
        horario = horario + ":00";
    }

    // Montamos o JSON exatamente como o Spring Boot espera
    const turma = {
        modalidade: { id: parseInt(modalidadeId) },
        diasSemana: dias,
        horario: horario,
        limiteVagas: parseInt(vagas)
    };

    try {
        const response = await fetch(`${API_URL}/turmas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(turma)
        });

        if (response.ok) {
            alert('Turma salva com sucesso!');
            document.getElementById('form-turma').reset(); // Limpa o formulário de turmas
        } else {
            alert('Erro ao salvar a turma.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Falha ao conectar com o servidor.');
    }
}