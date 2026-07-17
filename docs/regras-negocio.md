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
- **`DELETE …/folha/funcionarios/:id`:** só é permitido quando **não** existir **`folha_capa`** para o funcionário. Caso contrário, a API responde `400` listando cada competência com lançamento (**unidade**, **tipo de folha**, **mês/ano**) para orientar a exclusão das capas em **Lançamento de folha** (RN-016) antes de excluir o cadastro.
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
- **Habilitação do Carregar**: exige **unidade** válida para operação (não usar **«Todas»** onde a API exija unidade), **tipo** escolhido e competência com **abertura registrada** em **`folha_fechamento`** (RN-006). Com lote **aberto**, exige permissão **`folha-lancamento:create`**; com lote **fechado**, exige **`folha-lancamento:read`** (somente visualização e recibo — RN-015).
- **Lista automática:** ao mudar **unidade**, **tipo de folha** ou **competência** (voltar/próximo no mês/ano), após consultar o status (**`GET …/folha/fechamento/status`**), se filtros válidos e abertura registrada, a UI carrega as capas automaticamente: lote **aberto** → **`POST …/folha/capas/carregar-competencia`** (perm. create); lote **fechado** → **`GET …/folha/capas?comDetalhe=true`** (perm. read). Se o lote não estiver registrado, **não** há carga automática.
- **Ao clicar em Carregar** com lote **aberto**, a API retorna a lista das **`folha_capa`** da tripleta **unidade + competência + tipo**: para cada **funcionário elegível** que **ainda não** tenha capa, **criar** a capa; capas já existentes são **obtidas** e retornadas (unicidade RN-001). Endpoint canônico: **`POST …/folha/capas/carregar-competencia`**. O caminho **`POST …/folha/capas/carregar-mensal`** permanece como **alias** com o mesmo corpo (legado).
- **Ao clicar em Carregar** com lote **fechado**, a UI chama **`GET …/folha/capas?comDetalhe=true`** (somente leitura; **não** cria capas). Botões de **incluir**, **editar**, **congelar**, **liberar**, **remover** (item) e **Excluir** (capa) ficam **ocultos**; **Recibo** e **Enviar recibo** permanecem disponíveis após expandir uma capa (RN-015).
- Na **primeira criação** de cada `folha_capa`, a API inclui automaticamente os **`folha_item`** previstos nos **eventos fixos** do cadastro do funcionário (**RN-013**), respeitando a unicidade de verba por capa (**RN-002**) e ignorando verbas **inativas**.
- **Elegibilidade para incluir um funcionário nesse processamento** (índice de competência = **ano×12+mês** da competência alvo, idem para datas de admissão/demissão a partir do ISO **YYYY-MM-DD**):
  - funcionário **ativo**;
  - **mês/ano da data de admissão ≤ mês/ano da competência**;
  - se houver **data de demissão**: **mês/ano da demissão > mês/ano da competência** (a competência deve ser **estritamente anterior** ao mês/ano da demissão; o **mês da demissão** não recebe nova capa).
- **`GET …/folha/funcionarios/lancamento`** com **`ano`** e **`mes`** devolve apenas funcionários que atendem **estes mesmos critérios** (útil para integrações e consistência com o carregamento em lote).
- O campo **`folhaMensal`** em **`folha_tipo`** pode permanecer no cadastro como **metadado**; **não** restringe mais o uso de **`carregar-competencia`** na API.
- **`POST …/folha/capas`** com um **`funcionarioId`** segue disponível para **obter ou criar** a capa de **um** funcionário, sujeito às mesmas validações de elegibilidade e de lote (RN-005, RN-006).
- **UI:** após Carregar, exibe-se uma **lista** de capas (funcionário + totais resumidos); **clique** no item abre os **eventos (itens)** daquela capa — **edição** somente com lote aberto; com lote fechado, **somente leitura** e ações de **recibo** (RN-015).

### RN-003 — Exclusão de verba no cadastro

- **Não** é permitido excluir `folha_verba` se existir **qualquer** `folha_item` que a referencie (histórico de uso).
- **Tratamento preferencial:** inativar a verba (`ativo = false`); exclusão física apenas sem uso.
- **Mensagem ao usuário:** orientar a inativar em vez de excluir.

### RN-004 — Exclusão de item na folha do funcionário

- É permitido **excluir** `folha_item` (remover o evento da capa), desde que o **lote** da competência esteja **aberto** (RN-006) e a **capa não esteja congelada** (RN-012).

### RN-016 — Exclusão da folha capa (funcionário na competência)

- É permitido **excluir** a **`folha_capa`** inteira (e todos os **`folha_item`** vinculados) somente com o **lote aberto** (RN-006) e a capa **não congelada** (RN-012).
- Endpoint canônico: **`DELETE …/folha/capas/:id`** (query **`unidade`** obrigatória). Permissão: **`folha-lancamento:delete-capa`**. Capa congelada retorna erro orientando a **Liberar** antes.
- **UI (Lançamento de folha):** botão **Excluir** (vermelho), **acima** de **Recibo**, visível com capa expandida, lote **aberto**, capa **não congelada** e permissão; confirmação em modal antes de chamar a API.

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
- Enquanto a capa estiver **congelada** e desde que o lote permaneça **aberto** na API (RN-006), **não** é permitido incluir, alterar ou excluir **`folha_item`** dessa capa nem excluir a **`folha_capa`** (RN-016). O cadastro do funcionário (`PATCH …/folha/funcionarios/:id`) **pode** ser alterado independentemente de capas congeladas.
- **Congelar** exige permissão **`folha-lancamento:congelar-capa`**; **liberar** exige **`folha-lancamento:liberar-capa`**. Endpoints canônicos: **`POST …/folha/capas/:id/congelar`** e **`POST …/folha/capas/:id/liberar`** (query **`unidade`** obrigatória, alinhada às demais rotas de capa).
- Com lote **fechado**, permanece vedada qualquer alteração de lançamentos (RN-006); **congelar/liberar** também exige lote **aberto** na API.
- **UI (Lançamento de folha):** exibe o estado congelado, botão **Congelar** ou **Liberar** conforme permissões e desabilita inclusão/edição/exclusão de eventos e o botão **Excluir** (capa) na capa congelada.

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
- **`GET …/folha/funcionarios` (lista paginada):** query **`unidade`** opcional — omitir lista **todas** as unidades do escopo (RN-007); com **`todos=true`** retorna lista completa (impressão); **`comEventosFixos=true`** inclui eventos fixos.
- **`POST …/folha/capas`:** aceita **`funcionarioId`**; a unidade do body deve **coincidir** com `funcionarios.unidade` desse funcionário (e com o escopo do usuário).
- Permissões do épico (atribuir via perfil): `folha-funcionario:create|read|update|delete`; `folha-cargo:create|read|update|delete|audit`; `folha-setor:create|read|update|delete|audit`; `folha-verba:create|read|update|delete|audit`; `folha-tipo:create|read|update|delete`; `folha-lancamento:create|read|update|delete|delete-capa|congelar-capa|liberar-capa`; `folha-fechamento:read`; `folha-fechamento:registrar-abertura`; `folha-fechamento:fechar`; `folha-fechamento:reabrir`. Leituras auxiliares (ex.: listar tipos/verbas/cargos/setores/lista para lançamento) combinam permissões definidas na API.

### RN-008 — Usuário com múltiplos perfis

- Cada usuário pode ter **um ou mais perfis** (`usuarios_perfis`); cadastro/edição exige **`perfilIds`** com ao menos um UUID válido.
- **Permissões efetivas** = **união** das permissões de todos os perfis vinculados (OR). Se **qualquer** perfil tiver `admin:full`, o usuário tem escopo administrativo global nas checagens da API.
- **`usuario.unidade`** e **`vendedor`** continuam no cadastro do usuário (não vêm do perfil).
- **API:** create/update de usuário usam `perfilIds[]`; login e `/auth/profile` retornam `perfis` e `permissions` (lista unificada).
- **Mensagem ao usuário:** «Um ou mais perfis informados não foram encontrados»; «perfilIds deve ter ao menos um perfil».

### RN-014 — Atalhos da tela inicial (home)

- Preferência persistida em **`usuarios.atalhos_home`** (JSON array de IDs), até **8** itens, ordem definida pelo usuário.
- IDs válidos são os do catálogo do sistema (ex.: `vendas`, `folha-lancamentos`); a API descarta IDs desconhecidos ou duplicados.
- **Novos menus:** ao adicionar atalho no frontend (`home-shortcuts.registry.ts`), incluir o **mesmo id** em `backend/src/common/constants/home-shortcut-ids.ts` — ver checklist em `docs/GUIA_OPERACAO_AGENTE.md`.
- **`null`** no banco = usuário ainda não personalizou → frontend usa atalhos **padrão** filtrados por permissão.
- **`PATCH /users/:id/atalhos-home`:** apenas o **próprio usuário** pode alterar seus atalhos (JWT).
- Na exibição, só aparecem atalhos para rotas que o usuário **pode acessar** (união de permissões dos perfis, RN-008).
- Login/refresh retornam `atalhosHome` no objeto do usuário.

### RN-015 — Envio de recibo de pagamento por WhatsApp (folha)

> Especificação completa: **`docs/WHATSAPP_RECIBO_FOLHA.md`**.

- Envio permitido **somente** com **lote fechado** para a competência (unidade + ano + mês + tipo de folha) — alinhado à **RN-006**.
- **Individual:** uma `folha_capa` (tela Lançamento de folha); **em massa:** todas as capas da linha em Controle (unidade + competência + tipo), lote **FECHADA**.
- Mensagem: **um template utilitário** com cabeçalho **Imagem** (PNG do recibo) e corpo com nome, saudação e contato de dúvidas (4 variáveis).
- Exige `funcionario.telefone` normalizado (E.164). Cadastro: **`naoReceberReciboWhatsapp`** (padrão `false`); quando `true`, **individual** e **em massa** não enviam (LGPD/opt-out).
- Permissões: **`folha-lancamento:enviar-recibo-whatsapp`** (botão **Enviar recibo** no Lançamento, individual); **`folha-fechamento:enviar-recibos-whatsapp`** (botão **Enviar recibos** no Controle, em massa).
- Cada tentativa gera **auditoria** (usuário, capa, sucesso/erro, telefone mascarado, **wamid** quando enviado).
- Registro correlacionado em **`whatsapp_mensagem`** (outbound template) para thread de atendimento.

### RN-016 — Atendimento WhatsApp (webhook + inbox)

> Especificação completa: **`docs/WHATSAPP_WEBHOOK.md`**.

- **Canal:** respostas ao **número da API** (Cloud API); webhook Meta (`GET`/`POST` `/api/whatsapp/webhook`).
- **Autenticação webhook:** verify token (GET) + assinatura HMAC `X-Hub-Signature-256` (POST); sem JWT.
- **Persistência:** conversas (`whatsapp_conversa`) e mensagens (`whatsapp_mensagem`); idempotência por **wamid** único.
- **Identificação:** match `from` ↔ `funcionario.telefone` (E.164); sem match ⇒ **não identificado**.
- **Escopo inbox (RN-007):** usuário com unidade vê conversas **identificadas** da unidade + **todas não identificadas** (fila global); sem unidade ou `admin:full` vê todas.
- **Permissões:** `folha-whatsapp:read` (inbox/thread/marcar lida/baixar mídia); `folha-whatsapp:reply` (enviar texto e anexos); `reply` exige `read`.
- **Resposta manual:** somente na **janela 24h** após última mensagem **inbound** do funcionário; backend e UI bloqueiam fora da janela.
- **Mídia (janela 24h):** envio e recebimento de **imagem** (JPEG/PNG), **áudio** (gravação no navegador, conversão automática no servidor) e **documento** (PDF, DOCX, XLSX); limite **16 MB** por arquivo; binário em **`whatsapp_mensagem.arquivoConteudo`** (bytea) com retenção configurável (`WHATSAPP_MEDIA_RETENCAO_DIAS`, padrão 30 dias) e purge diário; metadados da mensagem permanecem após expiração.
- **MVP:** sem auto-resposta, sem template lembrete, sem IA.
- **Envio recibo (RN-015):** grava **wamid** na auditoria e mensagem outbound para correlacionar status (`delivered`/`read`/`failed`).

### RN-ORC-001 — Orçamentos (listagem)

- Tela **`/orcamentos`** lista orçamentos **aprovados** e/ou **rejeitados**, conforme permissões e filtro de tipo.
- Rota legada **`/orcamentos/rejeitados`** redireciona para **`/orcamentos`**.
- API: **`GET /orcamentos`** com `status=APROVADO|REJEITADO|TODOS` (padrão conforme permissões do usuário).
- Escopo por unidade conforme **RN-007** (`usuario.unidade`; admin global vê todas; filtro de unidade na query respeita o escopo).
- Com unidade vinculada, o filtro é aplicado automaticamente, o campo fica desabilitado e a unidade aparece nos chips de filtros aplicados (como na lista de vendas).
- **Filtro padrão de data** ao abrir a tela: **segunda-feira** → orçamentos com `dataOrcamento` **maior que** D-2; **demais dias** → **maior que** D-1 (data local do navegador).
- Usuário com **ambas** permissões de leitura vê abas/filtro **Todos | Aprovados | Rejeitados**; com apenas uma, o tipo fica fixo.
- Permissões de leitura: **`orcamento-rejeitado:read`** (rejeitados) e **`orcamento-aprovado:read`** (aprovados).
- Coluna **Valor** e totais monetários na listagem/relatório exigem **`orcamento:view-valores`**.
- Impressão exige **`orcamento:print`**.

### RN-ORC-002 — Registro de motivo em rejeitados

- Orçamento rejeitado pode receber **um motivo** (`motivoRejeicaoId`, FK para cadastro global) e **observação** opcional (`observacaoRejeicao`, texto).
- Registro em lote via **`PATCH /orcamentos/rejeitados/em-massa`** com `{ ids[], motivoRejeicaoId, observacaoRejeicao? }`.
- Motivo deve estar **ativo** no cadastro; motivo é **obrigatório** no registro.
- Permissão: **`orcamento-rejeitado:update`**.
- UI destaca linhas **sem motivo** vs **com motivo** (cores distintas em tema claro e escuro) — apenas na visualização de rejeitados.

### RN-ORC-003 — Motivos de rejeição (cadastro global)

- CRUD em **`/orcamentos/motivos-rejeicao`**; campos: `descricao`, `ativo` (padrão `true`).
- Motivos são **globais** (não por unidade).
- Exclusão bloqueada se o motivo já estiver vinculado a orçamentos — usar inativação.
- Permissões: **`orcamento-motivo:create|read|update|delete`**.

### RN-ORC-004 — Sincronização e motivo de rejeição

- Na sincronização incremental de orçamentos (`processarOrcamento`), o upsert **preserva** `motivoRejeicaoId` e `observacaoRejeicao` enquanto o registro permanece **REJEITADO** (ou muda de APROVADO para REJEITADO).
- Se o status mudar de **REJEITADO** para **APROVADO**, `motivoRejeicaoId` e `observacaoRejeicao` são **limpos** (`null`).

### RN-ORC-005 — Atualização manual de orçamentos (listagem)

- Botão **Atualizar orçamentos** na listagem de orçamentos dispara **`POST /sincronizacao/orcamentos`** (somente orçamentos, não clientes/prescritores).
- Permissão: **`orcamento-rejeitado:sync`**.
- Usuário **com unidade** no cadastro: sincroniza apenas o agente mapeado à unidade, usando `ultimaModificacaoOrcamento` da configuração correspondente.
- Usuário **sem unidade**: sincroniza **todas** as configurações ativas com watermark de orçamentos configurado.
- Enquanto houver sync em andamento (`isRunning`), novas requisições retornam **409**; a UI exibe progresso via **`GET /sincronizacao/progresso`**.
- Ao concluir, o watermark `ultimaModificacaoOrcamento` é atualizado na configuração de sincronização.

### RN-ORC-007 — Importação manual de orçamentos por período (Configuração)

- Endpoint: **`POST /sincronizacao/orcamentos/importar`** com `unidade`, `dataInicio`, `dataFim`.
- Agente: **`POST /api/v1/orcamentos/periodo`** filtrando `dtentr` (data do orçamento) no intervalo.
- Upsert idempotente via `processarOrcamento`; **não** altera `ultimaModificacaoOrcamento`.
- Disparo pela aba **Configuração → Importação** (modal *Buscar orçamentos por período*).
- Permissão: **`configuracao:access`**.

---

### RN-ORC-006 — Painel de indicadores (dashboard)

- Tela **`/orcamentos/dashboard`** consolida KPIs e gráficos analíticos sobre **todos** os orçamentos (`APROVADO` e `REJEITADO`), respeitando filtros globais.
- Permissão exclusiva: **`orcamento-dashboard:read`** (independente de `orcamento-rejeitado:read`).
- Visualização de valores monetários no painel exige a permissão **`orcamento-dashboard:view-valores`**.
- Sem a permissão de valores, o painel deve exibir apenas **quantidades** e **percentuais**, ocultando campos monetários.
- Escopo por unidade conforme **RN-007** (usuário com unidade vê apenas a própria; admin global vê todas).
- Métrica monetária: **`precoVenda`**. Eixo temporal: **`dataOrcamento`** (`YYYY-MM-DD`).
- Agrupamento de vendedor e médico: **por nome** (`nomeVendedor`, `nomeMedico`).
- Rejeitados sem `motivoRejeicaoId` classificam-se como **`Sem motivo`** na análise de perdas (Pareto).
- Endpoint consolidado: **`GET /orcamentos/dashboard/indicadores`**; opções de filtro: **`GET /orcamentos/dashboard/opcoes-filtro`**.

### RN-VND-001 — Fechamento vs status da venda

- **`dataFechamento`** registra o **pagamento do fechamento** (lado compra/origem: `valorCompra`, `valorPago`). Não altera o `status` da venda.
- **`status`** (`REGISTRADO`, `PAGO_PARCIAL`, `PAGO`) reflete o **pagamento recebido do cliente**, calculado pelas **baixas**.
- Fechar venda: **`POST …/vendas/fechamento-massa`** (perm. **`venda:fechar`**). Cancelar fechamento: **`POST …/vendas/cancelamento-massa`** (perm. **`venda:cancelar-fechamento`**).

### RN-VND-002 — Edição de venda com fechamento registrado

- Com **`dataFechamento`** preenchido, **`PATCH …/vendas/:id`** aceita **somente** o campo **`observacao`**.
- Demais campos (protocolo, cliente, valores, status, `dataFechamento`, etc.) retornam **400** com mensagem funcional informando a data do fechamento.
- A UI (`venda-modal`) exibe aviso, desabilita os demais campos e envia apenas `observacao`.
- **Cancelar fechamento** restaura a edição completa da venda.

### RN-VND-003 — Baixas em venda fechada

- **Baixa individual** (criar, editar, excluir): mantém as validações atuais; **não** bloqueia por `dataFechamento`.
- Após baixa individual, o **status** da venda é recalculado pelas baixas (`updateVendaStatusBasedOnBaixas`), **sem** passar pelo `PATCH` restrito da RN-VND-002.
- **Baixa em massa** (`processarBaixasEmMassa`): continua **bloqueada** para vendas com fechamento registrado.
- **Atualizar valor compra em massa**: continua **bloqueada** para vendas com fechamento registrado.

### RN-VND-004 — Data da baixa (fechamento de caixa + última baixa)

- Criar, editar ou excluir baixa exige **`dataBaixa` válida** conforme **duas regras cumulativas** (implantação gradual do fechamento de caixa por unidade):
  1. **Fechamento de caixa:** se a unidade possui fechamento confirmado (`status = CONFIRMADO`), a data deve ser **posterior** à data do último fechamento. Se não houver fechamento confirmado, esta regra não bloqueia.
  2. **Última baixa da unidade:** se já existem baixas na unidade, a data deve ser **>=** à data da última baixa registrada. Se não houver baixas na unidade, esta regra não bloqueia.
- Validação aplicada em: `POST /baixas`, `PATCH /baixas/:id`, `DELETE /baixas/:id` e `POST /baixas/processar-em-massa`.
- Em violação da regra 1: **409** com mensagem informando a data do último fechamento da unidade.
- Em violação da regra 2: **409** com mensagem informando a data da última baixa e link para a listagem de baixas do dia.

---

## Painel médicos × representantes

### RN-REP-001 — Importação do painel médicos × representantes

- Origem: Firebird **FC04200** + **FC04000** + **FC08000** via agente (`GET /api/v1/painel/medicos-representantes`).
- Escopo por agente/unidade: filtro `cdcon` + lista `cdfun` em `sincronizacao_config.painelContratoRepresentantes` (persistido como `9999 1,2`; na UI de configuração, campos separados **Filial do Painel** e **Representantes do Painel (ex 1,2)**).
- Sem filial no ERP: a unidade (**INHUMAS**, **UBERABA**, **NERÓPOLIS**) é gravada no PostgreSQL conforme mapeamento do agente.
- Chave de identificação: `unidade + crm_medico + uf_crm_medico + contrato_representante + codigo_representante`.
- A cada sincronização geral: criar, atualizar e **remover** registros do escopo configurado que não constarem na lista retornada pelo ERP (conforme **RN-REP-002**).
- Sem watermark de data; a configuração de contrato/representantes substitui o filtro temporal.
- Integrada à sync geral (`POST /sincronizacao/executar`), após orçamentos, quando `painelContratoRepresentantes` estiver preenchido.
- Encoding: `padronizarNomeDeSistemaLegado()` / `normalizarTextoLegado()` em campos de texto legados.

### RN-REP-002 — Histórico do painel médicos × representantes

- Toda remoção do painel ativo gera registro em `painel_medicos_representantes_historico` com snapshot completo.
- Motivo **`NAO_CONSTA_ERP`**: médico deixou de constar na carteira do ERP durante sincronização.
- Motivo **`CONFIG_ALTERADA`**: representante ou contrato removido/alterado em `painelContratoRepresentantes` (ao salvar config).
- Campo `configNoMomento` registra a config vigente na hora da exclusão.
- Histórico é append-only (sem update/delete).
- Histórico não é reimportado automaticamente para o painel ativo.

---

## Etapas de produção (SLA resumo)

### RN-PCP-001 — Importação de etapas de produção (SLA resumo)

- Origem: SQL validado `producao_etapas_sla_resumo.sql` via agente (`POST /api/v1/producao/etapas-resumo`).
- Persistência: tabela `producao_etapas_resumo`; chave upsert: `unidade + filial + requisicao + formula + cod_etapa`.
- Filtro de movimentos: data do evento PCP (`p.data` na FC12500), não `dtentr` (data de retirada é apenas informativa).
- **Importação manual:** `POST /sincronizacao/producao-etapas/importar` com `unidade`, `dataInicio`, `dataFim`; upsert idempotente; **não** altera `ultimaModificacaoProducaoEtapas`. Disparo pela aba **Configuração → Importação** (modal *Buscar etapas por período*).
- **Importação automática:** integrada à sync geral quando `ultimaModificacaoProducaoEtapas` estiver configurada; filtra movimentos posteriores ao watermark; ao concluir, atualiza watermark com hora do processamento (America/Sao_Paulo), alinhado ao padrão de orçamentos.
- Registros sem entrada na etapa são excluídos pelo SQL (inner join em `evt_ent`); etapas só com saída não são importadas.
- **Funcionário entrada/saída:** código e nome vêm sempre do **mesmo movimento** na `FC12500`. Entrada (`cdopera = 01`): **primeiro** lançamento cronológico (data/hora). Saída (`cdopera = 02`): **último** lançamento cronológico. Evita misturar `MIN(cdfun)` com `MIN(nomefun)` quando há lançamentos duplicados ou errados no PCP.
- Campo `etapa` (nome da etapa, `FC12540.descricao`): padronizado em **maiúsculas pt-BR** na importação (ex.: `ENCAPSULAÇÃO`, `SACHÊ INHUMAS`, `ROTULAÇÃO`).
- Campo `principios_ativos`: texto livre (`TEXT`), lista separada por vírgula.
- Campo `tempo_etapa`: minutos (inteiro) entre entrada (primeiro 01) e saída (último 02); `NULL` quando saída incompleta.
- Campos do prescritor na requisição (`fc12100` + `fc04000`): `nomePrescritor`, `crf`, `ufCrf`; com **fallback** na mesma `nrrqu` quando a fórmula atual não tiver CRM (prioriza série `0`).
- Campo `codigoCliente` / `cliente`: `req.cdcli` + `FC07000`; com **fallback** do `CDCLI` de outra fórmula da mesma requisição. Nome do cliente: prioriza `FC07000` da **mesma filial** da requisição; se ausente, usa cadastro do mesmo `CDCLI` em **outra filial**.
- Escopo inicial: importação e persistência; painéis/relatórios são demandas posteriores.
- Permissão importação manual: **`configuracao:access`**.

---

## Caixa ERP (Firebird → PostgreSQL)

### RN-CXA-001 — Separação caixa ERP vs vendas de terceiro

- **Caixa local ERP** persiste em `caixa_pagamentos_erp`, `caixa_itens_erp` e `caixa_requisicoes_pagas` — **não** na tabela `baixas`.
- **Vendas de terceiro** continuam em `vendas` + `baixas` (cadastro manual); fluxo de fechamento interunidades (RN-VND-001) **não** é alterado por import ERP.

### RN-CXA-002 — Import manual via agente (sem job automático)

- Disparo **somente** por ação explícita: `POST …/fechamento/importar-caixa-erp` (perm. **`venda:fechar-caixa`**).
- Backend consulta o agente (`POST /api/v1/caixa/*`); **não** há sincronização agendada de caixa ERP.
- **Não** usar FC31000 como gate ou condição de import.

### RN-CXA-006 — Escopo da busca de caixa ERP

- **Fechamento de Caixa (Atualizar Vendas):** importa **apenas o dia** selecionado na tela (`dataInicio` = `dataFim` = data do caixa), usando a unidade já informada. Não abre modal; exibe mensagem de sucesso ou erro na própria tela, sem resumo/preview da importação.
- **Configuração → Importação (Buscar caixa ERP por período):** abre modal com **intervalo de datas** (início e fim) e unidade; ao concluir, exibe resumo da importação no modal. Permite reimportar períodos **anteriores** ao último fechamento confirmado (`reimportacaoHistorica: true`; exige **`configuracao:access`**).
- **Configuração → Importação (Buscar etapas por período):** abre modal com unidade e intervalo de datas (mesmo padrão do caixa ERP); ao concluir, exibe resumo da importação no modal.
- Usuário **com** unidade no cadastro: importação **somente** na própria unidade (campo bloqueado na UI e validado na API).
- Usuário **sem** unidade no cadastro: pode escolher qualquer unidade na UI (acesso global conforme permissões).
- Exige **`venda:fechar-caixa`**.

### RN-CXA-003 — Upsert idempotente por `chave_erp`

- Pagamentos: `{unidade}-{codigo_terminal}-{data_operacao}-{id_operacao}-{numero_cupom}-{codigo_erp_fmpag}` (código FMPAG só na chave, não persistido).
- Itens: `{unidade}-{codigo_terminal}-{data_operacao}-{id_operacao}-{numero_cupom}-{sequencia_item}`.
- Requisições pagas: `{unidade}-{numero_requisicao}-{numero_cupom}-{data_pagamento}`.
- Reimportar o mesmo dia **sempre atualiza** registros existentes (upsert por `chave_erp`); não duplica linhas.
- **`caixa_requisicoes_pagas`:** orçamento (`NRORC`), qtd/valor de fórmulas e prescritor usam **fallback agregado** em `FC12100` por requisição (prioriza série `0`, depois outras fórmulas e requisição-fonte `NRRQUFON`). Considera apenas `NRORC > 0`. **Não altera** `valor_pago_requisicao` nem totais de `caixa_pagamentos_erp`.

### RN-CXA-004 — Valor líquido e formas de pagamento (ERP)

- Valor líquido: `vrpag - COALESCE(vrtrc, 0)` (dinheiro e convênio-dinheiro).
- Mapeamento FMPAG: `1` → DINHEIRO; `1` + `INDRECCONV = S` → CONVENIO-DINHEIRO (linha no bloco **DINHEIRO**, somada ao total de dinheiro); `4` → DEPOSITO; `6` → CARTAO PRE.
- Totais ERP do dia: agregação sobre `caixa_pagamentos_erp` filtrada por `unidade` e `data_operacao`.

### RN-CXA-005 — Fechamento consolidado

- Tela **Fechamento de Caixa** (`/relatorios/fechamento-caixa`): consolida ERP + baixas terceiro por `(unidade, data)`.
- Bloco **DINHEIRO**: saldo inicial + linhas ERP `DINHEIRO` e `CONVENIO-DINHEIRO` + terceiro por origem + despesas + retirada; total do bloco inclui `CONVENIO-DINHEIRO`.
- Cards exibidos: **DINHEIRO**, **CARTÃO/PIX**, **DEPOSITO** e **Observação** (sem card Convênio ou Outros).
- Permissões: **`venda:fechar-caixa`** (acessar a tela/rota, consultar consolidado/detalhado, importar ERP, salvar rascunho e confirmar) e **`venda:reabrir-caixa`** (reabrir último confirmado). Acesso direto por URL sem a permissão deve ser bloqueado no frontend (`permissionGuard`) e na API (`@Permissions`).
- Persistência: `caixa_fechamento` + `caixa_fechamento_linha`; despesas, retirada e **observação** manual (opcional, por unidade e data, até 2000 caracteres).
- Saldo inicial: config por unidade (**valor + data de referência**) ou `saldo_final` do fechamento anterior confirmado. O saldo configurado só se aplica a fechamentos com `data >= dataSaldo`; sem fechamento anterior e sem data configurada, usa-se o valor legado (quando `dataSaldo` nulo). Em caixa **aberto** (rascunho), o saldo inicial é **recalculado** a cada consulta a partir do último fechamento confirmado; em caixa **fechado**, permanece o valor gravado na confirmação.

### RN-CXA-007 — Terceiro no consolidado

- Baixas: `v.unidade = unidade do fechamento`; quebra por `v.origem` (Comprado em) e `tipoDaBaixa`.
- Tipos de baixa permitidos: **DINHEIRO**, **CARTÃO/PIX** e **DEPOSITO** (sem Outros).
- Terceiro **não** possui forma CONVÊNIO; `CONVENIO-DINHEIRO` (ERP) compõe o bloco Dinheiro.

### RN-CXA-008 — Último registro editável

- **Fechamento de Caixa:** import ERP do dia, despesas, retirada e observação somente se `data >=` último fechamento confirmado da unidade.
- **Configuração → Buscar caixa ERP por período:** importação histórica permitida (upsert), sem bloqueio por último fechamento confirmado.
- Reabrir: somente o último caixa fechado da unidade (`MAX(data)` entre fechamentos confirmados).
- Caixas com data **anterior** ao último fechamento da unidade **não podem ser reabertos**.

### RN-CXA-009 — Status de exibição do caixa

- **Fechado (`FECHADO`)**: caixa confirmado pelo sistema (`status = CONFIRMADO`). Permite emissão dos relatórios **Caixa** e **Caixa Detalhado**.
- **Bloqueado (`BLOQUEADO`)**: data anterior ao último fechamento da unidade e **não** confirmada pelo sistema. Não permite editar, fechar nem reabrir; **permite** emitir relatórios **Caixa** e **Caixa Detalhado**.
- **Aberto (`RASCUNHO`)**: período em aberto (`data >=` último fechamento) ainda não confirmado. Exibido na UI como **Aberto**. Permite editar, fechar e emitir relatórios **Caixa** e **Caixa Detalhado**.
- No relatório **Caixa** (resumido), o status é exibido acima do título com as cores de badge da tela (Fechado/Aberto/Bloqueado); a **observação** (quando houver) aparece em card ao lado dos blocos Dinheiro/Cartão/Depósito.

---

## Demais módulos

Orientação para o time:

1. Documente cada regra com: **identificador (RN-*)**, **módulo**, **descrição**, **critérios de aceite**, **mensagens ao usuário** (erro/sucesso quando aplicável).
2. Ao alterar comportamento funcional na aplicação, **atualize ou crie** a RN-* correspondente antes de dar a tarefa como concluída.
3. Em caso de divergência entre este documento e o código, trate como **dívida**: sinalize no PR e alinhe doc ou implementação.
