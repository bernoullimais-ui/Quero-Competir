-- Adicionar colunas de controle de fase na tabela de partidas (matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase_index INTEGER DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase_name TEXT DEFAULT 'Fase Única';
