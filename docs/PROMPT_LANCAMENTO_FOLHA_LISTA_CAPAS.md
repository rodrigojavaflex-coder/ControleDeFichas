# Prompt — Lançamento de folha: lista de capas e botão Carregar

Este documento segue o padrão de `docs/GUIA_OPERACAO_AGENTE.md` (contexto, escopo, critérios de aceite, validação). Use-o **copiando o bloco “Prompt pronto para o agente”** na conversa ou como referência para tarefas incrementais.

---

## Prompt pronto para o agente

```md
Contexto:
A tela de **Lançamento de folha** deve deixar de usar **combo de funcionário** como seletor principal. Após o processamento disparado por **Carregar**, o usuário vê uma **lista de funcionários (capas)** para a combinação **unidade + competência (ano/mês) + tipo de folha**. Cada item representa uma **folha_capa** existente ou criada nesse processamento. Ao **clicar no funcionário/capa**, abre-se a **edição dos eventos (itens)** dessa capa; refinamentos de UX dessa edição poderão ser tratados em tarefa posterior.

Objetivo:
1) Manter o **primeiro container de filtros** como hoje: unidade, competência (navegação mês/ano), tipo de folha e botão **Carregar**.
2) Se o usuário tiver **unidade definida no perfil**, **pré-selecionar** essa unidade no filtro e **desabilitar** o select de unidade (mesmo comportamento já usado na folha quando aplicável).
3) **Habilitação do botão Carregar**: exige **unidade** escolhida (valor efetivo, não “Todas” quando isso impedir operações), **competência** e **tipo de folha** válidos; com essa seleção, **consultar se a folha/competência está aberta para lançamento** (`folha_fechamento`: abertura registrada e lote **não** fechado conforme RN-006); se **aberta**, o botão Carregar fica **habilitado**.
4) **Ao clicar em Carregar**: buscar/obter todas as **capas** já existentes para **unidade + competência + tipo**. Para cada **funcionário elegível** que **ainda não** tenha capa nessa tripleta, **criar** a capa. Critérios de elegibilidade (processamento servidor e/ou filtros consistentes com a lista):
   - funcionário **ativo**;
   - **ano e mês da data de admissão ≤ ano e mês da competência**;
   - se existir **data de demissão**: **ano e mês da demissão > ano e mês da competência** (competência estritamente antes do mês/ano de demissão no critério de índice usado pela API).

Escopo permitido (sugestão):
- frontend: `frontend/src/app/components/folha/folha-lancamentos-page.ts`, `folha-lancamentos-page.html`, `folha-pages.shared.css`; `frontend/src/app/services/folha.service.ts`, models em `frontend/src/app/models/folha.model.ts` se o contrato mudar.
- backend: `backend/src/modules/folha/` (capas, funcionários lançamento, fechamento) — endpoints/DTO/serviços que implementam carga de capas e elegibilidade.
- Documentação funcional: alinhar `docs/regras-negocio.md` (**RN-006** abertura/fechamento; **RN-005/RN-011** ou nova RN-* se os critérios de elegibilidade no fluxo mensal/lista divergirem da redação atual).

Fora de escopo (salvo novo pedido):
- Redesenho completo da **edição de eventos** (layout avançado, atalhos, bulk edit); apenas garantir navegação “clique na lista → edição da capa/itens já existente”.

Critérios de aceite verificáveis:
1) Com **unidade + competência + tipo** válidos e competência **aberta** (RN-006), o botão **Carregar** fica habilitado; com competência não registrada ou **fechada**, permanece **desabilitado** e a UI orienta conforme já previsto nas regras.
2) Não há **combo** de funcionário para o fluxo desta estrutura: a seleção deve ser pela **lista de capas** exibida após (ou como resultado de) **Carregar**.
3) **Carregar** retorna ou reflete a lista de capas da tripleta; ausência de capa prévia implica **criação** só para funcionários que atendem **todos** os critérios de elegibilidade acima.
4) **Clique** em um item da lista abre o painel (ou rota) de **edição dos itens/eventos** da capa correspondente (comportamento mínimo acordado; melhorias futuras documentadas).
5) **Tema claro e escuro**: lista e botões mantêm contraste, **focus** visível e estados **disabled** coerentes com o restante da folha.

Validação esperada:
- `npx nest build` no backend (ou script de build do projeto) e `npx ng build` no frontend sem erros de TypeScript/template.
- Teste manual: usuário com unidade fixa; competência aberta vs fechada vs não registrada; funcionário com/sem demissão e com admissão antes/depois da competência; verificar que só elegíveis recebem **nova** capa e que já existentes só são **listadas/carregadas**.

Regras e referências obrigatórias:
- `docs/regras-negocio.md`: **RN-006** (abertura/fechamento), **RN-001**/`RN-002` onde couber unicidade/itens na capa; **atualizar ou criar RN-*** se a elegibilidade com demissão (competência vs mês da demissão) não estiver documentada igual ao comportamento novo.
- Regras de Cursor do workspace: `regras-ui.mdc`, `regras-negocio.mdc`, `regras-api-dados.mdc`.
```

---

## Notas para o solicitante (fora do prompt)

- Se a implementação atual usar filtro “**sem demissão**” no fluxo mensal, este prompt **expande** a regra para permitir funcionário demitido quando a **competência é anterior** ao mês/ano da demissão (**demissão > competência** no sentido ano×12+mês). Confirme com o time e **alinhe RN-011** (ou nova RN) antes de divergências entre doc e código.
- Tarefas grandes: peça primeiro **plano curto** ao agente, conforme `GUIA_OPERACAO_AGENTE.md`.

---

## Template rápido (só bullets)

Copie e preencha se preferir formato mínimo:

- **Contexto:** lista de capas substitui combo; Carregar monta/atualiza capas conforme filtros e abertura de lote.  
- **Objetivo:** UI + contrato/API alinhados às regras de elegibilidade e RN-006.  
- **Escopo:** páginas Folha lançamentos, serviços, módulo `folha` backend, `regras-negocio.md`.  
- **Aceite:** habilitação do botão; lista; criar só elegíveis; clique → edição; tema claro/escuro.
