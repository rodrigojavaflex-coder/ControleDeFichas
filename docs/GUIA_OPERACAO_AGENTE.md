# Guia de Operacao do Agente (1 pagina)

## Quick Start (uso diario)
- Informe contexto, objetivo e resultado esperado.
- Delimite escopo (arquivos/modulos que podem ser alterados).
- Diga o que esta fora de escopo.
- Liste 2-4 criterios de aceite verificaveis.
- Informe validacao esperada (lint/build/teste manual).
- Para UI: exigir tema claro/escuro e estados (hover/focus/disabled).
- Para negocio: citar RN-* do `docs/regras-negocio.md`.
- Para API/DB: indicar contrato esperado e se precisa migration.
- Se for tarefa grande, pedir plano curto antes de implementar.

## Objetivo
Padronizar como abrir tarefas para o agente, reduzindo retrabalho e aumentando previsibilidade de entrega.

## Regra de ouro
Sempre informar:
- contexto do problema;
- resultado esperado (criterio de pronto);
- escopo (arquivos/modulos impactados);
- restricoes (nao mexer em X, manter comportamento Y).

---

## Template rapido (universal)
Use este bloco para qualquer tipo de tarefa:

```md
Contexto:
<o que esta acontecendo hoje e por que precisa mudar>

Objetivo:
<resultado final esperado>

Escopo:
<arquivos, pastas ou modulos que podem ser alterados>

Fora de escopo:
<o que nao deve ser alterado>

Criterios de aceite:
1) <criterio verificavel 1>
2) <criterio verificavel 2>
3) <criterio verificavel 3>

Validacao esperada:
<lint, build, teste manual, cenarios>
```

---

## Modelo de prompt - UI (visual/tema)

```md
Tarefa UI:
Preciso ajustar a interface em <tela/componente> (ex.: vendas-list, clientes-list, baixas-list, configuracao).

Problema atual:
<descreva o problema visual/ux>

Objetivo:
<resultado visual esperado>

Escopo permitido:
- frontend/src/app/components/<feature>/ (html, css)
- frontend/src/styles/ (tokens/temas, se necessario)
- <arquivo ts do componente, se necessario para estado>

Regras obrigatorias:
- manter compatibilidade com tema claro e escuro;
- evitar cor hardcoded (usar tokens/variaveis);
- preservar padrao visual existente.

Criterios de aceite:
1) componente funcional em tema claro e escuro;
2) estados hover/focus/disabled consistentes;
3) sem regressao visual no fluxo relacionado.
```

---

## Modelo de prompt - Negocio (fluxo/regra funcional)

```md
Tarefa de negocio:
Preciso alterar a regra <RN-XXX>.

Contexto:
<regra atual e dor>

Nova regra:
<descricao funcional objetiva>

Escopo permitido:
- backend/src/modules/<dominio> (controller/service) ou frontend (component/service)
- <dto/model relacionado>

Regras:
- seguir docs/regras-negocio.md;
- manter auditoria/historico quando aplicavel;
- nao quebrar fluxo atual fora do escopo.

Criterios de aceite:
1) <cenario principal>;
2) <cenario de erro>;
3) <mensagem funcional esperada>.
```

---

## Modelo de prompt - API/DB (contrato/dados)

```md
Tarefa API/DB:
Preciso ajustar endpoint/contrato em <modulo> (ex.: vendas, ficha-tecnica, migracao, auth).

Problema atual:
<o que falta ou esta inconsistente>

Objetivo:
<resposta/contrato esperado>

Escopo permitido:
- backend/src/modules/<modulo> (ex.: vendas, clientes, baixas, sincronizacao, certificado, prescritores)
- backend/src/main.ts ou backend/src/app.module.ts (bootstrap global, se necessario)
- agent/src (app Nest de sincronizacao/Firebird), quando o contrato ou sync for impactado
- backend/src/migrations (se necessario)
- frontend/src/app/services e frontend/src/app/models impactados

Regras obrigatorias:
- DTO com class-validator;
- manter Swagger coerente;
- se houver mudanca estrutural, criar migration up/down;
- atualizar consumidores do contrato no frontend (services/models) e revisar `agent/` quando compartilharem o mesmo contrato.

Criterios de aceite:
1) endpoint retorna contrato esperado;
2) validacoes 4xx corretas;
3) migration reversivel (quando aplicavel);
4) consumidores atualizados sem quebra.
```

---

## Segredos e variaveis de ambiente

- **Nao** pedir ao agente para ler `backend/.env`, `frontend/.env` ou `agent/.env`.
- Referencia de **nomes** das variaveis: `backend/.env.example` e `agent/env.example`.
- Regra permanente do projeto: `.cursor/rules/regras-segredos.mdc`.
- Arquivos `.env` estao em `.cursorignore` (agente nao deve indexar/abrir).
- Ao testar integracoes (WhatsApp, Meta, DB): informe *"variaveis ja configuradas no .env local"* em vez de colar tokens ou senhas no chat.
- Fora de escopo do agente: commitar, copiar ou expor valores reais de secrets.

---

## Checklist antes de enviar tarefa ao agente
- O objetivo esta claro e testavel?
- O escopo esta delimitado?
- Existe algum risco de quebrar contrato/API?
- Precisa migration?
- Precisa validar tema claro/escuro?
- Existe regra RN-* que deve ser citada?
- Tarefa envolve credenciais? Usar `.env.example` + confirmacao, sem colar secrets.
- **Novo menu ou tela** que deve aparecer nos **atalhos da home**? Ver secao abaixo.

---

## Checklist — novo menu / atalho na tela inicial

Ao criar ou expor uma **nova rota no menu lateral** que o usuario possa fixar como atalho na home, atualizar **todos** estes pontos (mesmo `id` em frontend e backend):

| # | Arquivo | O que fazer |
|---|---------|-------------|
| 1 | `frontend/src/app/app.routes.ts` | Rota lazy/standalone |
| 2 | `frontend/src/app/components/navigation/navigation.ts` | Item no menu + permissões |
| 3 | `frontend/src/app/config/home-shortcuts.registry.ts` | Entrada em `HOME_SHORTCUTS_CATALOG` |
| 4 | `backend/src/common/constants/home-shortcut-ids.ts` | Mesmo `id` em `HOME_SHORTCUT_IDS` |

**Importante:** se faltar o passo **4**, o usuario seleciona o atalho na home, salva, e o backend **remove silenciosamente** o ID na sanitizacao de `PATCH /users/:id/atalhos-home`. O atalho nao persiste apos recarregar.

Opcional: citar RN-* de atalhos em `docs/regras-negocio.md` (secao atalhos da home).

---

## Exemplo curto (pronto para copiar)

```md
Preciso ajustar o componente/lista em <nome>.
Objetivo: <comportamento esperado>.
Escopo: <arquivos relacionados>.
Fora de escopo: <explicito>.
Criterios: (1) ..., (2) ..., (3) ...
Validacao: lint e teste manual do fluxo.
```

---

## Documentacao de referencia

| Documento | Uso |
|-----------|-----|
| `docs/regras-negocio.md` | RN-* oficiais |
| `docs/ENCODING_SISTEMAS_LEGADOS.md` | Encoding Firebird/agente/backend; checklist para novos campos de texto no agente |
| `docs/WHATSAPP_RECIBO_FOLHA.md` | Envio de recibo de folha por WhatsApp (especificacao + checklist pre-dev) |
| `docs/WHATSAPP_WEBHOOK.md` | Webhook, inbox, chat e **passo a passo painel Meta** |
| `docs/PROMPT_MODULO_FOLHA.md` | Contexto do modulo folha |
| `backend/.env.example` | Nomes das variaveis de ambiente (sem valores secretos) |
| `.cursor/rules/regras-segredos.mdc` | Regra: agente nao le `.env` |

---

## Boas praticas de colaboracao
- Prefira tarefas pequenas e incrementais.
- Quando a tarefa for grande, peça primeiro um plano em bullets.
- Se houver ambiguidade de regra funcional, peça para o agente listar opcoes e impacto antes de implementar.
