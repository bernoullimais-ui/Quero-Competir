-- SCRIPT DE CONFIGURAÇÃO SUPABASE (VERSÃO REVISADA)
-- Copie e cole este script no seu SQL Editor do Supabase.

-- 1. Tabelas de Atletas / Membros
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    document_number TEXT,
    birth_date DATE,
    status TEXT DEFAULT 'authorized',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alias para compatibilidade caso existam referências antigas a 'athletes'
CREATE TABLE IF NOT EXISTS athletes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Inscrições de Instituições em Torneios
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, institution_id)
);

-- 3. Tabela de Times (Instituição em uma Categoria de um Torneio)
CREATE TABLE IF NOT EXISTS team_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    tournament_category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    availability JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, tournament_category_id, institution_id)
);

-- 4. Tabela de Membros do Time (Atletas)
-- Adicionamos FK explícita para o PostgREST reconhecer a relação corretamente
ALTER TABLE IF EXISTS team_members DROP CONSTRAINT IF EXISTS team_members_athlete_id_fkey;

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES team_registrations(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, athlete_id)
);

-- 5. Tabela de Partidas (Matches/Chaveamento)
-- Usamos CASCADE para garantir que dependências antigas não bloqueiem a recriação correta da estrutura
DROP TABLE IF EXISTS matches CASCADE;

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    tournament_category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE,
    team1_id UUID REFERENCES team_registrations(id) ON DELETE CASCADE,
    team2_id UUID REFERENCES team_registrations(id) ON DELETE CASCADE,
    score1 INTEGER DEFAULT 0,
    score2 INTEGER DEFAULT 0,
    winner_id UUID REFERENCES team_registrations(id),
    round INTEGER DEFAULT 1,
    match_index INTEGER,
    group_label TEXT, -- A, B, C, etc.
    status TEXT DEFAULT 'scheduled', -- scheduled, finished
    timer_base_seconds INTEGER DEFAULT 0,
    timer_last_started_at TIMESTAMP WITH TIME ZONE,
    is_timer_running BOOLEAN DEFAULT false,
    period TEXT DEFAULT '1º Tempo', -- 1º Tempo, Intervalo, 2º Tempo, Fim
    report TEXT,
    mvp_athlete_id UUID REFERENCES members(id),
    roster1 JSONB DEFAULT '{}'::jsonb,
    roster2 JSONB DEFAULT '{}'::jsonb,
    next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    phase_index INTEGER DEFAULT 1,
    phase_name TEXT DEFAULT 'Fase Única',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de Eventos da Partida (Gols, Cartões, etc)
-- DROP e CREATE para garantir que a estrutura esteja 100% correta
DROP TABLE IF EXISTS match_events CASCADE;

CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID REFERENCES team_registrations(id) ON DELETE CASCADE,
    athlete_id UUID,
    event_type TEXT NOT NULL, -- goal, yellow_card, red_card
    event_time TEXT, -- ex: "10:25"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabela de Staff (Árbitros e Mesários)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- referee, table_official
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Atualização com campos de escala
ALTER TABLE matches ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS court TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS referee1_id UUID REFERENCES staff(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS referee2_id UUID REFERENCES staff(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS table_official_id UUID REFERENCES staff(id);

-- 11. Tabela de Sedes (Venues)
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    availability JSONB DEFAULT '[]'::jsonb, -- Array de disponibilidades: [{day: 'Segunda', start: '08:00', end: '22:00'}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Vínculo de Partida com Sede
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- 13. FORÇAR DESATIVAÇÃO DO RLS E LIMPEZA DE POLÍTICAS EM TODAS AS TABELAS
DO $$ 
DECLARE
    t TEXT;
    pol RECORD;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'members', 'athletes', 'tournament_registrations', 'team_registrations', 
        'team_members', 'matches', 'match_events', 'institutions', 
        'tournaments', 'tournament_categories', 'staff', 'venues'
    )
    LOOP
        -- Desativa RLS
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        
        -- Remove todas as políticas existentes
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
        END LOOP;
        
        -- Cria política de acesso total
        EXECUTE format('CREATE POLICY "Public Full Access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
