// Constante da URL da nossa API Spring Boot
const API_URL = 'http://localhost:8080/api';

/**
 * Função para buscar e exibir as modalidades de dança (US02)
 */
async function carregarModalidades() {
    try {
        const response = await fetch(`${API_URL}/modalidades`);
        
        if (!response.ok) {
            throw new Error('Erro ao buscar modalidades');
        }

        const modalidades = await response.json();
        renderizarModalidades(modalidades);
    } catch (error) {
        console.error("Falha na conexão com o servidor:", error);
    }
}

/**
 * Função para renderizar os dados na interface
 */
function renderizarModalidades(modalidades) {
    const container = document.getElementById('modalidades-container');
    container.innerHTML = ''; // Limpa o container

    modalidades.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'modalidade-card';
        card.innerHTML = `
            <h3>${mod.nome}</h3>
            <p>${mod.descricao}</p>
            <button onclick="verTurmas(${mod.id})">Ver Turmas e Horários</button>
        `;
        container.appendChild(card);
    });
}

/**
 * Simulação de Login (US01 / US08 / US11)
 * Na prática, isso retornaria um Token JWT do Spring Security
 */
async function realizarLogin(email, senha) {
    // Exemplo de payload
    const credenciais = { email, senha };

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credenciais)
        });

        if (response.ok) {
            const data = await response.json();
            // Salva o token e o perfil do usuário no LocalStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('perfil', data.perfil); // ALUNO, PROFESSOR ou ADMIN
            
            // Redireciona com base no perfil (Requisito Não Funcional US17)
            redirecionarPorPerfil(data.perfil);
        } else {
            alert("Credenciais inválidas!");
        }
    } catch (error) {
        console.error("Erro no login:", error);
    }
}