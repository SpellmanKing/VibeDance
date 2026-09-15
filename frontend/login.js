document.getElementById('form-login').addEventListener('submit', function(evento) {
    evento.preventDefault(); // Evita recarregar a página

    const email = document.getElementById('email').value.toLowerCase();
    
    // Simulação de roteamento por perfil de acesso
    if (email.includes('admin')) {
        // Se o email tiver 'admin', vai para a tela de gestão
        alert('Bem-vindo, Administrador!');
        window.location.href = 'admin.html';
        
    } else if (email.includes('prof')) {
        // Se o email tiver 'prof', vai para a tela do professor
        alert('Bem-vindo, Professor!');
        window.location.href = 'professor.html'; // Próxima tela a ser criada
        
    } else {
        // Qualquer outro email, consideramos aluno
        alert('Bem-vindo, Aluno!');
        window.location.href = 'aluno.html';
    }
});