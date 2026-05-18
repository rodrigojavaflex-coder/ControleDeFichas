# Regras de negócio — NEST_ANGULAR

## Como citar

- Use identificadores estáveis **`RN-001`**, **`RN-002`**, … no texto e nos prompts ao agente.
- Em implementações e PRs, referencie a RN-* afetada na descrição ou no checklist.

## Módulo: Folha (pagamento simplificado)

### RN-001 — Unicidade da folha capa por competência

- Para cada **cadastro de funcionário** (`funcionarios`), só pode existir **uma** `folha_capa` por combinação **(ano, mês, tipo de folha)**.
- **Mensagem ao usuário (conflito):** operação rejeitada com detalhe de duplicidade retornado pela API.

### RN-008 — Unidade no cadastro do funcionário

- Cada funcionário tem **campo obrigatório `unidade`** no próprio registro (`funcionarios.unidade`).
- Migrações a partir do modelo anterior: se existisse mais de um vínculo funcionário-unidade histórico, a unidade oficial do cadastro torna-se **`MIN(unidade)` em ordem lexicográfica** (determinístico).
- Cadastros sem vínculo herdaram **`INHUMAS`** na migração (revisar dados se necessário).
- **Endpoints de vínculo** (`POST/PATCH …/vinculos`) foram **removidos**; atualização apenas via **`PATCH …/folha/funcionarios/:id`**.
- **`GET …/folha/funcionarios/lancamento`:** funcionários **`f.unidade = :unidade`**; com **`ano`** e **`mes`**, apenas quem pode **nova capa** nessa competência (mesmos critérios da RN-011). O flag legado **`filtroCompetenciaMensal`** não altera o resultado quando ano/mês estão informados.

### RN-009 — Contato no cadastro do funcionário

- **`telefone`**, **`endereco`** e **`email`** são **opcionais** (colunas nullable; strings vazias convertidas pelo backend quando aplicável).
- **E-mail:** se preenchido, deve ser válido (**validação na API**).
- **`ativo` na UI:** utilizar **lista de opções** (Sim/Não); o significado de negócio permanece **`boolean`** (ativos aparecem em fluxos já descritos nas RN relacionadas).

### RN-010 — Campos obrigatórios e Pix no cadastro do funcionário

- No **cadastro de funcionário** (`POST/PATCH …/folha/funcionarios`), são **obrigatórios**: **nome**, **data de nascimento**, **unidade** e **data de admissão**. Valores monetários da folha vêm dos **eventos/itens** (capa e eventos fixos), não de campo único no funcionário.
- **`tipoPix`** e **`chavePix`** são **opcionais**. Se um for informado, o outro também deve ser (**coerência** na API e na UI).
- **`tipoPix`** aceita apenas valores estáveis da API: **`CPF`**, **`TELEFONE`**, **`EMAIL`**, **`CHAVE_ALEATORIA`** (enum `TipoChavePixFolha`).
- **`chavePix`:** string (até 200 caracteres na persistência); com **tipo** definido, o backend valida **formato conforme o tipo** (CPF com 11 dígitos; telefone com 10–13 dígitos numéricos; e-mail com formato válido; chave aleatória com **32 caracteres hexadecimais**, aceitando UUID com ou sem hífens após normalização).
- **Mensagens ao usuário:** erros de validação retornados pela API (400) e feedback por campo na UI do formulário.

### RN-002 — Unicidade de verba na capa

- Na mesma `folha_capa`, **não** pode haver dois `folha_item` com a mesma `folha_verba`.
- **Mensagem ao usuário:** indica que a verba já foi lançada na folha.

### RN-011 — Lançamento: Carregar lista de capas na competência

- Na **tela Lançamento de folha**, o fluxo principal **não usa combo de funcionário**. Mantém-se o **primeiro bloco de filtros**: **unidade** (bloqueada e pré-preenchida quando o usuário tem **`usuario.unidade`** no perfil, alinhado à tela Controle/Vendas), **competência** (navegação mês/ano), **tipo de folha** e o botão **Carregar**.
- **Habilitação do Carregar**: exige **unidade** válida para operação (não usar **«Todas»** onde a API exija unidade), **tipo** escolhido e competência com **abertura registrada** em **`folha_fechamento`** e lote **não fechado** (RN-006). A UI desabilita o botão até que o status reflita esse estado.
- **Lista automática com competência aberta:** ao mudar **unidade**, **tipo de folha** ou **competência** (voltar/próximo no mês/ano), após consultar o status (**`GET …/folha/fechamento/status`**), se as mesmas condições de habilitação do Carregar estiverem atendidas (e o usuário tiver permissão de lançamento), a UI pode chamar **`POST …/folha/capas/carregar-competencia`** no mesmo momento, sem exigir clique extra; se o lote não estiver aberto/registrado, **não** se exibe o modal de erro de “Carregar manual” — o usuário continua usando o botão quando quiser forçar a tentativa ou ver mensagem de bloqueio.
- **Ao clicar em Carregar**, a API deve retornar a lista das **`folha_capa`** da tripleta **unidade + competência + tipo**: para cada **funcionário elegível** que **ainda não** tenha capa, **criar** a capa; capas já existentes são **obtidas** e retornadas (unicidade RN-001). Endpoint canônico: **`POST …/folha/capas/carregar-competencia`**. O caminho **`POST …/folha/capas/carregar-mensal`** permanece como **alias** com o mesmo corpo (legado).
- Na **primeira criação** de cada `folha_capa`, a API inclui automaticamente os **`folha_item`** previstos nos **eventos fixos** do cadastro do funcionário (**RN-013**), respeitando a unicidade de verba por capa (**RN-002**) e ignorando verbas **inativas**.
- **Elegibilidade para incluir um funcionário nesse processamento** (índice de competência = **ano×12+mês** da competência alvo, idem para datas de admissão/demissão a partir do ISO **YYYY-MM-DD**):
  - funcionário **ativo**;
  - **mês/ano da data de admissão ≤ mês/ano da competência**;
  - se houver **data de demissão**: **mês/ano da demissão > mês/ano da competência** (a competência deve ser **estritamente anterior** ao mês/ano da demissão; o **mês da demissão** não recebe nova capa).
- **`GET …/folha/funcionarios/lancamento`** com **`ano`** e **`mes`** devolve apenas funcionários que atendem **estes mesmos critérios** (útil para integrações e consistência com o carregamento em lote).
- O campo **`folhaMensal`** em **`folha_tipo`** pode permanecer no cadastro como **metadado**; **não** restringe mais o uso de **`carregar-competencia`** na API.
- **`POST …/folha/capas`** com um **`funcionarioId`** segue disponível para **obter ou criar** a capa de **um** funcionário, sujeito às mesmas validações de elegibilidade e de lote (RN-005, RN-006).
- **UI:** após Carregar, exibe-se uma **lista** de capas (funcionário + totais resumidos); **clique** no item abre a **edição dos eventos (itens)** daquela capa (refinos de layout podem evoluir em tarefa apartada).

### RN-003 — Exclusão de verba no cadastro

- **Não** é permitido excluir `folha_verba` se existir **qualquer** `folha_item` que a referencie (histórico de uso).
- **Tratamento preferencial:** inativar a verba (`ativo = false`); exclusão física apenas sem uso.
- **Mensagem ao usuário:** orientar a inativar em vez de excluir.

### RN-004 — Exclusão de item na folha do funcionário

- É permitido **excluir** `folha_item` (remover o evento da capa), desde que o **lote** da competência esteja **aberto** (RN-006) e a **capa não esteja congelada** (RN-012).

### RN-005 — Demissão e novas competências

- Se o funcionário possui **data de demissão**, **não** é permitido criar **nova** `folha_capa` cuja competência (índice ano×12+mês) seja **maior ou igual** ao índice do **mês/ano da demissão** (ou seja: só competências **estritamente anteriores** ao mês da demissão podem receber **nova** capa; o **mês da demissão** e posteriores **não**).
- Funcionário **sem** data de demissão segue a regra de admissão e ativo conforme RN-011 nas operações de **nova** capa.
- Capas **já existentes** em competências posteriores à demissão (dados legados) podem permanecer **consultáveis** conforme política de leitura; **novas** criações seguem o critério acima.
- **Listagem de funcionários para lançamento (`GET …/lancamento`):** com **ano** e **mês**, retorna apenas quem atende RN-011 (incluindo este critério de demissão).

### RN-006 — Abertura, controle de competências e fechamento do lote

- O registro de abertura usa **`POST …/folha/fechamento/abertura`** (**permissão `folha-fechamento:registrar-abertura`**).
- Sem **linha em `folha_fechamento`** para aquela quadrupla, os lançamentos (`folha_capa` / `folha_item`) **não podem ser criados nem alterados** — a UI orienta usar **Controle das competências** antes do **Lançamento de folha**.
- **`GET …/folha/fechamento/status`** expõe se a competência está **registrada** (`registrada`), **fechada** (`fechado`) e dados de auditoria quando aplicável.
- **`GET …/folha/fechamento/competencias-registradas`:** **`ano`** obrigatório; **`unidade`**, **`mes`** e **`folhaTipoId`** opcionais; retorna competências **já em `folha_fechamento`**, incluindo **`abertaEm`** (data e hora da abertura vigente na API: primeira abertura ou instante da última **`reabrir`**). Omitindo **`unidade`**, o escopo depende do perfil (**`admin:full`** ou usuário **sem vínculo de unidade**): lista **todas** as unidades; com vínculo a uma única unidade atua só nela — não monta grade cartesiana mês×tipo.
- **`POST …/folha/fechamento/fechar`** fecha o lote da competência (**`folha-fechamento:fechar`**). **`POST …/folha/fechamento/reabrir`** volta **`fechado = false`**, limpa `fechadoEm` / `fechadoPor` (**`folha-fechamento:reabrir`**).
- Com lote **fechado** (`fechado = true`), **não** é permitido criar, alterar ou excluir `folha_capa` nem `folha_item` daquele lote.
- **Mensagens ao usuário:** orientação para registrar abertura; erro se lote fechado ao editar; confirmação em modal ao fechar ou reabrir lote na tela de controle.
- Competências já existentes em `folha_capa` antes desta regra recebem linha **`folha_fechamento`** com `fechado = false` na migração de backfill, preservando cenários já em uso.

### RN-012 — Congelamento por capa (folha do funcionário)

- Além do **fechamento do lote** (RN-006), pode-se **congelar** uma **`folha_capa`** específica: flag `congelada` na capa, com auditoria opcional (`congeladaEm`, `congeladaPor`).
- Enquanto a capa estiver **congelada** e desde que o lote permaneça **aberto** na API (RN-006), **não** é permitido: incluir, alterar ou excluir **`folha_item`** dessa capa; nem **`PATCH …/folha/funcionarios/:id`** para o funcionário vinculado (enquanto existir **qualquer** capa **congelada** para esse funcionário).
- **Congelar** exige permissão **`folha-lancamento:congelar-capa`**; **liberar** exige **`folha-lancamento:liberar-capa`**. Endpoints canônicos: **`POST …/folha/capas/:id/congelar`** e **`POST …/folha/capas/:id/liberar`** (query **`unidade`** obrigatória, alinhada às demais rotas de capa).
- Com lote **fechado**, permanece vedada qualquer alteração de lançamentos (RN-006); **congelar/liberar** também exige lote **aberto** na API.
- **UI (Lançamento de folha):** exibe o estado congelado, botão **Congelar** ou **Liberar** conforme permissões e desabilita inclusão/edição/exclusão de eventos na capa congelada.

### RN-013 — Eventos fixos do funcionário

- O cadastro do funcionário (**`POST` / `PATCH …/folha/funcionarios`**) pode enviar opcionalmente **`eventosFixos`**: lista de objetos **`folhaVerbaId`**, **`quantidade`** (referência, &gt; 0; padrão 1 na API quando omitida) e **`valor`**. Os dados ficam na tabela **`folha_funcionario_evento_fixo`**, **uma linha por verba** por funcionário (única combinação funcionário + verba).
- Em **`PATCH`**, se **`eventosFixos`** vier no JSON, substitui **todo** o conjunto (**lista vazia** remove todos os eventos fixos). Se **`eventosFixos`** não for enviada, os eventos fixos **permanecem** como estão.
- Somente **`folha_verba` ativa** aceita inclusão/atualização na lista (`400` caso contrário).
- Ao **criar pela primeira vez** a **`folha_capa`** (fluxo **`obterOuCriar`** — inclusive **`carregar-competencia`**), a replicação para **`folha_item`** usa **valor e quantidade** salvos nos eventos fixos; não cria segunda linha se já existir item da mesma verba na capa; **verbas inativas** cadastradas no fixo antes de inativação são **ignoradas** na cópia.
- **Alterar** eventos fixos **não altera retroaticamente** capas já criadas nas competências anteriores; só **novas** capas ganham esse autopreenchimento.
- **UI:** tela Novo / Editar funcionário exibe container **Eventos fixos (folha)** com pelo menos uma linha vazia no cadastro novo para já permitir inclusão antes do primeiro salvar.

### RN-007 — Permissões e unidade

- Acesso aos dados da folha considera **`admin:full`** (qualquer unidade), **usuário com vínculo a uma única unidade** — **`usuario.unidade`** quando preenchido; se estiver **vazio**/nulo mas houver **`vendedor` vinculado**, usa-se **`usuario.vendedor.unidade`** como escopo único — (apenas registros dessa unidade) ou **usuário sem esses vínculos**, que também pode informar/atuar em **qualquer** unidade mediante as permissões de folha (**não** exige vínculo na entidade usuário neste caso).
- Na tela **Controle das competências**, o filtro de unidade segue o mesmo critério da lista de **Vendas**: fica **fixo e bloqueado** somente quando **`usuario.unidade`** existe e não é string vazia; perfis sem essa coluna preenchida mantêm o seletor liberado (incluindo opção “Todas”), alinhado ao comportamento da API para o escopo efetivo de quem tem só `vendedor.unidade`.
- **`GET …/folha/funcionarios` (lista paginada):** continua usando o query param `unidade` no escopo do usuário/`admin:full` (usuario sem vínculo ou admin conforme filtros disponíveis).
- **`POST …/folha/capas`:** aceita **`funcionarioId`**; a unidade do body deve **coincidir** com `funcionarios.unidade` desse funcionário (e com o escopo do usuário).
- Permissões do épico (atribuir via perfil): `folha-funcionario:create|read|update|delete`; `folha-cargo:create|read|update|delete|audit`; `folha-setor:create|read|update|delete|audit`; `folha-verba:create|read|update|delete`; `folha-tipo:create|read|update|delete`; `folha-lancamento:create|read|update|delete|congelar-capa|liberar-capa`; `folha-fechamento:read`; `folha-fechamento:registrar-abertura`; `folha-fechamento:fechar`; `folha-fechamento:reabrir`. Leituras auxiliares (ex.: listar tipos/verbas/cargos/setores/lista para lançamento) combinam permissões definidas na API.

---

## Demais módulos

Orientação para o time:

1. Documente cada regra com: **identificador (RN-*)**, **módulo**, **descrição**, **critérios de aceite**, **mensagens ao usuário** (erro/sucesso quando aplicável).
2. Ao alterar comportamento funcional na aplicação, **atualize ou crie** a RN-* correspondente antes de dar a tarefa como concluída.
3. Em caso de divergência entre este documento e o código, trate como **dívida**: sinalize no PR e alinhe doc ou implementação.
