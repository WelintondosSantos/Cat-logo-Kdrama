// Auth Manager - Handles Supabase Authentication

const AuthManager = {
    user: null,

    async init() {
        // Check current session
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        this.updatestate(session);

        // Listen for auth changes
        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
            this.updatestate(session);
        });

        this.setupEventListeners();
    },

    updatestate(session) {
        this.user = session ? session.user : null;
        this.updateUI();

        // Notify application that auth state changed (to reload data)
        // We can dispatch a custom event
        const event = new CustomEvent('auth:stateChanged', { detail: { user: this.user } });
        document.dispatchEvent(event);
    },

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenu');
        const userEmail = document.getElementById('userEmail');

        if (this.user) {
            loginBtn.classList.add('d-none');
            userMenu.classList.remove('d-none');
            userEmail.textContent = this.user.email;

            // Admin Logic
            const existingAdminBtn = document.getElementById('adminBtn');
            if (existingAdminBtn) existingAdminBtn.remove(); // Prevent duplicates

            // Usar lista centralizada do config.js
            const allowedAdmins = (typeof ADMIN_EMAILS !== 'undefined') ? ADMIN_EMAILS : [];

            if (allowedAdmins.includes(this.user.email)) {
                const logoutBtnLi = document.getElementById('logoutBtn').parentElement;
                const adminLi = document.createElement('li');
                adminLi.innerHTML = `
                    <a class="dropdown-item text-primary fw-bold" href="admin/index.html" id="adminBtn">
                        <i class="bi bi-tools me-2"></i>Admin Tools
                    </a>
                `;
                // Insert before logout
                logoutBtnLi.parentElement.insertBefore(adminLi, logoutBtnLi);

                // Add separator
                const sep = document.createElement('li');
                sep.innerHTML = '<hr class="dropdown-divider">';
                logoutBtnLi.parentElement.insertBefore(sep, logoutBtnLi);
            }

        } else {
            loginBtn.classList.remove('d-none');
            userMenu.classList.add('d-none');
        }
    },

    setupEventListeners() {
        // Login Form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            this.showMessage('Carregando...', 'info');

            const { error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('[Auth] Erro no login:', error);
                this.showMessage(`Erro: ${error.message} (Verifique o console para detalhes)`, 'danger');
            } else {
                this.showMessage('Login realizado com sucesso!', 'success');
                this.closeModal();
            }
        });

        // Register Form
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            this.showMessage('Criando conta...', 'info');

            const { error } = await window.supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) {
                this.showMessage(error.message, 'danger');
            } else {
                this.showMessage('Cadastro realizado! Verifique seu email para confirmar.', 'success');
                // Optional: Auto login logic if email confirmation is disabled
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) console.error('Error logging out:', error);
        });
    },

    showMessage(msg, type) {
        const el = document.getElementById('authMessage');
        el.className = `mt-3 alert alert-${type}`;
        el.textContent = msg;
        el.classList.remove('d-none');
    },

    closeModal() {
        const modalEl = document.getElementById('authModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Clear forms
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.getElementById('authMessage').classList.add('d-none');
    }
};

// Initialize only after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // We need to wait for supa-client to be ready, but it's simpler to just call init here
    // assuming scripts load in order
    if (window.supabaseClient) {
        AuthManager.init();
    } else {
        console.error("Supabase client not found!");
    }
});
