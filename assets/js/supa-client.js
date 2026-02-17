
// Substitua estas variáveis pelas suas credenciais do Supabase
const SUPABASE_URL = 'https://cmnucjvaahprkgfrcsfh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LRSL0mhfOrUvG9ksQbnt4A_jJ7kSSkz';

// Inicializa o cliente Supabase
// Certifique-se de que a biblioteca supabase-js foi carregada antes deste script
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exporta o cliente para uso em outros arquivos (se estiver usando módulos)
// ou deixa disponível globalmente se for script normal.
// Para este projeto simples, vamos deixar global, mas estruturado.
window.supabaseClient = _supabase;
