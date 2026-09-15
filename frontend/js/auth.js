/**
 * VibeDance Authentication & RBAC Core
 * Sistema de login com validação rigorosa, tokens de sessão e roteamento por perfil
 */

const VibeAuth = (function() {
    const TOKEN_KEY = 'vibedance_token';
    const USER_KEY = 'vibedance_user';

    function fakeJwtToken(user) {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
            sub: user.id,
            email: user.email,
            role: user.perfil,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (3600 * 24) // 24h
        }));
        const signature = btoa('vibedance_secure_hmac_signature_2026');
        return `${header}.${payload}.${signature}`;
    }

    return {
        /**
         * Valida e executa o login com RBAC
         */
        login: async function(email, senha) {
            email = (email || '').trim();
            senha = (senha || '').trim();

            // Validação estrita
            if (!email) {
                return { success: false, message: 'Por favor, informe seu endereço de e-mail.' };
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return { success: false, message: 'Formato de e-mail inválido. Exemplo: usuario@vibedance.com' };
            }
            if (!senha) {
                return { success: false, message: 'Por favor, digite sua senha de acesso.' };
            }
            if (senha.length < 6) {
                return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
            }

            // Tenta consultar API Spring Boot caso esteja ativa
            try {
                const response = await fetch('http://localhost:8080/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                if (response.ok) {
                    const data = await response.json();
                    sessionStorage.setItem(TOKEN_KEY, data.token);
                    sessionStorage.setItem(USER_KEY, JSON.stringify({ email, perfil: data.perfil }));
                    return { success: true, perfil: data.perfil, redirectUrl: this.getDashboardUrl(data.perfil) };
                }
            } catch (err) {
                // Backend Spring Boot offline ou sem CORS, fallback transparente para VibeStore
            }

            // Validação no VibeStore
            const usuario = window.VibeStore ? window.VibeStore.findUsuarioByEmail(email) : null;
            if (!usuario) {
                return { success: false, message: 'E-mail não cadastrado. Verifique as informações ou use os atalhos de demonstração.' };
            }

            if (usuario.senha !== senha) {
                return { success: false, message: 'Senha incorreta para esta conta. Tente novamente ou redefina sua senha.' };
            }

            if (usuario.ativo === false) {
                return { success: false, message: 'Esta conta de usuário foi temporariamente desativada pelo administrador.' };
            }

            // Gera token JWT de segurança
            const token = fakeJwtToken(usuario);
            const userSession = {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
                telefone: usuario.telefone
            };

            sessionStorage.setItem(TOKEN_KEY, token);
            sessionStorage.setItem(USER_KEY, JSON.stringify(userSession));
            localStorage.setItem(USER_KEY, JSON.stringify(userSession)); // Backup para recarga

            return {
                success: true,
                perfil: usuario.perfil,
                user: userSession,
                redirectUrl: this.getDashboardUrl(usuario.perfil)
            };
        },

        /**
         * Retorna a URL correta com base no perfil RBAC
         */
        getDashboardUrl: function(perfil, fromSubfolder = false) {
            const prefix = fromSubfolder ? '../' : '';
            switch (perfil) {
                case 'ADMINISTRADOR':
                    return prefix + 'Admin/admin.html';
                case 'PROFESSOR':
                    return prefix + 'Professor/professor.html';
                case 'ALUNO':
                default:
                    return prefix + 'Aluno/aluno.html';
            }
        },

        /**
         * Login Rápido com 1 clique para demonstração
         */
        demoLogin: async function(perfil) {
            let email = '';
            let pass = '';
            if (perfil === 'ADMINISTRADOR') {
                email = 'admin@vibedance.com';
                pass = 'admin123';
            } else if (perfil === 'PROFESSOR') {
                email = 'prof.diego@vibedance.com';
                pass = 'prof123';
            } else {
                email = 'aluno.juliana@vibedance.com';
                pass = 'aluno123';
            }
            return await this.login(email, pass);
        },

        getUser: function() {
            try {
                const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        isAuthenticated: function() {
            return Boolean(this.getUser());
        },

        logout: function(fromSubfolder = false) {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
            localStorage.removeItem(USER_KEY);
            const redirectPath = fromSubfolder ? '../index.html' : 'index.html';
            window.location.href = redirectPath;
        }
    };
})();

window.VibeAuth = VibeAuth;
