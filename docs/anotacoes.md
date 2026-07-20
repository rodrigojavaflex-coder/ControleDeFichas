# Anotações / Demandas

> Última revisão: 2026-07-19

## Pendente

- [ ] **Configurar envio de e-mail** — recuperação de senha e notificações (pendências de fechamento, pendências de vendas, resumo de folha, etc.).
- [ ] **Orçamentos aprovados em aberto** — com os dados importados, trabalhar informações de orçamentos aprovados não recebidos; avaliar se em relatório ou painel.
- [ ] **Painel de folha de pagamento** — gastos por unidade, setor, função e cargo.
- [ ] **Menu e tela de permissões** — melhorar organização, separando permissões por módulos.
- [ ] **Fechamento individual de venda** — registrar fechamento pelo form de venda; busca rápida por protocolo no form para vendas que não atualizam automaticamente.
- [ ] **Filtros na lista de funcionários** — adicionar filtros por cargo e setor.
- [ ] **Cadastro de unidade** — reestruturar o sistema (hoje unidade é enum); centralizar no cadastro configurações de sincronização e WhatsApp (hoje no `.env`).
- [ ] **Enums → cadastros configuráveis** — revisar todos os enums do sistema e avaliar migração para cadastros, deixando o sistema mais customizável.
- [ ] **Metas e comissões** — tela de metas das unidades (dias úteis) e metas dos representantes; comissão de vendedores e prescritores (usar cadastro de funcionário); base nos valores das requisições pagas; painel gerencial e painel individual do usuário (evolução no mês).
- [ ] **Vínculo com unidade nos cadastros** — verificar cadastros sem vínculo com unidade; avaliar separação e filtro pela unidade do usuário.
- [ ] **Intervalo nas importações noturnas** — tratar período de intervalo nas buscas das importações durante a madrugada, evitando conflito com backup das unidades.
- [ ] **Agente WhatsApp (respostas automáticas)** — criar agente de respostas; definir permissões por número (ex.: folha, produção, metas, orçamento).
- [ ] **Controle de produção (capacidade)** — gerenciar capacidade com base em quantidade de funcionários e fórmulas em produção; ao incluir requisição, calcular tempo de entrega ao cliente.
- [ ] **Decisão gestão — fechamento produtividade (RN-PCP-004)** — alinhar com responsáveis: remunerar por fórmula concluída (atual) vs cada saída ERP; critério para correções PCP; relatório oficial ERP vs sistema novo. Ver `docs/regras-negocio.md` RN-PCP-004 e `docs/sql/producao_etapas_conferencia_erp.sql`.
- [ ] **Notas fiscais não transmitidas** — pesquisar na base informações sobre NF-e/NFC-e não transmitidas e criar tela de alerta.

## Concluído

- [x] **Configuração de cálculo por etapas de produção** — valor por etapa concluída; vínculo funcionário × etapas remuneradas; fechamento de produtividade por período; telas em Configuração → Produção e Produtividade. (2026-07-19, frontend v1.6.0)
- [x] **Nomes das etapas de produção** — padronização em uppercase pt-BR na importação (agente + backend); reimportar período para atualizar registros existentes. (2026-07-17)

<!-- Mover itens aqui ao finalizar; anotar data e referência (commit/PR) quando aplicável. -->
