-- 1. Adicionar limite de visitantes por atleta na tabela de configurações
ALTER TABLE tournament_subscription_settings 
ADD COLUMN IF NOT EXISTS max_visitors_per_athlete INTEGER DEFAULT 0;

-- 2. Criar tabela de visitantes vinculados à partida e ao atleta
CREATE TABLE IF NOT EXISTS match_visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, athlete_id, document)
);

-- Desativar RLS para match_visitors e criar política de acesso público total
ALTER TABLE match_visitors DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON match_visitors;
CREATE POLICY "Public Full Access" ON match_visitors FOR ALL USING (true) WITH CHECK (true);

-- 3. Atualizar restrição CHECK de roles em portal_accounts para aceitar 'venue'
ALTER TABLE portal_accounts DROP CONSTRAINT IF EXISTS portal_accounts_role_check;
ALTER TABLE portal_accounts ADD CONSTRAINT portal_accounts_role_check CHECK (role IN ('super_admin', 'organizer', 'institution', 'guardian', 'venue'));
