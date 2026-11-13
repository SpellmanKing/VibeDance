/**
 * VibeDance Route Guard & RBAC Enforcer
 * Protege páginas privadas, valida permissões de perfil e injeta dados do usuário
 */

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const user = window.VibeAuth ? window.VibeAuth.getUser() : null;

        // Se não autenticado, redireciona para login
        if (!user) {
            alert('Acesso restrito. Por favor, faça login para acessar este painel.');
            window.location.href = '../index.html';
            return;
        }

        // Identifica a página atual
        const path = window.location.pathname.toLowerCase();
        let expectedRole = null;

        if (path.includes('admin')) {
            expectedRole = 'ADMINISTRADOR';
        } else if (path.includes('professor')) {
            expectedRole = 'PROFESSOR';
        } else if (path.includes('aluno')) {
            expectedRole = 'ALUNO';
        }

        // Verifica permissão (Admin pode navegar para qualquer área em modo inspeção)
        if (expectedRole && user.perfil !== expectedRole && user.perfil !== 'ADMINISTRADOR') {
            alert(`Acesso negado: Seu perfil (${user.perfil}) não possui permissão para acessar o painel de ${expectedRole}. Redirecionando...`);
            window.location.href = window.VibeAuth.getDashboardUrl(user.perfil, true);
            return;
        }

        // Atualiza elementos de interface com os dados do usuário autenticado
        document.querySelectorAll('.current-user-name').forEach(el => el.textContent = user.nome);
        document.querySelectorAll('.current-user-email').forEach(el => el.textContent = user.email);
        document.querySelectorAll('.current-user-role').forEach(el => el.textContent = user.perfil);
        
        // Iniciais para o avatar
        const initials = user.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        document.querySelectorAll('.current-user-avatar').forEach(el => el.textContent = initials);

        // Bind global de botões de logout
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Deseja realmente encerrar sua sessão no VibeDance?')) {
                    window.VibeAuth.logout(true);
                }
            });
        });
    });
})();
