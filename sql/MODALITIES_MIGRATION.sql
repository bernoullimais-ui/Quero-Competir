-- MIGRATION: SUPORTE A SETS E MODALIDADES (BALEADO / QUEIMADA)
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. Detalhamento de Sets/Parciais na tabela de partidas (matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sets_detail JSONB DEFAULT '[]'::jsonb;
-- Exemplo de estrutura: [{"team1_baleados": 10, "team2_baleados": 5, "duration_seconds": 450, "win_type": "elimination"}]
-- ou [{"team1": 25, "team2": 18}, {"team1": 21, "team2": 25}] (Vôlei)

-- 2. Configurações de regras e parâmetros de pontuação da categoria (tournament_categories)
ALTER TABLE tournament_categories ADD COLUMN IF NOT EXISTS rules_config JSONB DEFAULT '{}'::jsonb;
-- Exemplo de estrutura: {"points_win_elimination": 3, "points_win_time": 2, "match_format": "best_of_3", "sport_type": "dodgeball"}

-- 3. Adicionar coluna de período nos eventos da partida (match_events)
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS period TEXT DEFAULT '1º Tempo';
