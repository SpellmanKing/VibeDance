/**
 * VibeDance Login Controller
 * Validação rigorosa em tempo real, tratamento amigável de erros e redirecionamento RBAC
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const emailError = document.getElementById('email-error');
    const senhaError = document.getElementById('senha-error');
    const authAlert = document.getElementById('auth-alert');
    const authAlertText = document.getElementById('auth-alert-text');
    const btnSubmit = document.getElementById('btn-submit-login');
    const btnToggleSenha = document.getElementById('btn-toggle-senha');
    const eyeIcon = document.getElementById('eye-icon');

    // Alternar visibilidade de senha
    if (btnToggleSenha && senhaInput && eyeIcon) {
        btnToggleSenha.addEventListener('click', () => {
            const isPassword = senhaInput.type === 'password';
            senhaInput.type = isPassword ? 'text' : 'password';
            eyeIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // Limpar erros ao digitar
    emailInput.addEventListener('input', () => {
        emailError.style.display = 'none';
        emailInput.style.borderColor = '';
        authAlert.style.display = 'none';
    });

    senhaInput.addEventListener('input', () => {
        senhaError.style.display = 'none';
        senhaInput.style.borderColor = '';
        authAlert.style.display = 'none';
    });

    // Envio do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const senha = senhaInput.value.trim();
        let hasError = false;

        // Validação local imediata do e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            mostrarErroCampo(emailInput, emailError, 'O campo de e-mail é obrigatório.');
            hasError = true;
        } else if (!emailRegex.test(email)) {
            mostrarErroCampo(emailInput, emailError, 'Insira um e-mail válido (ex: nome@vibedance.com).');
            hasError = true;
        }

        // Validação local imediata da senha
        if (!senha) {
            mostrarErroCampo(senhaInput, senhaError, 'O campo de senha é obrigatório.');
            hasError = true;
        } else if (senha.length < 6) {
            mostrarErroCampo(senhaInput, senhaError, 'A senha deve conter no mínimo 6 caracteres.');
            hasError = true;
        }

        if (hasError) return;

        // Feedback de carregamento no botão
        btnSubmit.disabled = true;
        const originalBtnHtml = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Validando Acesso...</span>';

        try {
            const resultado = await window.VibeAuth.login(email, senha);

            if (resultado.success) {
                window.VibeUI.showToast(`Login bem-sucedido! Redirecionando para painel de ${resultado.perfil}...`, 'success');
                setTimeout(() => {
                    window.location.href = resultado.redirectUrl;
                }, 600);
            } else {
                mostrarAlertaGeral(resultado.message);
                window.VibeUI.showToast(resultado.message, 'error');
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalBtnHtml;
            }
        } catch (err) {
            console.error('Falha no fluxo de login:', err);
            mostrarAlertaGeral('Ocorreu um erro interno de conexão. Tente novamente.');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnHtml;
        }
    });

    function mostrarErroCampo(input, errorEl, mensagem) {
        input.style.borderColor = '#ef4444';
        errorEl.querySelector('span').textContent = mensagem;
        errorEl.style.display = 'flex';
        input.focus();
    }

    function mostrarAlertaGeral(mensagem) {
        authAlertText.textContent = mensagem;
        authAlert.style.display = 'flex';
    }

    // Link "Esqueceu sua senha"
    const linkEsqueci = document.getElementById('link-esqueci-senha');
    if (linkEsqueci) {
        linkEsqueci.addEventListener('click', (e) => {
            e.preventDefault();
            window.VibeUI.showToast('Instruções de recuperação de senha simuladas enviadas para o seu e-mail cadastrado.', 'info', 4500);
        });
    }
});

/**
 * Função Global para Login de Demonstração Rápido (1 Clique)
 */
async function executarDemoLogin(perfil) {
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const btnSubmit = document.getElementById('btn-submit-login');

    if (perfil === 'ADMINISTRADOR') {
        emailInput.value = 'admin@vibedance.com';
        senhaInput.value = 'admin123';
    } else if (perfil === 'PROFESSOR') {
        emailInput.value = 'prof.diego@vibedance.com';
        senhaInput.value = 'prof123';
    } else {
        emailInput.value = 'aluno.juliana@vibedance.com';
        senhaInput.value = 'aluno123';
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Acessando como ' + perfil + '...</span>';

    const res = await window.VibeAuth.demoLogin(perfil);
    if (res.success) {
        window.VibeUI.showToast(`Autenticado com sucesso como ${perfil}! Redirecionando...`, 'success');
        setTimeout(() => {
            window.location.href = res.redirectUrl;
        }, 500);
    }
}

window.executarDemoLogin = executarDemoLogin;