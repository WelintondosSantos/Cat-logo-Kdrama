/**
 * auth.js - Módulo central de autenticação para o painel Admin
 * 
 * Inclua este script EM TODAS as páginas admin, ANTES de qualquer
 * conteúdo ser renderizado. Ele verifica se o usuário está logado
 * e se tem permissão de admin.
 * 
 * Dependências (carregar na ordem):
 *   1. supabase-js (CDN)
 *   2. config.js  ← contém ADMIN_EMAILS
 *   3. supa-client.js  ← inicializa window.supabaseClient
 *   4. auth.js  (este arquivo)
 */

(async function adminAuthCheck() {
    // Garante que o cliente Supabase existe antes de continuar
    if (typeof window.supabaseClient === 'undefined') {
        console.error('[Auth] supabaseClient não encontrado. Verifique a ordem dos scripts.');
        document.body.innerHTML = '<p style="color:red;padding:2rem;">Erro: cliente Supabase não inicializado.</p>';
        return;
    }

    // Garante que o ADMIN_EMAILS existe (definido em config.js)
    const allowedEmails = (typeof ADMIN_EMAILS !== 'undefined') ? ADMIN_EMAILS : [];

    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();

        if (error || !session) {
            alert('Acesso restrito. Faça login primeiro.');
            window.location.href = '../index.html';
            return;
        }

        const userEmail = session.user.email;

        if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
            alert('Acesso negado. Você não tem permissão para acessar esta área.');
            window.location.href = '../index.html';
            return;
        }

        // Autenticado com sucesso — remove o overlay de loading se existir
        const overlay = document.getElementById('admin-loading-overlay');
        if (overlay) overlay.remove();

    } catch (e) {
        console.error('[Auth] Erro inesperado durante verificação de autenticação:', e);
        alert('Erro de autenticação. Redirecionando...');
        window.location.href = '../index.html';
    }
})();
