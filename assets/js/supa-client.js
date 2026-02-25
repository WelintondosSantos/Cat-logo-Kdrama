/**
 * supa-client.js - Inicializador do cliente Supabase
 *
 * As credenciais são carregadas a partir de assets/js/config.js
 * que está no .gitignore e não é rastreado pelo git.
 *
 * Para configurar, copie assets/js/config.example.js -> assets/js/config.js
 * e preencha com suas credenciais reais.
 */

if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    console.error(
        '[supa-client] ERRO: config.js não carregado ou credenciais não definidas.\n' +
        'Copie assets/js/config.example.js para assets/js/config.js e preencha as credenciais.'
    );
} else {
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = _supabase;
}
