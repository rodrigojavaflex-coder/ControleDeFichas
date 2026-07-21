# Webhook WhatsApp — recebimento de mensagens e status (folha)

Documento de especificação para implementação **futura** (M5). Use como **fonte única** ao desenvolver o webhook no backend Nest.

**Status:** **implementado** (webhook, inbox, reply 24h).

**Relacionado:**

- `docs/WHATSAPP_RECIBO_FOLHA.md` — envio de recibo (RN-015, **implementado**)
- `docs/regras-negocio.md` — registrar **RN-016** ao implementar
- Módulo: `backend/src/modules/whatsapp/`

---

## 1. Contexto e motivação

O número de envio de recibos está registrado **somente na Cloud API** (`is_on_biz_app: false`, `platform_type: CLOUD_API`). **Coexistência** (app WhatsApp Business + API no mesmo número) **não está disponível** nesse cenário sem re-onboarding arriscado.

Portanto, para **receber respostas** dos funcionários que respondem ao número que enviou o recibo, o caminho oficial é o **webhook** da Meta.

| Canal | O que cobre |
|-------|-------------|
| **Webhook** (este doc) | Mensagens **entrantes** e **status** (entregue/lido/falha) no número da API |
| **Contato de dúvidas** (`WHATSAPP_CONTATO_DUVIDAS_*`) | Mensagens para **outro** número (celular do RH); **fora** do webhook |
| **App no celular do número API** | **Não aplicável** (sem coexistência) |

**Volume estimado:** baixo (~50 envios/mês; respostas ainda menores).

---

## 1.1 Decisões de produto (fechadas)

| Tópico | Decisão |
|--------|---------|
| **Canal de atendimento** | Chat manual no sistema via **webhook** (número da API). Foco em quem **responde ao recibo** neste número. |
| **Template Meta (fase atual)** | Manter variáveis `WHATSAPP_CONTATO_DUVIDAS_*` no corpo. Quando chat estiver estável, revisar copy na Meta (ex.: “responda esta mensagem”). |
| **Permissões** | `folha-whatsapp:read` (ver inbox) + `folha-whatsapp:reply` (enviar texto). **Separadas** de enviar recibo. |
| **Escopo por unidade (RN-007)** | Usuário **com** `usuario.unidade` (ou `vendedor.unidade`): vê conversas **identificadas** da **mesma unidade**. Usuário **sem** vínculo de unidade: vê **todas** as identificadas. |
| **Não identificados** | Telefone sem match em `funcionario` → **fila global**: **todos** com `folha-whatsapp:read` veem, **independente** da unidade do usuário. |
| **Janela 24h** | Fora da janela: **só bloquear** envio (UI + backend). Sem template lembrete na fase 1. |
| **IA / auto-resposta** | Fora do MVP. |

---

## 2. Objetivo

1. **Receber** mensagens de texto enviadas **para** o número da API (webhook).
2. **Receber** status das mensagens **enviadas** (entregue, lido, falha).
3. **Persistir** conversas e mensagens para o RH.
4. **UI inbox + chat:** listar conversas, thread, responder manualmente na janela 24h.

**Fora de escopo inicial (M5-v1):**

- Chatbot / respostas automáticas / agente IA
- Template lembrete fora da janela 24h
- Coexistência / `smb_message_echoes`
- Alteração do template Meta (aguardar chat estável)

---

## 3. Estado atual no código

| Item | Situação |
|------|----------|
| Envio template + imagem recibo | **Implementado** — `WhatsappService`, `FolhaReciboWhatsappService` |
| Webhook GET/POST | **Implementado** — `WhatsappWebhookController` |
| Inbox + reply API/UI | **Implementado** — `FolhaWhatsappController`, tela Atendimento WhatsApp |
| `WHATSAPP_APP_SECRET` | Configurar no ambiente (HMAC POST) |
| Tabelas `whatsapp_conversa` / `whatsapp_mensagem` | **Implementado** (migration) |
| wamid no envio recibo | **Implementado** (auditoria + mensagem outbound) |

---

## 4. Regras de negócio propostas (RN-016)

Registrar em `docs/regras-negocio.md` ao implementar:

| ID | Regra |
|----|--------|
| RN-016.1 | Webhook é **endpoint público** (sem JWT); autenticação via **verify token** (GET) e **assinatura HMAC** (POST). |
| RN-016.2 | Mensagens recebidas devem ser **persistidas** com telefone mascarado nos logs expostos à UI. |
| RN-016.3 | Tentativa de **vincular** remetente a `funcionario.telefone` quando possível (match E.164); se não houver match, registrar como “não identificado”. |
| RN-016.4 | **Não** responder automaticamente no MVP; atendimento manual ou fase posterior. |
| RN-016.5 | Status de entrega/lido atualiza registro do envio quando `message_id` (wamid) for correlacionável. |
| RN-016.6 | Webhook deve responder **HTTP 200** em até poucos segundos; processamento pesado **assíncrono** (fila ou fire-and-forget com try/catch). |
| RN-016.7 | Permissões: `folha-whatsapp:read` (inbox) e `folha-whatsapp:reply` (enviar); `reply` exige `read`. |
| RN-016.8 | Escopo lista (identificadas): **RN-007** — unidade via `funcionario.unidade`. |
| RN-016.9 | **Não identificadas:** visíveis para **todos** com `folha-whatsapp:read` (fila global). |
| RN-016.10 | Resposta manual só com `folha-whatsapp:reply` **e** janela 24h aberta; backend valida. |
| RN-016.11 | Fora da janela 24h: bloquear envio; sem template lembrete na fase 1. |

---

## 5. Configuração Meta — passo a passo (painel)

> **Pré-requisito de código:** o backend precisa expor `GET` e `POST` em `/api/whatsapp/webhook` **antes** de clicar “Verificar e salvar” no painel. Sem isso, a Meta falha na verificação.

### 5.0 Visão geral

```
Você (Meta Business / developers.facebook.com)
    → App WhatsApp
    → Webhook URL + Verify Token + campo "messages"
    → WABA inscrita no app
Backend (Render ou túnel ngrok)
    → GET  /api/whatsapp/webhook  (devolve hub.challenge)
    → POST /api/whatsapp/webhook  (eventos + assinatura HMAC)
.env / Render
    → WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET, etc.
```

**URL de callback (Nest usa prefixo `api`):**

```
https://SEU-DOMINIO/api/whatsapp/webhook
```

Exemplo Render: `https://controledefichas.onrender.com/api/whatsapp/webhook`

**Dev local:** túnel HTTPS (ngrok, Cloudflare Tunnel). Meta **não** aceita `http://localhost`.

---

### Passo 1 — Variáveis no backend (antes do painel)

Edite `backend/.env` (local) ou variáveis no **Render** (produção). Referência de nomes: `backend/.env.example`.

| Variável | O que fazer |
|----------|-------------|
| `WHATSAPP_ENABLED` | `true` |
| `WHATSAPP_WEBHOOK_ENABLED` | `true` quando webhook ativo |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Invente uma string longa e aleatória (ex.: 32+ caracteres). **Anote** — usará no painel Meta. |
| `WHATSAPP_APP_SECRET` | Copiar do app Meta (Passo 2). |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente (já usado no envio de recibo). |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número na API (já configurado). |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da WABA (já configurado). |

Reinicie o backend após alterar.

---

### Passo 2 — App Secret (developers.facebook.com)

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus apps** → app do WhatsApp.
2. Menu lateral: **Configurações do app** → **Básico**.
3. Campo **Chave secreta do app** → **Mostrar** → copie.
4. Cole em `WHATSAPP_APP_SECRET` no `.env` / Render.
5. **Nunca** commite esse valor no Git.

---

### Passo 3 — Deploy ou túnel com endpoint ativo

**Produção (Render):**

1. Deploy do backend com código do webhook (quando implementado).
2. Confirme no navegador ou curl que a URL responde (GET ainda pode falhar sem params Meta — normal).

**Desenvolvimento local:**

1. Instale ngrok ou Cloudflare Tunnel.
2. Exemplo ngrok: `ngrok http 3000`
3. Use a URL HTTPS gerada: `https://xxxx.ngrok-free.app/api/whatsapp/webhook`
4. Mantenha ngrok + `npm run start:dev` rodando durante a verificação.

---

### Passo 4 — Configurar webhook no app (WhatsApp → Configuration)

1. No app Meta: **WhatsApp** → **Configuração** (ou **Configuration**).
2. Seção **Webhook** → botão **Editar** (Edit).
3. Preencha:
   - **URL de retorno de chamada (Callback URL):**  
     `https://SEU-DOMINIO/api/whatsapp/webhook`
   - **Verificar token (Verify token):**  
     **exatamente** o mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Clique **Verificar e salvar** (Verify and save).

**O que a Meta faz:** envia `GET` com `hub.mode=subscribe`, `hub.verify_token=...`, `hub.challenge=...`.  
**O backend deve:** comparar token e responder **só** o texto de `hub.challenge` com HTTP 200.

| Resultado | Ação |
|-----------|------|
| **Verified** / verificado | Siga para Passo 5 |
| Falha | Confira URL, SSL, token idêntico, backend no ar, rota `/api/` correta |

---

### Passo 5 — Assinar o campo `messages`

Na mesma tela **Webhook** → **Campos do webhook** (Webhook fields):

1. Localize **`messages`**.
2. Clique **Assinar** (Subscribe) / toggle **On**.
3. (Opcional depois) `message_template_status_update` — status de templates.

**Obrigatório para MVP:** apenas **`messages`** (entrada + status de envio).

---

### Passo 6 — WABA inscrita no app

1. Ainda em **WhatsApp** → **Configuração**.
2. Confirme que a **conta WhatsApp Business (WABA)** correta está **inscrita** no app.
3. Se não houver inscrição: use **WhatsApp Manager** → conta → vincular ao app, ou API `POST /{WABA_ID}/subscribed_apps`.

Sem WABA inscrita: verify passa, mas **nenhum POST** de mensagem chega.

---

### Passo 7 — Modo do app (Development vs Live)

| Modo | Uso |
|------|-----|
| **Development** | Testes; recebimento limitado a **números de teste** cadastrados no app |
| **Live** | Produção; qualquer funcionário pode responder |

Para teste real com celulares de funcionários: app em **Live** + token permanente válido.

Caminho: **Configurações do app** → **Modo do app** → alternar para **Live** (exige revisão Meta se ainda não publicado).

---

### Passo 8 — Token e permissões (recapitular)

1. [business.facebook.com](https://business.facebook.com) → **Configurações do negócio**.
2. **Usuários do sistema** → token com app + WABA.
3. Permissões: `whatsapp_business_messaging`, `whatsapp_business_management`.
4. Token em `WHATSAPP_ACCESS_TOKEN`.

(Já feito para envio de recibo — só validar se não expirou.)

---

### Passo 9 — Teste end-to-end

1. Backend no ar + webhook Verified + campo `messages` assinado.
2. Envie **recibo de teste** pelo sistema para **seu celular**.
3. No WhatsApp, abra a conversa do **número emissor do recibo** (número da API).
4. Toque **Responder** e envie: `Teste webhook`.
5. Confira logs do backend / tabela de mensagens (após implementação W2).

**Importante:** resposta deve ser **nesta conversa** (número da API). Mensagem para o telefone de `WHATSAPP_CONTATO_DUVIDAS_*` **não** passa pelo webhook.

---

### Passo 10 — Checklist Meta (copiar)

```
[ ] WHATSAPP_WEBHOOK_VERIFY_TOKEN definido (.env / Render)
[ ] WHATSAPP_APP_SECRET definido
[ ] WHATSAPP_WEBHOOK_ENABLED=true
[ ] Backend deployado com GET/POST /api/whatsapp/webhook
[ ] Callback URL HTTPS configurada
[ ] Verificar e salvar = Verified
[ ] Campo "messages" assinado
[ ] WABA inscrita no app
[ ] App Live (se teste com números reais)
[ ] Teste: responder ao recibo → evento recebido
```

---

### 5.1 Referências Meta

- [Set up webhooks — Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)
- [messages webhook reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/reference/messages)
- [WhatsApp Manager](https://business.facebook.com/wa/manage/home)

---

## 6. Arquitetura sugerida

```
Meta Cloud API
      │  GET  (verificação)
      │  POST (eventos)
      ▼
WhatsappWebhookController     ← sem AuthGuard JWT
      │
      ├── GET  /api/whatsapp/webhook   → hub.challenge
      └── POST /api/whatsapp/webhook   → 200 imediato
              │
              ▼
      WhatsappWebhookService
              ├── validar assinatura (App Secret)
              ├── parse payload (messages | statuses)
              ├── deduplicar por message_id / wamid
              └── persistir + (opcional) notificar
                      │
                      ▼
              whatsapp_mensagem_entrada
              whatsapp_mensagem_status  (ou colunas na tabela de envio)
```

### 6.1 Estrutura de arquivos sugerida

```
backend/src/modules/whatsapp/
  whatsapp.module.ts
  whatsapp.service.ts                    # envio (existente)
  folha-recibo-whatsapp.service.ts       # envio folha (existente)
  whatsapp-webhook.controller.ts         # novo — público
  whatsapp-webhook.service.ts            # novo — parse + persistência
  whatsapp-webhook-signature.util.ts     # novo — HMAC SHA256
  entities/
    whatsapp-mensagem-entrada.entity.ts
    whatsapp-mensagem-status.entity.ts   # ou extensão da entidade de envio
  dto/
    (opcional — payloads internos tipados)
```

### 6.2 Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/api/whatsapp/webhook` | Verify token | Handshake Meta |
| `POST` | `/api/whatsapp/webhook` | Assinatura HMAC | Eventos |
| `GET` | `/api/folha/whatsapp/conversas` | JWT + `folha-whatsapp:read` | Inbox (escopo RN-007) |
| `GET` | `/api/folha/whatsapp/conversas/:id` | JWT + `read` | Thread |
| `POST` | `/api/folha/whatsapp/conversas/:id/responder` | JWT + `reply` | Texto livre (24h) |
| `PATCH` | `/api/folha/whatsapp/conversas/:id/lida` | JWT + `read` | Marcar lida |

**Importante:** controller webhook **sem** `@UseGuards(AuthGuard('jwt'))`.

---

## 7. Handshake GET (verificação)

Query params da Meta:

| Param | Descrição |
|-------|-----------|
| `hub.mode` | Deve ser `subscribe` |
| `hub.verify_token` | Deve igualar `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| `hub.challenge` | Retornar como **texto plano** com status 200 |

Pseudo-código:

```typescript
if (mode === 'subscribe' && token === verifyToken) {
  return challenge; // string, não JSON
}
throw new ForbiddenException();
```

---

## 8. POST — tipos de payload

### 8.1 Mensagem recebida (funcionário responde)

Campo `entry[].changes[].value.messages[]`:

```json
{
  "from": "5562985879158",
  "id": "wamid.xxx",
  "timestamp": "1716654321",
  "type": "text",
  "text": { "body": "Recebi o recibo, obrigado" }
}
```

**Ações:**

1. Normalizar `from` para E.164 (somente dígitos).
2. Buscar `funcionario` com `telefone` compatível (mesma lógica de normalização do envio).
3. Inserir em `whatsapp_mensagem_entrada`.
4. (Opcional) Criar log em `auditoria` com ação dedicada.

**Tipos MVP:** `text`. **Implementado (RN-016):** `image`, `audio`, `document` (envio na janela 24h + recebimento via webhook; binário em `whatsapp_mensagem.arquivoConteudo` com retenção `WHATSAPP_MEDIA_RETENCAO_DIAS`).

### 8.2 Status de mensagem enviada (recibo)

Campo `entry[].changes[].value.statuses[]`:

```json
{
  "id": "wamid.xxx",
  "status": "delivered",
  "timestamp": "1716654400",
  "recipient_id": "5562985879158"
}
```

Valores comuns: `sent`, `delivered`, `read`, `failed`.

**Ações:**

1. Correlacionar `id` (wamid) com envio registrado na auditoria ou tabela dedicada.
2. Atualizar status; se `failed`, persistir `errors[]` do payload.

**Gap atual:** envio grava `messageId` na auditoria (`folha_recibo_whatsapp_envio`)? Verificar e, se não, passar a gravar `wamid` no `registrarAuditoriaTentativa` ou em tabela `folha_recibo_whatsapp_envio`.

### 8.3 Payload ignorado no MVP

- `message_echoes` — mensagens enviadas pela API (redundante se já auditamos envio)
- `errors` no root — logar apenas
- Contatos `contacts[]` — usar `profile.name` se disponível

---

## 9. Segurança

### 9.1 Assinatura `X-Hub-Signature-256`

Header: `sha256=<hex>`

```typescript
const expected = crypto
  .createHmac('sha256', appSecret)
  .update(rawBody) // corpo bruto do request
  .digest('hex');
// comparar timing-safe com header sha256=...
```

**NestJS:** habilitar `rawBody: true` no bootstrap **ou** middleware que preserve buffer antes do JSON parser — necessário para HMAC válido.

### 9.2 Boas práticas

- Rejeitar POST se assinatura inválida (401/403).
- Não logar corpo completo com PII em produção.
- Rate limit no endpoint (opcional; Meta reenvia com backoff).
- Idempotência: índice único em `wamid` / `message_id` externo.

---

## 10. Modelo de dados sugerido

### 10.1 `whatsapp_mensagem_entrada`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `wamid` | varchar unique | ID Meta |
| `telefone_origem` | varchar | E.164 |
| `telefone_mascarado` | varchar | Ex.: `55629****9158` |
| `funcionario_id` | uuid nullable | FK se match |
| `tipo` | varchar | `text`, `image`, … |
| `conteudo_texto` | text nullable | Corpo se text |
| `payload_json` | jsonb nullable | Payload bruto (dev/suporte) |
| `nome_perfil` | varchar nullable | `contacts[0].profile.name` |
| `recebido_em` | timestamptz | Timestamp Meta convertido |
| `created_at` | timestamptz | Inserção local |

### 10.2 `whatsapp_mensagem_status` (ou colunas em tabela de envio)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `wamid` | varchar unique | ID da mensagem enviada |
| `status` | varchar | sent / delivered / read / failed |
| `recipient_id` | varchar | Telefone destino |
| `folha_capa_id` | uuid nullable | Se correlacionado ao envio recibo |
| `erro_codigo` | int nullable | Se failed |
| `erro_mensagem` | text nullable | |
| `atualizado_em` | timestamptz | |

**Migration:** reversível (`up`/`down`), `snake_case`, índices em `wamid`, `telefone_origem`, `funcionario_id`, `recebido_em`.

---

## 11. Correlação envio ↔ resposta

Fluxo desejado para o RH enxergar contexto:

```
Envio recibo (RN-015)
  → wamid gravado (auditoria ou folha_recibo_whatsapp_envio)
  → status webhook: delivered / read
  → resposta funcionário (messages webhook)
  → match telefone + janela temporal (ex.: 7 dias)
```

Melhoria recomendada no envio (antes ou junto com webhook):

- Persistir `message_id` retornado por `WhatsappService.sendTemplateWithHeaderImage` junto com `folha_capa_id` e telefone.

---

## 12. UI — Atendimento WhatsApp (Folha)

### 12.1 Tela — “Atendimento WhatsApp”

Rota sugerida: **Folha → Atendimento WhatsApp**.

| Elemento | Descrição |
|----------|-----------|
| Lista (inbox) | Nome ou “Não identificado”, telefone mascarado, última msg, data, badge não lida |
| Escopo | Identificadas filtradas por RN-007; **não identificadas** sempre na lista para quem tem `read` |
| Detalhe | Thread: recibo enviado (se houver) + mensagens inbound/outbound + status |
| Responder | Campo texto + Enviar; exige `folha-whatsapp:reply` + janela 24h |
| Fora 24h | Campo desabilitado + aviso funcional |
| Marcar lida | Exige `folha-whatsapp:read` |

### 12.2 Permissões na UI

| Ação | Permissão |
|------|-----------|
| Ver menu / inbox | `folha-whatsapp:read` |
| Abrir thread | `read` |
| Enviar mensagem | `reply` (+ janela 24h) |
| Enviar recibo | Permissões RN-015 (separadas) |

---

## 13. Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `WHATSAPP_ENABLED` | Sim | Deve ser `true` para processar eventos |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Sim | Token do handshake GET |
| `WHATSAPP_APP_SECRET` | Sim (prod) | Assinatura POST |
| `WHATSAPP_WEBHOOK_ENABLED` | Recomendado | Liga/desliga processamento |
| `WHATSAPP_PHONE_NUMBER_ID` | Sim | Validar `metadata.phone_number_id` no payload |
| `WHATSAPP_ACCESS_TOKEN` | Sim (fase responder) | Envio de resposta manual |

---

## 14. Fases de implementação

| Fase | Entrega | Prioridade |
|------|---------|------------|
| **W1** | GET verify + POST stub + assinatura + log estruturado | Alta |
| **W2** | Migration + persistência mensagens entrada + status | Alta |
| **W3** | Gravar `wamid` no envio recibo + correlacionar status | Alta |
| **W4** | API JWT listagem mensagens (sem UI) | Média |
| **W5** | UI inbox + thread + marcar lida | Média |
| **W6** | Resposta manual na janela 24h | Média |
| **W7** | Notificação (e-mail / toast admin) | Baixa |

---

## 15. Checklist antes de desenvolver

### 15.1 Infra

- [ ] URL HTTPS pública definida (produção ou túnel dev)
- [ ] Callback configurado no App Meta
- [ ] Campo webhook `messages` assinado
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET` no Render/`.env`
- [ ] Teste GET: Meta aceita callback (“Verified”)

### 15.2 Negócio

- [ ] Perfis com `folha-whatsapp:read` e `folha-whatsapp:reply` definidos
- [ ] Template Meta: manter contato dúvidas por enquanto; revisar depois do chat estável
- [ ] Política de retenção de mensagens (LGPD)
- [ ] Equipe ciente: respostas no **chat do recibo** entram no sistema; outro telefone de dúvidas não

### 15.3 Técnico

- [ ] `rawBody` para HMAC
- [ ] Endpoint sem JWT
- [ ] RN-016 em `regras-negocio.md`
- [ ] Migration tabelas
- [ ] Teste: enviar recibo → responder do celular → evento aparece no banco

---

## 16. Testes manuais

1. **Verificação:** salvar callback no Meta → status “Verified”.
2. **Mensagem entrada:** enviar recibo para seu celular → responder “ok” → conferir registro em `whatsapp_mensagem_entrada`.
3. **Status:** conferir transição `sent` → `delivered` → `read` na tabela de status.
4. **Assinatura:** POST sem header válido → 403.
5. **Idempotência:** Meta reenvia mesmo evento → não duplicar linha (`wamid` unique).
6. **Funcionário:** telefone cadastrado igual ao `from` → `funcionario_id` preenchido.

---

## 17. Riscos e limitações

| Risco | Mitigação |
|-------|-----------|
| Meta reenvia webhook se não receber 200 | Responder 200 antes de I/O pesado |
| HMAC inválido por body parseado | `rawBody` no Nest |
| Respostas vão para número de dúvidas | Ajustar copy do template; webhook não captura |
| Volume baixo — UI pode parecer “vazia” | OK; foco em confiabilidade |
| Token expirado ao responder (W6) | Monitorar erros Meta; alerta ops |

---

## 18. Prompt sugerido para outro chat (Agent)

```
Implementar atendimento WhatsApp conforme docs/WHATSAPP_WEBHOOK.md.

Decisões fechadas: seção 1.1 do doc.
Escopo: W1–W6 (webhook + inbox + reply 24h).
Permissões: folha-whatsapp:read, folha-whatsapp:reply.
Não ler .env; usar backend/.env.example.

Seguir padrões: Controller → Service → Repository, snake_case, migration reversível.
```

---

## 19. Referências

- [Set up webhooks — Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)
- [messages webhook reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/reference/messages)
- [Onboard Business app users (Coexistence)](https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users) — **não aplicável** ao número atual
- Envio recibo: `docs/WHATSAPP_RECIBO_FOLHA.md`
- Código envio: `backend/src/modules/whatsapp/whatsapp.service.ts`, `folha-recibo-whatsapp.service.ts`

---

*Última consolidação: decisões de produto (chat manual, permissões, escopo RN-007, passo a passo Meta).*
