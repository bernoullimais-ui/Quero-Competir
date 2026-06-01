-- MIGRATION: SISTEMA DE CONTAS DO PORTAL E ISOLAMENTO DE DADOS
-- Execute este script no SQL Editor do Supabase para suportar autenticação JWT e isolamento de staff/sedes.

-- 1. Criar tabela de contas unificadas do portal (fallbacks locais continuam no JSON se offline)
CREATE TABLE IF NOT EXISTS portal_accounts (
    id TEXT PRIMARY KEY, -- Suporta IDs legados (ex: 'org-1') e UUIDs do Supabase Auth
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'organizer', 'institution', 'guardian')),
    name TEXT NOT NULL,
    reference_id UUID, -- Referência dinâmica para instituição (institutions.id) ou organizador (organizations.id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar coluna organizer_id nas tabelas staff e venues para isolamento por organizador
ALTER TABLE staff ADD COLUMN IF NOT EXISTS organizer_id TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS organizer_id TEXT;

-- 3. Desativar RLS para garantir acesso público e compatibilidade (opcional, mantendo padrão das demais tabelas do projeto)
ALTER TABLE portal_accounts DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access" ON portal_accounts;
CREATE POLICY "Public Full Access" ON portal_accounts FOR ALL USING (true) WITH CHECK (true);
