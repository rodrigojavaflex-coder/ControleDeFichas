# Agente local (API REST para consultas do banco InterBase/Firebird)

Este agente roda na rede local junto ao `banco.ib` e expõe APIs restritas para a aplicação no Render.

## Endpoints iniciais
- `POST /api/v1/vendas/total-dia` — body `{ "date": "YYYY-MM-DD", "unit": number }`. Retorna totais por forma de pagamento.
- `GET /api/health` — health-check simples.

Headers de autenticação: `Authorization: Bearer <AUTH_TOKEN>` ou `x-api-key: <AUTH_TOKEN>`.

## Configuração
1. Copie o exemplo: `cp .env.example .env` e preencha:
   - `PORT` ou `AGENT_PORT`: porta interna do agente (de preferência bindada à VPN/túnel).
   - `AUTH_TOKEN`: token forte para as chamadas.
   - `DB_*`: host/porta/caminho/credenciais do banco.
2. Instale dependências: `npm install` (dentro de `agent/`).
3. Rodar em dev: `npm run start:dev`.
4. Build e produção local: `npm run build` e depois `npm start`.

## Notas técnicas
- Segurança: guard global exige `AUTH_TOKEN` em todas as rotas.
- Validação: `class-validator` com `ValidationPipe` global e payload compacto (`whitelist`).
- Banco: `DatabaseService` usa `node-firebird` com SQL parametrizado para o `total-dia`.
- Organização: módulos separados (`vendas`, `database`, `health`).

## Próximos passos
- Parametrizar o bind para ouvir apenas na interface da VPN/túnel.
- Adicionar rate limiting e logs estruturados.
- Criar unit file/systemd para subir como serviço na máquina local.

## Passo a passo de teste com detalhes (PowerShell/Windows) usando banco real
1. Verifique se a porta 3333 está livre (ou decida outra porta, ex.: 4000).
   - `netstat -ano | findstr :3333`
   - Se estiver ocupada, ou mate o processo (`taskkill /PID <pid> /F`) ou mude a porta no `.env` (`PORT=4000`).
2. Configure `.env`:
   - `cp .env.example .env`
   - Edite e defina `AUTH_TOKEN=sua-chave-forte`; opcionalmente `PORT=4000` se trocou a porta.
   - Preencha `DB_PATH` com o caminho completo do seu `banco.ib`/`banco.fdb` e credenciais (`DB_USER`, `DB_PASSWORD`).
3. Instale e suba em dev:
   - `npm install`
   - `npm run start:dev` (ou `npm run start` após `npm run build`).
   - Verifique o log: deve mostrar `Agente iniciado em http://localhost:<porta>`.
4. Teste health-check:
   - `curl -H "Authorization: Bearer sua-chave-forte" http://localhost:<porta>/api/health`
   - Esperado: `{"status":"ok","timestamp":"..."}`.
5. Teste endpoint de vendas (consultando o banco real):
   - `curl -X POST http://localhost:<porta>/api/v1/vendas/total-dia -H "Authorization: Bearer sua-chave-forte" -H "Content-Type: application/json" -d "{\"date\":\"2025-11-18\",\"unit\":2}"`
   - Esperado: lista com `unidade` (cdfil), `data`, `forma_pagamento`, `total_pago`, `qtde_linhas`.
6. Erros comuns:
   - 401: token ausente ou diferente do configurado em `AUTH_TOKEN`.
   - 400: data fora de `YYYY-MM-DD` ou `unit` não é inteiro.
   - EADDRINUSE: porta em uso; escolha outra no `.env` ou finalize o processo que ocupa a porta.
