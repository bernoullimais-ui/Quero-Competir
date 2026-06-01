# 🏆 Quero Competir — Plataforma de Gestão de Torneios Esportivos

O **Quero Competir** é uma plataforma SaaS moderna e robusta para gerenciamento de torneios esportivos de ponta a ponta, desenvolvida para simplificar inscrições, gerenciar chaveamentos, coordenar arbitragem em tempo real e fornecer acompanhamento público das competições.

---

## 🚀 Funcionalidades Principais

- **Segurança Avançada**: Controle de acessos robusto via JWT e hashes de senha usando `bcryptjs`.
- **Modo Offline & Súmula de Bolso**: Sistema offline-first que permite que árbitros e mesários registrem placares e eventos em quadra (gols, faltas, cartões) sem internet, sincronizando os dados automaticamente assim que a conexão for restabelecida.
- **Inscrições Regulamentares**: Fluxo inteligente de validação de documentos, com prazos e acompanhamento em conformidade com o regulamento do torneio.
- **Visualização Pública**: Chaveamento, classificação e comunidade de livre acesso a torcedores, atletas e responsáveis.
- **Arquitetura Escalável**: Interface desenvolvida com React e Tailwind CSS v4, integrada a uma API REST robusta baseada em Express e Supabase/PostgreSQL.

---

## 🛠️ Stack Tecnológica

### Frontend
- **Framework**: React 18 / Vite
- **Estilização**: Tailwind CSS v4 (Glassmorphism & UX premium)
- **Animações**: Motion (antigo Framer Motion)
- **Gerenciamento de Requisições**: `@tanstack/react-query`

### Backend
- **Servidor**: Node.js & Express
- **Autenticação**: JSON Web Tokens (JWT) & Bcryptjs
- **Banco de Dados**: Supabase (PostgreSQL)

---

## ⚙️ Configuração do Ambiente

### 1. Requisitos
- **Node.js** (versão 18 ou superior)
- **NPM** ou gerenciador de pacotes equivalente

### 2. Variáveis de Ambiente
Crie um arquivo `.env` no diretório raiz (ou configure em seu ambiente de produção) com as seguintes chaves:

```env
PORT=5001
JWT_SECRET=sua_chave_secreta_super_segura_aqui

# Supabase URL e Chave Pública/Privada de Serviço
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_supabase_service_role_key

# Gemini API Key (para recursos de IA recomendados)
GEMINI_API_KEY=seu_api_key_do_gemini
```

### 3. Migração do Banco de Dados
Para configurar a estrutura das tabelas no seu banco de dados Supabase:

1. Execute o script principal de tabelas e esquemas:
   - [/SUPABASE_SETUP.sql](file:///Users/brunomaia/Developer/quero-competir/SUPABASE_SETUP.sql) ou [/sql/schema.sql](file:///Users/brunomaia/Developer/quero-competir/sql/schema.sql) no editor SQL do painel do seu projeto Supabase.
2. Execute o script de ajustes para customizações do sistema de contas e organizadores:
   - [/sql/ACCOUNTS_MIGRATION.sql](file:///Users/brunomaia/Developer/quero-competir/sql/ACCOUNTS_MIGRATION.sql)
   - [/SUPABASE_ADJUSTMENTS.sql](file:///Users/brunomaia/Developer/quero-competir/SUPABASE_ADJUSTMENTS.sql)

---

## 📦 Como Executar Localmente

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Iniciar em Ambiente de Desenvolvimento** (Vite Dev Server + Express Local Server):
   ```bash
   npm run dev
   ```

3. **Compilar para Produção**:
   ```bash
   npm run build
   ```

4. **Executar em Produção**:
   ```bash
   npm start
   ```

---

## 📂 Organização do Código

```
├── sql/                        # Scripts SQL de Migração do Banco de Dados
├── src/
│   ├── backend/                # Rotas, Middlewares e Controllers Express
│   ├── components/             # Componentes React de Negócio e Páginas
│   │   ├── ui/                 # Componentes genéricos reutilizáveis (Toast, Confirm, etc.)
│   │   ├── CategoriesTab.tsx   # Painel de gestão de modalidades
│   │   ├── SubscriptionsTab.tsx # Auditoria e controle de inscrições
│   │   └── MatchModal.tsx      # Lançador e cronômetro de partidas
│   ├── lib/                    # Configurações de clientes (ex: supabase)
│   ├── types/                  # Definições de Tipos TypeScript
│   ├── App.tsx                 # Roteamento principal e Drawer de Navegação Mobile
│   ├── main.tsx                # Entrada principal da SPA
│   └── index.css               # Folha de estilos globais
├── server.ts                   # Servidor de entrada Node.js Express
└── package.json                # Gerenciamento de scripts e dependências
```

---

## 🔒 Boas Práticas e Segurança

- Todos os endpoints sob `/api/tournaments` e rotas administrativas são protegidos com autenticação obrigatória via JWT utilizando o middleware `requireAuth`.
- As senhas das contas das instituições e organizadores são convertidas em hash bcrypt antes de persistirem no banco de dados, protegendo a segurança das credenciais.
- A sincronização em lote garante integridade transacional na reconciliação de eventos criados em modo offline.
