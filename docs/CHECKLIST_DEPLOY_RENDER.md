# Checklist — validação e deploy no Render

> Última revisão: 2026-07-22  
> Serviço: `controle-de-fichas-api` (backend + frontend estático no mesmo Web Service)

---

## 1. Pré-requisitos locais (antes do push)

- [ ] `node -v` — **24.x** (`.nvmrc` na raiz) ou mínimo **22.12+** / **20.19+** (Angular 21)
- [ ] Build produção OK:

```powershell
cd C:\PROJETOS\NEST_ANGULAR\backend
npm install
npm run build
```

- [ ] Artefatos gerados:
  - `frontend/dist/frontend/browser/index.html`
  - `backend/dist/main.js`
- [ ] `frontend/src/environments/environment.prod.ts` → `apiUrl: 'https://controledefichas.onrender.com/api'`
- [ ] Alterações commitadas e push em `master` (dispara GitHub Action + Auto-Deploy Render, se configurado)

**PowerShell:** não use `&&` — um comando por linha ou `;`.

---

## 2. Configuração no painel Render

### Build & Deploy (`render.yaml` + painel)

| Item | Valor esperado |
|------|----------------|
| Root directory | `backend` |
| Build | `NODE_ENV=development npm install` + `npm run build` |
| Start | `npm run start:prod` |
| Health check | `/api` |
| **Node version** | **24** (recomendado, alinhado ao dev) ou **22** |

> O `render.yaml` não fixa versão do Node — definir em **Settings → Node** ou variável `NODE_VERSION=24`.

### Variáveis obrigatórias (nomes em `backend/.env.example`)

- [ ] `NODE_ENV=production`
- [ ] `PORT` (Render injeta; default 10000 no yaml)
- [ ] `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- [ ] `DATABASE_SYNCHRONIZE=false`
- [ ] `JWT_SECRET` (Render pode gerar; não rotacionar sem planejar logout)
- [ ] `JWT_EXPIRES_IN`

### Agentes (sync Firebird)

- [ ] `AGENTE_INHUMAS_URL` + `AGENTE_INHUMAS_TOKEN`
- [ ] `AGENTE_NEROPOLIS_URL` + `AGENTE_NEROPOLIS_TOKEN`
- [ ] `AGENTE_UBERABA_URL` + `AGENTE_UBERABA_TOKEN`

Tokens devem coincidir com `AUTH_TOKEN` de cada agente na filial.

### WhatsApp (se produção usar recibo/atendimento)

- [ ] `WHATSAPP_ENABLED=true`
- [ ] `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_TEMPLATE_RECIBO_NAME`, `WHATSAPP_TEMPLATE_RECIBO_LANG`
- [ ] `WHATSAPP_CONTATO_DUVIDAS_NOME`, `WHATSAPP_CONTATO_DUVIDAS_NUMERO`
- [ ] Webhook (se ativo): `WHATSAPP_WEBHOOK_*`, `WHATSAPP_APP_SECRET`

---

## 3. Pós-deploy — smoke test produção

### API e app

- [ ] `GET https://controledefichas.onrender.com/api` — responde (health)
- [ ] `https://controledefichas.onrender.com/api/docs` — Swagger
- [ ] App carrega: `https://controledefichas.onrender.com/`
- [ ] Login com usuário real
- [ ] Banner de nova versão / `version.json` (anti-cache) — hard refresh após deploy

### Fluxos críticos (marcar o que aplicável)

- [ ] Vendas — listagem + export Excel
- [ ] Folha — lançamentos, fechamento
- [ ] Sync — aguardar job ou forçar; logs sem erro de agente (401/timeout)
- [ ] Produção — produtividade / etapas (se usado)
- [ ] WhatsApp recibo — **somente** se vars Meta OK e rede Meta acessível do Render

### Logs Render

- [ ] Migrations: `✅ N migration(s) executada(s)` ou `Nenhuma migration pendente`
- [ ] Sem `Configuração ausente: WHATSAPP_*` se feature desligada (`WHATSAPP_ENABLED=false`)
- [ ] Sem crash loop no startup

---

## 4. Segurança (npm audit)

| Pacote | Status | Ação |
|--------|--------|------|
| Backend | **0 vulnerabilidades** | `fast-uri` corrigido via `npm audit fix` |
| Frontend | **0 vulnerabilidades** | `@hono/node-server` forçado via `overrides` (CLI/MCP dev) |

---

## 5. Rollback

1. Render → **Deploys** → redeploy da revisão anterior estável  
2. Ou revert do commit no Git + push `master`  
3. Migrations já aplicadas **não** revertem automaticamente — avaliar `migration:revert` só se migration foi o problema

---

## 6. Registro de deploy (preencher)

| Campo | Valor |
|-------|--------|
| Data | |
| Commit / tag | |
| Node no Render | |
| Build local OK | ☐ |
| Smoke produção OK | ☐ |
| Observações | |

---

## Referências

- `render.yaml`
- `backend/.env.example`
- `docs/GUIA_DESENVOLVIMENTO.md` (versão / anti-cache)
- `docs/anotacoes.md` (Node filiais vs dev)
