# Template de prompt — feature (fluxo dev local + loop agêntico)

Modelo para desenvolvimento **local**, **sem commit automático** pelo Agent. Hooks Git e CI **não** fazem parte deste fluxo por ora.

**Ordem de precedência:** instruções na conversa → `.cursorrules` → `.cursor/rules/*.mdc` → este documento.

---

## Template (~copiar e preencher)

```text
Contexto: [descreva a feature em 2–3 frases]. RN-* aplicáveis: [RN-001, RN-010 ou “nenhuma nova”].
Fase: [1/N — ex.: backend + migration / tela / importação / relatório / painel].

Refs: @docs/regras-negocio.md @docs/GUIA_DESENVOLVIMENTO.md @.cursor/rules/regras-ui.mdc @[pasta do módulo ou tela similar].

Processo: modo Agent; NÃO executar git commit/push salvo se eu pedir explicitamente.

Implementar o escopo desta fase. Depois, em loop até encerrar o Portão A:
(1) npm run validate na raiz do monorepo até exit code 0;
(2) checklist RN-* (Portão A — negócio): cada RN com trecho de código e mensagens ao usuário conforme docs/regras-negocio.md;
(3) checklist UI (Portão A — UI): GUIA_DESENVOLVIMENTO + regras-ui (rota, guards, menu, tema claro/escuro, padrão vendas-page se listagem).

Se (2) ou (3) falhar, corrigir e repetir (1) se necessário. Opcional: ng serve + verificar rota [path] no browser.

Ao encerrar, entregar: arquivos alterados; tabela RN → arquivo; checklist UI; bloco “Portão B” preenchido; pendências.
```

---

## Portão A — fim do loop agêntico (técnico + RN + UI)

Encerrar o Agent nesta fase **somente** quando **todos** os blocos abaixo estiverem OK.

### A — Técnico

| # | Critério |
|---|----------|
| A1 | `npm run validate` na **raiz** terminou com **código 0** (`validate:backend` = lint + test + **`nest build`**; `validate:frontend` = build Angular; **`validate:audit`** = `npm audit` em backend, frontend e agent). O build Nest ajuda a pegar erros de compilação/DI de módulo que o lint não vê; **não** substitui `start:dev` com banco/API. |
| A2 | Nenhuma migration altera `perfil.permissoes` nem concede permissão automaticamente. |
| A3 | Endpoints novos/alterados: DTOs + `class-validator` + Swagger; GET sensível com `@Permissions` quando aplicável. |
| A4 | Agent **não** executou `git commit` / `git push` (salvo pedido explícito). |

### B — Regra de negócio (no loop Agent)

| # | Critério |
|---|----------|
| B1 | Cada **RN-* do escopo** implementada; mensagens de erro/sucesso alinhadas a `docs/regras-negocio.md`. |
| B2 | Agent documenta **RN → arquivo/trecho** (ou justifica N/A). |
| B3 | RN nova ou alterada → `docs/regras-negocio.md` atualizado na mesma entrega. |
| B4 | Casos de borda acordados no prompt (duplicidade, unidade, datas, etc.) cobertos em código ou listados como pendência com motivo. |

### C — UI (no loop Agent)

| # | Critério |
|---|----------|
| C1 | `docs/GUIA_DESENVOLVIMENTO.md`: rota com `authGuard` + `permissionGuard` + `data.permissions`; menu alinhado; atalho home se aplicável. |
| C2 | `.cursor/rules/regras-ui.mdc`: tema claro e escuro; tokens de tema (evitar cores fixas novas sem necessidade); hover/focus/disabled quando houver interação. |
| C3 | Listagem principal: padrão `vendas-page` (filtros, tabela, estados vazio/loading/erro conforme a tela). **Formatação:** tokens globais (`--cor-primaria`, `--cor-superficie`, `--border-color`, `--text-primary`) + referência **`producao-produtividade-page`** (filtros/unidades/modal) para telas **Produção**; ver `docs/GUIA_DESENVOLVIMENTO.md` e `.cursorrules` (vendas-page). |
| C4 | Agent marca checklist C **OK / corrigido nesta rodada** item a item. |

**Nota:** RN/UI no Portão A são **revisão e implementação pelo Agent** com base nos docs; o que já estiver coberto por **Jest** entra também via `validate`.

---

## Portão B — validação final (humana) antes de commit / produção

Portão A **não** substitui aceite funcional. Antes de **commit → push → produção**:

| # | Critério |
|---|----------|
| D1 | Smoke manual dos cenários abaixo (dados reais ou homolog). |
| D2 | Mensagens e fluxos batem com a expectativa de negócio (RN-*). |
| D3 | Permissões no **enum** e **atribuição manual** na tela de Perfis (nunca via migration). |
| D4 | Menu, URL e API testados (sem 403 indevido nem menu liberando quem não deveria). |
| D5 | UI revisada em **tema claro e escuro** se a tela for nova ou alterada. |
| D6 | Importação/sync (se houver): encoding, unidade, datas, sucesso e arquivo inválido. |
| D7 | Aceite explícito para produção (solo ou equipe). |

---

## Bloco de entrega (colar no fim do chat do Agent)

```text
=== PORTÃO A — TÉCNICO ===
[ ] npm run validate OK (data/hora: ___)
Arquivos impactados: ___

=== PORTÃO A — RN-* ===
| RN | Onde no código | Mensagem/validação | Status |
|----|----------------|--------------------|--------|
|    |                |                    | OK     |

=== PORTÃO A — UI ===
[ ] GUIA (rota, guards, menu, atalho)
[ ] regras-ui (claro/escuro, tokens, estados)
[ ] Padrão listagem (se aplicável)

=== PORTÃO B — SMOKE FINAL (para o desenvolvedor) ===
1. ___ (entrada: ___ | esperado: ___)
2. ___
Perfis: permissão(ões) ___ → configurar em Perfis antes de usuário final.
Pendências / fora do escopo: ___

NÃO commitar até Portão B assinado pelo desenvolvedor.
```

---

## Comandos de validação (raiz do monorepo)

```bash
npm run validate:backend   # lint + test + nest build (backend/, sem rebuild do frontend)
npm run validate:frontend  # build (frontend/)
npm run validate:audit     # npm audit (backend/, frontend/, agent/)
npm run validate             # backend + frontend + audit
npm run audit                # alias de validate:audit
```

`lint:strict` no backend exige **zero warnings** (lint padrão). Dívida `no-unsafe-*`: `npm run lint:type-debt` no `backend/`.

**Portão B (humano):** após validate verde, subir `npm run start:dev` (backend) + smoke da rota/tela; opcional `GET /api/health` ou login se existir health check.

Pré-requisito: dependências instaladas (`npm run install-all` na raiz).

---

## Referências

- Permissões e telas: `docs/GUIA_DESENVOLVIMENTO.md`
- Regras funcionais: `docs/regras-negocio.md`
- UI/tema: `.cursor/rules/regras-ui.mdc`
- Deploy: `docs/CHECKLIST_DEPLOY_RENDER.md`
