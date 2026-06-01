-- MIGRATION: ANUIDADE E FILIAÇÃO ESPORTIVA
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Extensão da tabela organizations (Configurações Gerais de Filiação do Organizador)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS requires_membership_fee BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS membership_fee_amount NUMERIC DEFAULT 0;

-- 2. Extensão da tabela tournament_subscription_settings (Obrigatoriedade por Torneio)
ALTER TABLE tournament_subscription_settings ADD COLUMN IF NOT EXISTS require_membership BOOLEAN DEFAULT false;

-- 3. Criar tabela memberships (Anuidades/Filiações dos Atletas nas Ligas)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'pending'
    payment_status VARCHAR(50) DEFAULT 'paid', -- 'pending', 'paid'
    payment_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, member_id, year)
);

-- 4. Desativar RLS para consistência com o restante das tabelas de configuração local do projeto
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON memberships;
CREATE POLICY "Public Full Access" ON memberships FOR ALL USING (true) WITH CHECK (true);
