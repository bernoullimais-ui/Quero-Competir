-- ArenaSaaS - Schema Inicial (PostgreSQL)
-- Engenharia de Dados para Competições Esportivas

-- 1. Instituições (Escolas/Clubes)
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(14) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    responsible_name VARCHAR(255) NOT NULL,
    responsible_phone VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Torneios / Competições
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL, -- Referência ao Organizador (User System)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rules_url TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, finished, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Modalidades & Categorias (Matriz Flexível)
CREATE TABLE modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- ex: Futsal, Volei
    icon_url TEXT
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- ex: Sub-15, Aberto
    gender VARCHAR(20) NOT NULL, -- Masculino, Feminino, Misto
    min_age INT,
    max_age INT,
    UNIQUE(modality_id, name, gender)
);

-- 4. Membros / Atletas (Vínculo Institucional)
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(50) UNIQUE NOT NULL, -- RG/CPF
    birth_date DATE NOT NULL,
    photo_url TEXT,
    status VARCHAR(50) DEFAULT 'authorized', -- authorized, pending, blocked
    parent_data JSONB DEFAULT '{}', -- Dados dos responsáveis para menores
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Inscrições (Onde o Atleta se vincula a uma Categoria de um Torneio)
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id),
    category_id UUID REFERENCES categories(id),
    institution_id UUID REFERENCES institutions(id),
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, refunded
    payment_id VARCHAR(255), -- Referência do Gateway (Stripe/Pix)
    document_bundle_url TEXT, -- ZIP ou link para documentos assinados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, member_id, category_id) -- Impede inscrição duplicada na mesma categoria
);

-- 6. Partidas e Resultados (Súmulas)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id),
    category_id UUID REFERENCES categories(id),
    phase VARCHAR(100), -- ex: Oitavas, Final, Grupo A
    team_a_data JSONB, -- ID da Instituição ou Nome do Atleta + Score
    team_b_data JSONB,
    scheduled_time TIMESTAMPTZ,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, ongoing, finished, forfeited
    scoresheet_data JSONB DEFAULT '{}', -- Log completo de eventos da partida
    referee_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices Sugeridos
CREATE INDEX idx_registrations_tournament ON event_registrations(tournament_id);
CREATE INDEX idx_members_institution ON members(institution_id);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_time);

-- 7. Comunidade do Torneio (Publicações, Fotos, Vídeos)
CREATE TABLE tournament_posts (
    id VARCHAR(50) PRIMARY KEY,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    author_type VARCHAR(50) NOT NULL, -- organizer, athlete, fan, guest
    author_name VARCHAR(255) NOT NULL,
    author_avatar VARCHAR(50),
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20) DEFAULT 'none', -- image, video, none
    reactions JSONB DEFAULT '{"like": 0, "love": 0, "applause": 0}',
    comments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_tournament_id ON tournament_posts(tournament_id);

