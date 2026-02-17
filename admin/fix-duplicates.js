/**
 * Fix para remover duplicatas - Carrega automaticamente
 */
console.log('🔧 Script de remoção de duplicatas carregado');

// Sobrescrever a função removeDuplicates existente
window.removeDuplicates = async function () {
    console.log('🔍 Iniciando remoção de duplicatas...');

    if (!window.supabaseClient) {
        alert('❌ Erro: Cliente Supabase não disponível');
        return;
    }

    try {
        // Buscar todos os atores
        const { data: actors, error } = await window.supabaseClient
            .from('atores')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Erro:', error);
            alert('Erro ao buscar atores: ' + error.message);
            return;
        }

        // Identificar duplicatas
        const nameMap = new Map();
        const duplicates = [];

        actors.forEach(actor => {
            const name = actor.name.trim().toLowerCase();
            if (nameMap.has(name)) {
                duplicates.push(actor);
            } else {
                nameMap.set(name, actor);
            }
        });

        if (duplicates.length === 0) {
            alert('✅ Nenhuma duplicata encontrada!');
            return;
        }

        // Mostrar confirmação
        const msg = `Encontradas ${duplicates.length} duplicata(s):\n\n` +
            duplicates.map(d => `• ${d.name} (ID: ${d.id})`).join('\n') +
            `\n\nDeseja remover?`;

        if (!confirm(msg)) {
            return;
        }

        // Remover uma por uma
        let removed = 0;
        for (const dup of duplicates) {
            const { error: delError } = await window.supabaseClient
                .from('atores')
                .delete()
                .eq('id', dup.id);

            if (!delError) {
                removed++;
                console.log(`✅ Removido: ${dup.name} (ID: ${dup.id})`);
            } else {
                console.error(`❌ Erro ao remover ${dup.name}:`, delError);
            }
        }

        alert(`✅ ${removed} duplicata(s) removida(s)!`);

        // Recarregar
        if (typeof loadActors === 'function') {
            loadActors();
        } else {
            location.reload();
        }

    } catch (error) {
        console.error('Erro:', error);
        alert('Erro: ' + error.message);
    }
};

console.log('✅ Função removeDuplicates() atualizada e pronta!');
