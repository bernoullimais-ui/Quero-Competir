# Arquitetura da Súmula Offline (ArenaSaaS)

Para o Módulo 3 (Live Operations), a súmula digital deve ser resiliente. Abaixo, a estratégia técnica para o mesário trabalhar em quadras sem conexão.

## 1. Estrutura do JSON de Download (Pre-flight)
Antes do início da rodada, o mesário baixa um "Caderno de Partidas".
```json
{
  "referee_id": "uuid-referee-1",
  "sync_timestamp": "2024-05-16T10:00:00Z",
  "matches": [
    {
      "match_id": "match-882",
      "category": "Futsal Sub-15 Masc",
      "team_a": { "id": "inst-1", "name": "Colégio A", "players": [...] },
      "team_b": { "id": "inst-2", "name": "Colégio B", "players": [...] },
      "location": "Quadra Central",
      "rules": { "period_duration": 20, "max_fouls": 5 }
    }
  ],
  "lookups": { "event_types": ["goal", "yellow_card", "red_card", "timeout"] }
}
```

## 2. Gerenciamento de Estado Local
- **Tecnologia:** **IndexedDB** (via `Dexie.js`).
- **Por que não LocalStorage?** LocalStorage é síncrono e tem limite de ~5MB. O IndexedDB permite armazenar grandes volumes de dados (fotos de atletas para conferência) e opera de forma assíncrona, não travando a UI do mesário.
- **Estrutura:** Duas tabelas locais: `matches` (cache de leitura) e `sync_queue` (cache de escrita).

## 3. Fila de Sincronização (Sync Queue)
Cada ação do mesário (ex: gol marcado) gera um evento no IndexedDB:
```json
{
  "id": "temp-uuid-99",
  "action": "ADD_EVENT",
  "payload": { "match_id": "882", "type": "goal", "player_id": "at-12", "time": "12:04" },
  "status": "pending_sync"
}
```

### Resolução de Conflitos (Conflict Handling)
1. **Timestamp Authority:** O servidor sempre confia no timestamp do evento gerado no cliente (mesário), desde que esteja dentro da janela da partida.
2. **Last-Write-Wins (LWW):** Para metadados da partida.
3. **Event Sourcing:** Ao invés de enviar o "Placar Final", o cliente envia a lista de eventos. O servidor reconstrói o placar. Isso evita que uma falha de rede sobrescreva o placar real.

## 4. Estratégia de Sync
- **Service Workers:** Detectam a volta da conexão (`navigator.onLine`).
- **Background Sync API:** Tenta descarregar a `sync_queue` mesmo com o browser em background.
- **Feedback Visual:** Indicador de "Nuvem cortada" ou "Sincronizado" para o mesário ter segurança.
