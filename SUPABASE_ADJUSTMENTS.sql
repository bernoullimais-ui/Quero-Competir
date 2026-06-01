-- SCRIPT DE AJUSTE PARA SUPABASE: PARÂMETROS DE INSCRIÇÕES E TAXAS
-- Copie e cole este script no seu SQL Editor do Supabase e clique em "Run".

-- 1. Criar tabela de Configurações de Inscrição e Taxas por Torneio
CREATE TABLE IF NOT EXISTS tournament_subscription_settings (
    tournament_id UUID PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
    deadline TEXT,
    fee_type TEXT DEFAULT 'free', -- 'free', 'by_team', 'by_team_and_athlete_institution', 'by_team_and_athlete_parent'
    team_fee NUMERIC DEFAULT 0,
    athlete_fee NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'open', -- 'open', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de Inscrições/Pré-indicações de Atletas por Instituição
CREATE TABLE IF NOT EXISTS athlete_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE,
    athlete_name TEXT NOT NULL,
    birth_date DATE,
    document TEXT,
    gender TEXT DEFAULT 'Masculino',
    is_completed BOOLEAN DEFAULT false,
    validation_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    validation_feedback TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    parent_name TEXT,
    parent_phone TEXT,
    additional_data JSONB DEFAULT '{}'::jsonb,
    document_url TEXT,
    authorized_image_use BOOLEAN DEFAULT false,
    liability_waiver BOOLEAN DEFAULT false,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Desativar Row Level Security (RLS) e criar políticas públicas de acesso total
ALTER TABLE tournament_subscription_settings DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON tournament_subscription_settings;
CREATE POLICY "Public Full Access" ON tournament_subscription_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE athlete_subscriptions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON athlete_subscriptions;
CREATE POLICY "Public Full Access" ON athlete_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- 4. Adicionar coluna para configurações de inscrição customizada
ALTER TABLE tournament_subscription_settings ADD COLUMN IF NOT EXISTS registration_config JSONB DEFAULT '{}'::jsonb;

-- 5. Suporte para Lista de Visitantes e Portal das Sedes
ALTER TABLE tournament_subscription_settings ADD COLUMN IF NOT EXISTS max_visitors_per_athlete INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS match_visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, athlete_id, document)
);

ALTER TABLE match_visitors DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON match_visitors;
CREATE POLICY "Public Full Access" ON match_visitors FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE portal_accounts DROP CONSTRAINT IF EXISTS portal_accounts_role_check;
ALTER TABLE portal_accounts ADD CONSTRAINT portal_accounts_role_check CHECK (role IN ('super_admin', 'organizer', 'institution', 'guardian', 'venue'));


