# Envio de recibo de pagamento (folha) por WhatsApp

Documento de especificação consolidado a partir das discussões de produto e arquitetura. Use este arquivo como **fonte única** para implementação em outro chat ou sprint futuro.

**Status:** especificado, **não implementado** (exceto recibo por impressão/PDF no navegador, já existente).

**Relacionado:** `docs/regras-negocio.md` (**RN-015**), módulo folha, `folha-lancamentos-page`, `folha-fechamento-page`.

---

## 1. Objetivo

Permitir que o RH envie o **recibo de pagamento da folha** ao funcionário via **WhatsApp Business Platform (API oficial)**, com:

- Mensagem de texto com saudação + nome do funcionário.
- **Imagem** do recibo (layout igual ao print/recibo atual da tela de lançamentos).
- Envio **individual** na tela de lançamento e **em massa** na tela de controle (por unidade/competência/tipo).
- Envio **somente** com **lote da competência fechado** (RN-006).

**Volume estimado:** ~50 mensagens/mês.

**Restrição de risco:** usar **apenas API oficial** (Cloud API); **não** usar Evolution API, Baileys, Z-API não oficial ou automação em WhatsApp pessoal.

---

## 2. Estado atual no código

| Item | Situação |
|------|----------|
| Recibo visual (receitas, descontos, líquido) | Implementado no **frontend** — `folha-lancamentos-page.ts` (`montarCorpoHtmlReciboPagamento`, `imprimirRelatorioCapaFolha`, `imprimirReciboGeralTodasCapas`) |
| Integração WhatsApp | **Não existe** no repositório |
| Campo `funcionario.telefone` | Existe (opcional, RN-009) |
| Chave Pix tipo TELEFONE | Existe (RN-010); **não** substitui telefone para WhatsApp |
| Opt-in WhatsApp no funcionário | **Não existe** (recomendado criar) |

---

## 3. Decisões fixadas

| Tópico | Decisão |
|--------|---------|
| Formato do anexo | **Imagem** (PNG ou JPEG), **não PDF** |
| Texto da mensagem | `Oi {NOME}, {Saudação}. Segue recibo de pagamento.` |
| Saudação (fuso `America/Sao_Paulo`) | 05:00–11:59 → Bom dia; 12:00–17:59 → Boa tarde; 18:00–04:59 → Boa noite |
| Provedor | Meta **WhatsApp Business Platform** (Cloud API) |
| Categoria do template Meta | **Utilidade** (utility), não marketing |
| Quando enviar | **Somente** com `folha_fechamento.fechado = true` para a quadrupla unidade + ano + mês + tipo |
| Congelar capa | **Não** é pré-requisito; congelar exige lote **aberto** (RN-012) |
| API no browser | **Proibido** expor token; envio só no **backend** (Nest) |
| Custo esperado | Baixo (~50/mês); Meta na faixa de poucos reais; pode haver custo fixo de BSP se usar intermediário |

---

## 4. Regras de negócio (RN-015)

Registrar em `docs/regras-negocio.md` como **RN-015**. Resumo:

| ID | Regra |
|----|--------|
| RN-015.1 | Envio permitido **apenas** com lote **fechado** (RN-006). |
| RN-015.2 | **Individual:** uma `folha_capa` por vez (tela Lançamento). |
| RN-015.3 | **Em massa:** todas as capas da linha em Controle (unidade + ano + mês + tipo de folha), lote **FECHADA**. |
| RN-015.4 | Exige `funcionario.telefone` válido (E.164, ex. `5511999998888`). |
| RN-015.5 | **Lançamento (individual):** `folha-lancamento:enviar-recibo-whatsapp`. **Controle (massa):** `folha-fechamento:enviar-recibos-whatsapp`. |
| RN-015.6 | Apenas API oficial WhatsApp; templates utilitários. |
| RN-015.7 | **Auditoria** de cada tentativa (usuário, capa, competência, sucesso/erro, telefone mascarado). |
| RN-015.8 | Reenvio permitido; opcional aviso se já enviado em data anterior. |
| RN-015.9 | **Recomendado:** campo `aceitaReciboWhatsApp` no funcionário (LGPD); bloquear envio se `false`. |

---

## 5. Interface do usuário

### 5.1 Lançamento de folha (`folha-lancamentos-page`)

**Local:** bloco `folha-lancamentos-itens-congelar-slot` (já contém **Recibo** e **Congelar/Liberar**).

**Ordem dos botões:**

1. Recibo (impressão — mantém comportamento atual)
2. Congelar / Liberar (mantém RN-012)
3. **Enviar recibo** (novo, **abaixo** de Congelar)

**Habilitação (`podeEnviarReciboWhatsApp()`):**

- Permissão `folha-lancamento:enviar-recibo-whatsapp` (envio **individual**)
- `statusLote.fechado === true`
- `detalhe` carregado
- Telefone válido no funcionário da capa
- (Opcional) `aceitaReciboWhatsApp === true`
- Não estar em envio (`enviandoRecibo`)

**Tooltips quando desabilitado:**

- Lote aberto: *Disponível após fechar o lote em Controle das competências.*
- Sem telefone: *Cadastre o telefone do funcionário.*
- Sem permissão: padrão do sistema

**Fluxo:** clique → modal de confirmação (nome, telefone mascarado, competência, líquido) → API → toast sucesso/erro.

**Nota:** com lote fechado, botões Congelar/Liberar não aparecem (RN-012); ficam **Recibo** + **Enviar recibo**.

### 5.2 Controle das competências (`folha-fechamento-page`)

**Local:** coluna **Ações**, linha com `situacao === 'FECHADA'`, junto a **Reabrir**.

**Botão:** `Enviar recibos` (ou `Enviar recibos WhatsApp`).

**Habilitação:**

- `row.situacao === 'FECHADA'`
- Permissão `folha-fechamento:enviar-recibos-whatsapp` (envio **em massa**)
- Não `enviando`

**Fluxo:**

1. Modal de confirmação com unidade, mês/ano, tipo de folha.
2. Chamada API em lote.
3. Modal de resultado: `{ enviados, ignorados, falhas: [{ funcionarioId, nome, motivo }] }`.

**Escopo:** funcionários com capa na **mesma unidade + competência + tipo** da linha da grade — não “todas as unidades do sistema”.

---

## 6. Conteúdo da mensagem e template Meta

### 6.1 Por que existe “template”

Quando o **RH inicia** a conversa (funcionário não falou nas últimas 24h), a Meta **exige** mensagem com **modelo pré-aprovado** (template). Mensagem “livre” + imagem só na janela de 24h após o funcionário escrever — cenário raro para recibo.

### 6.2 Template utilitário sugerido

Cadastrar no **WhatsApp Manager** → **Modelos de mensagem** → **Criar** → categoria **Utilidade**:

| Campo | Valor |
|-------|--------|
| Nome | `recibo_pagamento_folha` (exemplo; só minúsculas, `_`) |
| Idioma | `pt_BR` |
| Corpo | `Oi {{1}}, {{2}}. Segue recibo de pagamento.` |

| Variável | Preenchimento pelo sistema |
|----------|----------------------------|
| `{{1}}` | Nome completo do funcionário |
| `{{2}}` | Bom dia / Boa tarde / Boa noite |

**Exemplo recebido:** `Boa tarde, CLAUDIA APARECIDA DA SILVA. Segue recibo de pagamento.`

O **nome do template** + idioma são usados na API (às vezes chamados de “template name/ID” no código — não é necessariamente UUID).

### 6.3 Imagem do recibo

- A Meta **não entrega** mensagem livre (`type: image`) fora da **janela de 24h**. O recibo vai no **cabeçalho Imagem** do mesmo template utilitário do texto.
- **Um único template** na Meta: cabeçalho Imagem (PNG dinâmico) + corpo com 4 variáveis (`{{1}}` nome, `{{2}}` saudação, `{{3}}` contato, `{{4}}` telefone).
- Imagem gerada no **backend** (SVG → PNG via `@resvg/resvg-js`), mesmo layout do recibo de tela.

**Template na Meta (obrigatório):**

| Campo | Valor |
|-------|--------|
| Nome | ex.: `recibo_pagamento_folha_imagem` (`WHATSAPP_TEMPLATE_RECIBO_NAME`) |
| Categoria | Utilidade |
| Idioma | `pt_BR` |
| Cabeçalho | **Imagem** (amostra na aprovação; API envia PNG do recibo) |
| Corpo | `Olá {{1}}, {{2}}!` … contato `{{3}}` / `{{4}}` … |

**Nome de arquivo sugerido:** `recibo-{slug-nome}-{MM}-{AAAA}.png`

---

## 7. API backend (especificação)

### 7.1 Endpoints propostos

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/folha/capas/:id/enviar-recibo-whatsapp?unidade=` | Envio individual |
| `POST` | `/folha/fechamento/enviar-recibos-whatsapp` | Envio em massa |

**Body massa:**

```json
{
  "unidade": "MATRIZ",
  "ano": 2026,
  "mes": 4,
  "folhaTipoId": "uuid"
}
```

**Resposta massa (exemplo):**

```json
{
  "enviados": 45,
  "ignorados": 3,
  "falhas": [
    { "funcionarioId": "uuid", "nome": "...", "motivo": "Telefone não cadastrado" }
  ]
}
```

### 7.2 Validações no service

1. Lote fechado (`folha_fechamento.fechado`) para a quadrupla da capa.
2. Permissão + unidade do usuário (RN-007).
3. Telefone normalizado (somente dígitos; prefixo `55` se 10–11 dígitos BR).
4. Montar imagem do recibo a partir de `FolhaCapaDetalheDto` (mesmos totais/itens que o print).
5. Montar saudação + nome; chamar `WhatsAppService`.
6. Registrar auditoria.
7. Lote: intervalo ~1–2 s entre envios (rate limit).

### 7.3 Módulo sugerido

```
backend/src/modules/whatsapp/
  whatsapp.module.ts
  whatsapp.service.ts          # cliente HTTP Meta
  folha-recibo-whatsapp.service.ts  # orquestra folha + imagem + envio
  folha-recibo-imagem.service.ts    # HTML → PNG (puppeteer ou similar)
```

Reutilizar dados de `FolhaCapasService.calcularDetalhe` / `FolhaCapaDetalheDto`.

### 7.4 Variáveis de ambiente (Render / `.env`)

| Variável | Descrição |
|----------|-----------|
| `WHATSAPP_ENABLED` | `true`/`false` — desliga envio em dev |
| `WHATSAPP_API_VERSION` | Ex.: `v21.0` |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente (system user) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número na API (não é o +55) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID (opcional, útil para gestão) |
| `WHATSAPP_TEMPLATE_RECIBO_NAME` | Ex.: `recibo_pagamento_folha_imagem` (cabeçalho Imagem + corpo 4 variáveis) |
| `WHATSAPP_TEMPLATE_RECIBO_LANG` | `pt_BR` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Se configurar webhook depois |

**Nunca** expor token no frontend.

### 7.5 Permissões

- **Lançamento (individual):** `FOLHA_LANCAMENTO_ENVIAR_RECIBO_WHATSAPP` → grupo **Folha — Lançamentos**
- **Controle (massa):** `FOLHA_FECHAMENTO_ENVIAR_RECIBOS_WHATSAPP` → grupo **Folha — Controle**
- Frontend: espelhar em `usuario.model.ts`
- Migration `1747924000000`: perfis com envio individual recebem também envio em massa (retrocompatível)

---

## 8. Setup Meta / WhatsApp (pré-requisito operacional)

Ver também **seção 10 — Checklist antes de desenvolver**.

### 8.1 Camadas necessárias

```
Meta Business Manager
  └── Conta WhatsApp Business (WABA)
        └── Número dedicado (verificado)
  └── App em developers.facebook.com (produto WhatsApp)
        └── Phone Number ID + Access Token
        └── Template utilitário aprovado
```

### 8.2 Onde cadastrar o template

1. [WhatsApp Manager](https://business.facebook.com/wa/manage/home)
2. **Modelos de mensagem** / [message-templates](https://business.facebook.com/wa/manage/message-templates)
3. **Criar** → **Utilidade** → corpo com `{{1}}` e `{{2}}`
4. Aguardar status **Aprovado**

### 8.3 Número novo

- Preferir linha **dedicada** ao RH/folha.
- **Não** manter o mesmo número no WhatsApp comum do celular após vincular à Cloud API.
- Verificação por SMS/voz no cadastro do número.

### 8.4 Token permanente

Business Manager → **Usuários do sistema** → criar → atribuir app + WABA → token com `whatsapp_business_messaging`.

### 8.5 Modo desenvolvimento

App Meta em modo dev: adicionar números de teste ou publicar app (Live) conforme política da Meta.

### 8.6 Webhook (fase 2)

Opcional no MVP. URL callback + token para status entregue/lido e falhas.

---

## 9. Custo e anti-ban (~50/mês)

| Aspecto | Orientação |
|---------|------------|
| Custo Meta | Muito baixo (ordem de poucos R$/mês) para 50 conversas utilitárias |
| Ban | Risco baixo com API oficial + utilitário + opt-in + volume baixo |
| Evitar | Evolution, Baileys, número pessoal automatizado, template marketing, disparo agressivo |
| Boas práticas | Opt-in, telefone cadastrado, mensagem esperada (recibo pós-fechamento), rate limit no lote |

---

## 10. Checklist — organizar ANTES de desenvolver

Use esta lista no Business/Meta e no time. Só iniciar implementação com itens **obrigatórios** marcados.

### 10.1 Meta / WhatsApp (obrigatório)

- [ ] **Meta Business Manager** da empresa criado/acessível
- [ ] **WABA** (conta WhatsApp Business) criada ou vinculada
- [ ] **Número novo ou dedicado** escolhido (chip/linha)
- [ ] Número **verificado** na Cloud API (SMS/voz)
- [ ] Número **desvinculado** do WhatsApp comum do celular (se aplicável)
- [ ] **App Meta** criado em [developers.facebook.com](https://developers.facebook.com) com produto **WhatsApp**
- [ ] App vinculado à WABA e ao número
- [ ] **Phone Number ID** anotado
- [ ] **Access token permanente** gerado (system user + permissões WhatsApp)
- [ ] Template **`recibo_pagamento_folha`** (ou nome definido) categoria **Utilidade** — **APROVADO**
- [ ] Teste manual: enviar template para **seu celular** via API Setup / ferramenta de teste da Meta

### 10.2 Negócio / LGPD (obrigatório ou fortemente recomendado)

- [ ] Decisão: exigir **opt-in** (`aceitaReciboWhatsApp`) no cadastro do funcionário? (recomendado: **sim**)
- [ ] Texto de consentimento no cadastro (o que o funcionário autoriza)
- [ ] Quem recebe permissão `folha-lancamento:enviar-recibo-whatsapp` (perfis)
- [ ] Política de **reenvio** (livre ou uma vez por competência?)
- [ ] Horário de envio em massa (evitar madrugada?)

### 10.3 Infra / secrets (obrigatório para produção)

- [ ] Variáveis no **Render** (ou `.env` local) listadas na seção 7.4
- [ ] Token **não** commitado no Git
- [ ] `WHATSAPP_ENABLED=false` em dev se não houver credenciais

### 10.4 Dados / cadastro (obrigatório)

- [ ] Padrão de **telefone** no cadastro (máscara, DDD, só Brasil?)
- [ ] Processo para funcionários **sem telefone** (cadastrar antes do envio em massa)
- [ ] Confirmar se Pix TELEFONE pode ser copiado para `telefone` manualmente ou são campos separados

### 10.5 Técnico (decisões para o dev)

- [ ] Biblioteca de **HTML → PNG** no backend (Puppeteer, playwright, node-html-to-image — avaliar peso no Render)
- [ ] Fluxo Meta: template + imagem em **2 mensagens** (recomendado v1)
- [ ] Tabela de log de envios? (`folha_recibo_whatsapp_envio`) — recomendado para reenvio e suporte
- [ ] Webhook na v1 ou v2?

### 10.6 Opcional (pode ser pós-MVP)

- [ ] Webhook status entregue/lido
- [ ] Relatório de envios na UI
- [ ] Preview da imagem antes de enviar

---

## 11. Fases de implementação sugeridas

| Fase | Entrega |
|------|---------|
| **M1** | Doc RN-015 + permissão + env vars + `WhatsAppService` mock/real + envio individual (texto template + imagem) |
| **M2** | Geração de imagem idêntica ao recibo atual |
| **M3** | Botão Lançamento + modal + auditoria |
| **M4** | Envio em massa Controle + relatório de falhas |
| **M5** | Opt-in funcionário + migration + webhook (opcional) |

---

## 12. Checklist de validação (antes de deploy)

- [ ] `npm run migration:run` (permissão, opt-in se houver)
- [ ] Lote **aberto** → botões desabilitados
- [ ] Após **fechar lote** → individual e massa habilitados (com permissão)
- [ ] Imagem igual ao recibo de tela (receitas, descontos, líquido)
- [ ] Texto com saudação e nome corretos
- [ ] Sem telefone → erro claro; massa continua nos demais
- [ ] Auditoria registrada
- [ ] Reabrir lote → envio bloqueado
- [ ] Secrets no Render; `npm audit` sem regressão crítica

---

## 13. Prompt sugerido para outro chat (Agent)

```
Implementar envio de recibo de folha por WhatsApp conforme docs/WHATSAPP_RECIBO_FOLHA.md e RN-015 em docs/regras-negocio.md.

Decisões fixas: imagem PNG (não PDF); template utilitário Meta com {{1}} nome e {{2}} saudação;
só enviar com lote fechado; permissão folha-lancamento:enviar-recibo-whatsapp;
botão "Enviar recibo" abaixo de Congelar em folha-lancamentos-page;
botão "Enviar recibos" em folha-fechamento-page para linha FECHADA.
API oficial Meta apenas. Credenciais em variáveis de ambiente.

Pré-requisito: template aprovado e WHATSAPP_* configurados (ver checklist seção 10 do doc).
```

---

## 14. Referências

- [Modelos de mensagem — Meta (PT)](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/?locale=pt_BR)
- [WhatsApp Manager](https://business.facebook.com/wa/manage/home)
- [Preços WhatsApp Business](https://business.whatsapp.com/products/platform-pricing)
- Código atual do recibo: `frontend/src/app/components/folha/folha-lancamentos-page.ts`
- Fechamento de lote: RN-006 em `docs/regras-negocio.md`

---

*Última consolidação: discussões de especificação (recibo folha, API Meta, UI, permissões, imagem vs PDF, custo e setup).*
