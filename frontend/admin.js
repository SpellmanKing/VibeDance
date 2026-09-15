const API_URL = 'http://localhost:8080/api';

// Inicializa as funções quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    carregarModalidades();
    
    // Intercepta o envio do formulário de modalidades
    document.getElementById('form-modalidade').addEventListener('submit', salvarModalidade);
});

/**
 * Busca as modalidades no Backend e preenche a tabela e o Select de Turmas
 */
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

/**
 * Envia uma nova modalidade para o Backend (POST)
 */
async function salvarModalidade(evento) {
    evento.preventDefault(); // Evita que a página recarregue

    const modalidade = {
        nome: document.getElementById('nome').value,
        descricao: document.getElementById('descricao').value
    };

    try {
        const response = await fetch(`${API_URL}/modalidades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(modalidade)
        });

        if (response.ok) {
            alert('Modalidade salva com sucesso!');
            document.getElementById('form-modalidade').reset(); // Limpa o formulário
            carregarModalidades(); // Recarrega a lista atualizada
        } else {
            alert('Erro ao salvar a modalidade.');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

/**
 * Renderiza os dados na tabela de Modalidades
 */
function atualizarTabelaModalidades(modalidades) {
    const tbody = document.getElementById('tabela-modalidades');
    tbody.innerHTML = ''; // Limpa a tabela antes de preencher

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

/**
 * Preenche o <select> do formulário de Turmas com as modalidades disponíveis
 */
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