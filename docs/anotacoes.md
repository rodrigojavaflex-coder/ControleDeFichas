# Anotações / Demandas

> Última revisão: 2026-07-22

## Decisões operacionais

### Node.js e agente nas filiais (2026-07-22)

- **Dev (máquina local):** Node **24** LTS — validado (backend, frontend, agent build, sync, folha/recibo).
- **Filiais (servidor do agente Firebird):** permanecem em Node **22**; **não** atualizar Node só por alinhamento de versão.
- **Redeploy do agente** (`agent/scripts/deploy.ps1` → `atualiza-agente.ps1` em cada filial): **somente** quando houver mudança no código/sync do `agent/` (SQL, endpoints, encoding, etc.).
- Subir Node na filial no futuro: fazer **junto** com deploy de sync; após trocar Node no servidor, `npm ci --omit=dev` em `C:\agente` — **não** exige regerar pacote na dev só por causa da versão do Node.
- Referência deploy: `agent/scripts/deploy.ps1`, `agent/scripts/atualiza-agente.ps1`, `agent/README.md`.

## Pendente

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
- [ ] **Notas fiscais não transmitidas** — pesquisar na base informações sobre NF-e/NFC-e não transmitidas e criar tela de alerta.
- [ ] **Fechamento de caixa por WhatsApp** — no fechamento de caixa, enviar imagem do fechamento via WhatsApp; se possível, enviar ao grupo.
- [ ] **Unificação vendedor × funcionário** — cadastro de vendedor duplicado com funcionário (cargo vendedor); unificar no sistema e eliminar cadastro de vendedor.

## Concluído

- [x] **Configuração de cálculo por etapas de produção** — valor por etapa concluída; vínculo funcionário × etapas remuneradas; fechamento de produtividade por período; telas em Configuração → Produção e Produtividade. (2026-07-19, frontend v1.6.0)
- [x] **Nomes das etapas de produção** — padronização em uppercase pt-BR na importação (agente + backend); reimportar período para atualizar registros existentes. (2026-07-17)

<!-- Mover itens aqui ao finalizar; anotar data e referência (commit/PR) quando aplicável. -->
