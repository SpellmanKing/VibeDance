/**
 * VibeDance UI Helpers
 * Sistema de Toasts, Modais e Efeitos Visuais de Música
 */

const VibeUI = (function() {
    // Garante o container de toasts no DOM
    function getToastContainer() {
        let container = document.getElementById('vibe-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'vibe-toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    return {
        /**
         * Exibe um Toast moderno com ícone e estilo neon
         * @param {string} message 
         * @param {'success' | 'error' | 'info'} type 
         * @param {number} duration 
         */
        showToast: function(message, type = 'info', duration = 3800) {
            const container = getToastContainer();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;

            let iconClass = 'fa-info-circle';
            if (type === 'success') iconClass = 'fa-check-circle';
            if (type === 'error') iconClass = 'fa-exclamation-triangle';

            toast.innerHTML = `
                <i class="fas ${iconClass}" style="font-size: 1.3rem;"></i>
                <div style="flex: 1; font-size: 0.92rem; font-weight: 500; color: #fff;">${message}</div>
                <button style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(60px)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },

        openModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        },

        closeModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        },

        /**
         * Retorna uma saudação dinâmica com base no horário atual
         */
        getSaudacao: function() {
            const hora = new Date().getHours();
            if (hora >= 5 && hora < 12) return 'Bom dia';
            if (hora >= 12 && hora < 18) return 'Boa tarde';
            return 'Boa noite';
        }
    };
})();

// Fechar modal ao clicar fora ou na tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
        document.body.style.overflow = '';
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
        document.body.style.overflow = '';
    }
});

window.VibeUI = VibeUI;
