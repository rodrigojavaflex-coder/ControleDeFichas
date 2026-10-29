# Encoding — sistemas legados (Firebird → agente → backend)

## Contexto

Bancos Firebird/InterBase brasileiros costumam usar charset **`NONE`** com bytes **WIN1252**. A conversão correta está em:

- `backend/src/common/utils/encoding-legado.util.ts`
- `agent/src/common/encoding.util.ts` (mesma lógica)

## Causa raiz (médicos JÚLIA→JÉLIA, ÁRABE→ÇRABE)

1. `node-firebird` com `DB_CHARSET=NONE` (ou UTF8) devolve **`U+FFFD`** no lugar dos bytes acentuados.
2. `converterTextoFirebird` fazia `Buffer.from(str, 'latin1')` → `FFFD` vira byte `0xFD` → decode WIN1252 = **`ý`**.
3. `fixCorruptedChars` mapeava `XýY`→`XÉY` e `ý` residual→`Ç`.

## Correção preventiva (agente)

- Campos de nome (`NOMEMED`, `NOMEFUN`, etc.) saem como  
  `CAST(campo AS VARCHAR(n) CHARACTER SET OCTETS)` → **Buffer** → `iconv` WIN1252.
- Strings que ainda cheguem com `\uFFFD` **não** são reinterpretadas via latin1 (não inventar `ý`).
- Helper: `decodificarBytesFirebird` / `sqlTextoOctets` em `agent/src/database/database.service.ts`.

### Configuração

`agent/.env`: `DB_CHARSET=NONE` (não passar charset ao driver; bytes via OCTETS). Ver `agent/env.example`.

## Backend (sync + reparo)

| Função | Uso |
|--------|--------|
| `decodificarBytesFirebird` | Buffer OCTETS → UTF-8 |
| `converterTextoFirebird` | Buffer/texto; **não** recupera FFFD sem bytes |
| `padronizarNomeDeSistemaLegado` | Sync: só iconv se suspeito; maiúsculas pt-BR |
| `POST /sincronizacao/reparar-nomes-medicos` | Dry-run/apply: CRM+UF × agentes `/api/v1/prescritores/cadastro` |

Upsert de prescritor: busca por **CRM + UF** e atualiza o nome (não exige nome igual na busca). Índice único parcial `uq_prescritores_numero_crm_uf`.

### Nome canônico (arquitetura)

| Onde | Nome do médico |
|------|----------------|
| `prescritores` | **Fonte canônica** (único lugar de sync/reparo) |
| painel / orçamentos / caixa | Só CRM+UF; leitura com `LEFT JOIN prescritores` |
| `visitacao_fechamento_*` | **Retrato** — nome congelado no fechar |
| `painel_medicos_representantes_historico` | Snapshot na remoção |

Sync de painel/orçamentos/caixa chama `garantirPrescritorPorCrmUf` e **não** grava nome nas satélites.

## Ordem de deploy (produção)

1. **Agente primeiro (uma unidade)** — OCTETS + `/prescritores/cadastro`. Syncs normais mantêm o mesmo JSON; só melhora encoding.
2. Validar OCTETS nessa unidade (script abaixo). Só então roll-out dos demais agents.
3. **Backend + migration `175072` no mesmo release** (startup com `DATABASE_SYNCHRONIZE=false` ou `NODE_ENV=production`). Logs: `[175072] …`.
4. Conferir schema com `npm run verificar:nome-canonico`.
5. Reparo dry-run/apply por unidade + validar Visitação ao vivo (retratos fechados mantêm snapshot).

## Reparo operacional

1. Todos os agents com `GET /api/v1/prescritores/cadastro` (404 = agent antigo).
2. Migration `175072` aplicada (backfill + UNIQUE + drop satélites; retrato/histórico intactos).
3. Configuração → **Importação** → **Reparar nomes de médicos**.
4. Escolher **unidade** (recomendado: uma por vez, ex. UBERABA).
5. **Dry-run** → marcar/desmarcar → **Aplicar selecionados** (só `prescritores.nome`).
6. **Relatório pendentes** (CSV) se necessário.
7. Validar Visitação **ao vivo** (ex.: JÚLIA 85878/MG, PAULA ÁRABE 50837/MG). Retratos já fechados não recalculam nome.

## Validação (scripts)

Variáveis no shell — **não** colar tokens no chat/docs.

```powershell
# 1) OCTETS + cadastro (cwd agent) — uma unidade por vez
$env:AGENT_URL="https://agente-da-unidade"
$env:AUTH_TOKEN="..."   # token do agente
cd agent
npm run build
npm run validar:octets

# 2) Schema pós-migration (cwd backend, DB no ambiente)
cd backend
npm run build:nest
npm run verificar:nome-canonico
# No boot: procurar logs [175072]

# 3) Reparo dry-run + aceite em tela
$env:API_URL="https://api-nest"
$env:API_TOKEN="..."    # JWT com configuracao:access
$env:UNIDADE="UBERABA"
npm run reparar:nomes-dry-run
# Depois: UI Aplicar selecionados; conferir grade ao vivo vs retrato fechado
```

Critérios OCTETS: JSON com JÚLIA / ÁRABE / GONÇALVES — sem `` / JÉLIA / ÇRABE / `\uFFFD`.

Reparo NEST (`reparar-nomes-medicos`): o nome ERP da lista é o da base para aquele CRM+UF. Colisão (nomes distintos na mesma chave) → pendente ambíguo, sem `scoreNome` escolhendo outra pessoa. Divergência com nome único → motivo **Nome diferente**.
