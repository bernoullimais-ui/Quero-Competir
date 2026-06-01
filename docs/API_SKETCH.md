# Esboço das Rotas de API (ArenaSaaS)

Baseado no Módulo 1 (Onboarding) e Módulo 3 (Live Ops).

## Módulo 1: Onboarding e Validação

### 1. Registro de Instituição
- **POST** `/api/institutions`
- **Payload:** `{ "name": "...", "cnpj": "...", "email": "..." }`
- **Response 210:** `{ "id": "uuid", "onboarding_url": "..." }`

### 2. Candidatar Membro (Pela Instituição)
- **POST** `/api/institutions/:id/pre-register`
- **Payload:** `{ "full_name": "...", "document": "...", "birth_date": "..." }`
- **Obs:** Isso alimenta o "Filtro de Segurança". O atleta só pode se inscrever no torneio final se CPF/RG estiver nesta lista prévia.

### 3. Inscrição Individual Final
- **POST** `/api/tournaments/:tid/register`
- **Payload:** `{ "member_id": "...", "category_id": "...", "documents": { "rg_url": "...", "term_signed": true } }`

---

## Módulo 3: Sorteio e Súmulas

### 1. Gerar Chaveamento (Sorteio)
- **POST** `/api/tournaments/:tid/categories/:cid/brackets/generate`
- **Payload:** `{ "algorithm": "single_elimination", "seed_ids": [...] }`
- **Response 210:** `{ "bracket_id": "...", "matches_count": 16 }`

### 2. Upload de Súmula (Pós-Sync Offline)
- **PUT** `/api/matches/:id/scoresheet`
- **Payload:** `{ "events": [...], "final_score": { "a": 2, "b": 1 }, "finished_at": "..." }`
- **Response 200:** Resulta em atualização automática de tabelas e artilharia no Módulo 4.
