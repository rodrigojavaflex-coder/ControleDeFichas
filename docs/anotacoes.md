# Anotações / Demandas

> Última revisão: 2026-08-25

## Decisões operacionais

### Node.js e agente nas filiais (2026-07-22)

- **Dev (máquina local):** Node **24** LTS — validado (backend, frontend, agent build, sync, folha/recibo).
- **Filiais (servidor do agente Firebird):** permanecem em Node **22**; **não** atualizar Node só por alinhamento de versão.
- **Redeploy do agente** (`agent/scripts/deploy.ps1` → `atualiza-agente.ps1` em cada filial): **somente** quando houver mudança no código/sync do `agent/` (SQL, endpoints, encoding, etc.).
- Subir Node na filial no futuro: fazer **junto** com deploy de sync; após trocar Node no servidor, `npm ci --omit=dev` em `C:\agente` — **não** exige regerar pacote na dev só por causa da versão do Node.
- Referência deploy: `agent/scripts/deploy.ps1`, `agent/scripts/atualiza-agente.ps1`, `agent/README.md`.

### Acompanhamento Visitação — carteira por período (painel + histórico)

**Status (2026-08-25):** não implementar agora. O acompanhamento continua lendo só o painel **ativo** (`painel_medicos_representantes`). Registrar aqui para tratar depois.

**Como está hoje**

- `crms_carteira`, filtro Representante e `painel_norm` usam apenas `painel_medicos_representantes` (foto atual).
- Histórico (`painel_medicos_representantes_historico`, RN-REP-002) só grava **remoção** (append-only): snapshot CRM/UF/contrato/código/nome, `motivoRemocao`, `removidoEm`, `criadoEmPainel` (= `criadoEm` da linha ativa no momento da exclusão).
- Não é linha do tempo do ERP (`FC04200` é foto atual). `criadoEm` / `criadoEmPainel` = data do **nosso sync**, não entrada no FC.

**Regra desejada (carteira do período)**

```
painel atual da unidade/representante
  ∪
histórico cuja vigência cruza [dataInicial, dataFinal]
```

- Vigência no histórico: `[criadoEmPainel, removidoEm)`.
- Cruza o filtro se: `criadoEmPainel <= dataFinal` **e** `removidoEm >= dataInicial` (se `criadoEmPainel` nulo, usar só `removidoEm >= dataInicial`).
- **Não** usar só “`removidoEm` ∈ [início, fim]”: médico removido em 01/08 some do julho mesmo tendo estado no painel o mês inteiro.
- Exemplo ok: removido 15/07 + filtro 01–31/07 → entra junto com o painel atual.

**Dois jeitos de crédito**

1. Só carteira (mais simples): UNION no CRM; o médico removido em 15/07 leva **todo** o movimento do período (inclusive 20/07).
2. Carteira + data do movimento (mais fiel): crédito só se a data do recebido/rejeitado (`DTEFE` / `dataOrcamento`) estiver dentro da vigência (`>= criadoEmPainel` e `< removidoEm`). Preferível para comissão.

**Onde plugar (quando for implementar)**

- CTE `crms_carteira` (indicação / No Painel = Sim)
- `filtroRep` (`EXISTS` em `painel_medicos_representantes`)
- `painel_norm` / nome do representante na grade
- Mesma chave: unidade + CRM + UF + contrato + código
- Arquivo: `backend/src/modules/visitacao-acompanhamento/visitacao-acompanhamento.service.ts`

**Quem entrou depois do período e ainda está no ativo**

- Histórico não registra entrada, só saída. Quem entrou no ERP depois do filtro e ainda está no ativo **continua aparecendo** no mês antigo.
- Corte no ativo: `criadoEm::date <= dataFinal` (par do `criadoEmPainel` no histórico). Update do sync **não** altera `criadoEm`; insert novo sim.
- **Não aplicar esse corte** se o primeiro import do painel foi **depois** do período (ex.: carga em agosto + filtro julho): todo mundo ganha o mesmo `criadoEm` e o card do mês histórico zera. Só usar `criadoEm` quando o sync já rodava **antes** do início do filtro.
- Linha apagada e recriada (saiu → histórico → voltou): `criadoEm` do ativo é da volta; o período antigo depende do histórico.

**O que isso não resolve**

- Não reconstrói `FC04200` de um mês anterior ao primeiro sync.
- Não explica médicos a mais vs PDF se eles já estão no painel atual (ex.: Rayssa/Euler no Marcos).

## Pendente

- [ ] **Acompanhamento Visitação — carteira por período (painel + histórico)** — UNION do painel ativo com `painel_medicos_representantes_historico` (vigência cruzando o filtro); depois avaliar corte `criadoEm` no ativo. **Não implementar agora.** Detalhe na seção “Decisões operacionais” acima. (2026-08-25)
- [ ] **Configurar envio de e-mail** — recuperação de senha e notificações (pendências de fechamento, pendências de vendas, resumo de folha, etc.).
- [ ] **Orçamentos aprovados em aberto** — com os dados importados, trabalhar informações de orçamentos aprovados não recebidos; avaliar se em relatório ou painel.
- [ ] **Painel de folha de pagamento** — gastos por unidade, setor, função e cargo.
- [x] **Menu e tela de permissões** — catálogo `PERMISSION_MODULES`, formulário com accordions por módulo, chips na lista, duplicar perfil. (2026-07-20)
- [ ] **Fechamento individual de venda** — registrar fechamento pelo form de venda; busca rápida por protocolo no form para vendas que não atualizam automaticamente.
- [ ] **Filtros na lista de funcionários** — adicionar filtros por cargo e setor.
- [ ] **Cadastro de unidade** — reestruturar o sistema (hoje unidade é enum); centralizar no cadastro configurações de sincronização e WhatsApp (hoje no `.env`).
- [ ] **Enums → cadastros configuráveis** — revisar todos os enums do sistema e avaliar migração para cadastros, deixando o sistema mais customizável.
- [ ] **Metas e comissões** — tela de metas das unidades (dias úteis) e metas dos representantes; comissão de vendedores e prescritores (usar cadastro de funcionário); base nos valores das requisições pagas; painel gerencial e painel individual do usuário (evolução no mês).
- [ ] **Vínculo com unidade nos cadastros** — verificar cadastros sem vínculo com unidade; avaliar separação e filtro pela unidade do usuário.
- [ ] **Intervalo nas importações noturnas** — tratar período de intervalo nas buscas das importações durante a madrugada, evitando conflito com backup das unidades.
- [ ] **Agente WhatsApp (respostas automáticas)** — criar agente de respostas; definir permissões por número (ex.: folha, produção, metas, orçamento).
- [ ] **Controle de produção (capacidade)** — gerenciar capacidade com base em quantidade de funcionários e fórmulas em produção; ao incluir requisição, calcular tempo de entrega ao cliente.
- [ ] **Decisão gestão — fechamento produtividade (RN-PCP-004)** — alinhar totais mensais vs ERP (ex.: INGRIDHY ROT +6, 96172 PESO, JESSICA); req. **97414 validada OK** (LADSON ENCAPS, INGRIDHY PESO). Ver `docs/regras-negocio.md` RN-PCP-004.
- [ ] **Relatório de produtividade — detalhamento por etapa e funcionário (incl. órfãs na Gestão)** — novo relatório (impressão/exportação) para apoiar fechamento e conferência com a grade:
  - Listar conclusões por **etapa base** (período/unidades da consulta), com **funcionário** (`funcSaida` / cadastro ERP), **requisição-fórmula** (`{requisicao}-{formula} {etapa}`) e unidade.
  - Bloco específico para **Gestão**: detalhar **etapas órfãs** — linhas da etapa base remunerada no resumo que **não** entram na contabilização individual (RN-PCP-005): sem cadastro ERP, sem vínculo em `producao_funcionario_etapa`, etc.; total órfão vs total contabilizado vs total usado na coluna **GESTÃO** (RN-PCP-006).
  - Permissão sugerida: `producao-produtividade:read` (+ alertas detalhados se reutilizar dados sensíveis); avaliar atalho na tela `/producao/produtividade`.
- [ ] **Notas fiscais não transmitidas** — pesquisar na base informações sobre NF-e/NFC-e não transmitidas e criar tela de alerta.
- [ ] **Fechamento de caixa por WhatsApp** — no fechamento de caixa, enviar imagem do fechamento via WhatsApp; se possível, enviar ao grupo.
- [ ] **Unificação vendedor × funcionário** — cadastro de vendedor duplicado com funcionário (cargo vendedor); unificar no sistema e eliminar cadastro de vendedor.



## Concluído

- [x] **Configuração de cálculo por etapas de produção** — valor por etapa concluída; vínculo funcionário × etapas remuneradas; fechamento de produtividade por período; telas em Configuração → Produção e Produtividade. (2026-07-19, frontend v1.6.0)
- [x] **Nomes das etapas de produção** — padronização em uppercase pt-BR na importação (agente + backend); reimportar período para atualizar registros existentes. (2026-07-17)