# Encoding — sistemas legados (Firebird → agente → backend)

## Contexto

Bancos Firebird brasileiros costumam usar charset **`NONE`** ou **`WIN1252`**. A conversão correta está centralizada em:

- `backend/src/common/utils/encoding-legado.util.ts`
- `agent/src/common/encoding.util.ts` (mesma lógica)

Referência histórica: migração legada via `FirebirdConnectionService` (agora delega ao util).

---

## Agente (origem)

### Conexão Firebird (igual migração)

- `DB_CHARSET=NONE` (default): **não** passa `charset` ao `node-firebird`.
- Conversão WIN1252 → UTF-8 em **todo** resultado via `converterObjetoFirebird`.

### Onde é aplicado

`agent/src/database/database.service.ts` — após cada query, antes dos mappers:

- Clientes, prescritores, orçamentos, vendas (campos texto).

### Configuração

`agent/.env`: `DB_CHARSET=NONE` (recomendado para `.fdb` brasileiros). Ver `agent/env.example`.

---

## Backend (sync + migração)

### Funções principais

| Função | Uso |
|--------|--------|
| `converterTextoFirebird` | Leitura Firebird / texto suspeito |
| `converterObjetoFirebird` | Linha/objeto inteiro do Firebird |
| `padronizarNomeDeSistemaLegado` | Sync: corrige se suspeito + maiúsculas pt-BR |
| `corrigirPadroesGravadosErrados` | JÇ→JÉ, …ÇO→…ÃO (dados já gravados errado) |

### Onde é aplicado

- **`sincronizacao.service.ts`**: clientes, prescritores, orçamentos.
- **`firebird-connection.service.ts`**: migração clientes/prescritores (delega ao util).

Na sync, se o JSON do agente já estiver correto, **não** re-aplica iconv (evita corromper UTF-8 válido).

---

## Regras de correção (fixCorruptedChars)

Ordem relevante:

1. `ÇýO` → `ÇÃO` (ASSUNÇÃO)
2. `XýO` → `XÃO` (SIMÃO)
3. `XýY` → `XÉY` (JÉSSICA)
4. `NýA` → `NÇA` (GONÇALVES)
5. Padrões gravados: `JÇS` → `JÉS`, `…ÇO` → `…ÃO` (exceto MARÇO, MAÇO, etc.)

---

## Dados antigos

Sem migration de correção em massa. Para repopular:

1. Deploy agente + `DB_CHARSET=NONE`.
2. Limpar/re-sync tabelas afetadas (`orcamentos`, etc.).

---

## Validação

1. `cd agent && npm run build`
2. `cd backend && npx nest build`
3. Conferir JSON do agente e lista de rejeitados: JÉSSICA, SIMÃO, GONÇALVES, ASSUNÇÃO.
