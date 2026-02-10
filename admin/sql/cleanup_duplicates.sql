-- ALERTA: Execute este script no Editor SQL (SQL Editor) do seu painel Supabase.
-- Este script remove duplicatas da tabela 'dramas', mantendo apenas o ID mais antigo.
-- Ele também corrige referências na tabela 'user_library' para não perder dados de usuários.

DO $$
DECLARE
    r RECORD;
    kept_id BIGINT;
    count_dups INTEGER;
BEGIN
    RAISE NOTICE 'Iniciando limpeza de duplicatas...';

    -- Loop por todos os títulos que têm duplicatas (ignorando maiúsculas/minúsculas e espaços extras)
    FOR r IN 
        SELECT lower(trim(title)) as processed_title, text(title) as original_title
        FROM dramas
        GROUP BY lower(trim(title)), text(title)
        HAVING COUNT(*) > 1
    LOOP
        -- Encontrar o ID que vamos MANTER (o menor ID, ou seja, o mais antigo)
        SELECT min(id) INTO kept_id
        FROM dramas
        WHERE lower(trim(title)) = r.processed_title;
        
        RAISE NOTICE 'Processando: % (Mantendo ID: %)', r.original_title, kept_id;

        -- 1. Atualizar user_library: Mover dados de usuários das duplicatas para o drama mantido
        -- mas APENAS se o usuário AINDA NÃO tiver dados para o drama mantido.
        UPDATE user_library
        SET drama_id = kept_id
        WHERE drama_id IN (
            SELECT id FROM dramas 
            WHERE lower(trim(title)) = r.processed_title 
            AND id != kept_id
        )
        AND (user_id, kept_id) NOT IN (SELECT user_id, drama_id FROM user_library);

        -- 2. Remover referências restantes em user_library que causariam conflito
        -- (caso o usuário tenha interagido com APBOS, mantemos o do ID original e descartamos o da duplicata)
        DELETE FROM user_library
        WHERE drama_id IN (
            SELECT id FROM dramas 
            WHERE lower(trim(title)) = r.processed_title 
            AND id != kept_id
        );

        -- 3. Excluir os dramas duplicados
        DELETE FROM dramas
        WHERE lower(trim(title)) = r.processed_title 
        AND id != kept_id;
        
    END LOOP;

    RAISE NOTICE 'Limpeza concluída com sucesso!';
END $$;
