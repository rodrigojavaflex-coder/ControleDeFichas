# Prompt épico — Módulo de folha simplificada (NEST_ANGULAR)

Prompt pronto para colar no Cursor Agent, alinhado a `docs/GUIA_OPERACAO_AGENTE.md` e ao que foi definido nas discussões do módulo de folha.

---

## Contexto

Implementar módulo base de folha simplificada no NEST_ANGULAR (Nest + Angular): cadastro de funcionários com vínculo em uma ou mais unidades (mesma pessoa pode receber em unidades diferentes), cadastro parametrizável de tipos de folha, cadastro de verbas (receita/despesa), lançamentos por competência em **duas tabelas** (`folha_capa` + `folha_item`) e **fechamento** de edição agrupando **ano**, **mês**, **tipo de folha** e **unidade**. Não há vínculo obrigatório entre funcionário e usuário do sistema. Não há tela nem API de contra‑cheque para o colaborador neste épico.

## Objetivo

Entregar:

- **Backend**: entities TypeORM, **migrations reversíveis** (`up`/`down`), DTOs com **class-validator**, Swagger, fluxo Controller → Service → Repository, filtros por **unidade no service** (não apenas na UI) e uso de **`numeric(12,2)`** para valores monetários.

- **Frontend**: telas alinhadas ao padrão visual do projeto (**tema claro e escuro**, estados vazio/carregamento/erro/sucesso, hover/focus/disabled), com fluxo de edição **primeiro capa, depois itens**.

- **Documentação funcional mínima**: atualizar **`docs/regras-negocio.md`** com RN-* pertinentes.

## Modelo de dados e constraints

1. **`funcionario`**: dados de RH (incl. **data demissão** quando houver); **sem** obrigatoriedade de FK para usuário/login.

2. **`funcionario_unidade`**: N:N funcionário × unidade; **UNIQUE** `(funcionario_id, unidade_id)`; regras de “ativo”, admissão no vínculo, etc., conforme necessidade mínima do MVP.

3. **`folha_verba`**: cadastro de eventos com `descricao`, tipo **Receita** | **Despesa** (enum conforme projeto), flag `ativo` se fizer sentido; auditoria conforme política já usada nas entidades.

4. **`folha_tipo`**: cadastro de tipo de folha (não usar enum de domínio PostgreSQL para os tipos); seed inicial sugerido: mensal/normal, férias, 13º, rescisão (ajustar rótulos ao negócio); `ativo`.

5. **`folha_capa`**: uma linha por **funcionario + unidade + ano + mes + tipo de folha**; FK que garanta vínculo válido em **`funcionario_unidade`** (recomendado: FK para PK de `funcionario_unidade`); campos **`ano` (integer)**, **`mes` (integer 1–12)**; **UNIQUE** `(funcionario_id, unidade_id, ano, mes, folha_tipo_id)` (nome físico/snake_case conforme migrations).

6. **`folha_item`**: `folha_capa_id`, `folha_verba_id`, `valor` (**numeric 12,2**); **UNIQUE** `(folha_capa_id, folha_verba_id)` — **não** permitir dois lançamentos da mesma verba na mesma capa.

7. **Controle de fechamento**: registro/status por **`(ano, mes, folha_tipo_id, unidade_id)`** que, quando fechado, **bloqueia** criação/edição/remoção de **`folha_capa`** e **`folha_item`** daquele lote (detalhes de corrida/transação ficam para refinamento posterior; MVP com validação antes de gravar já é aceito).

### Regras explícitas de exclusão e uso da verba

- **Cadastro `folha_verba`**: **proibir DELETE** quando existir qualquer uso histórico (qualquer **`folha_item`** ou outra referência acordada) — responder **409/422** com mensagem funcional clara ou usar constraint + tratamento uniforme ao padrão do projeto.

- **Na folha do funcionário**: **permitir DELETE** de **`folha_item`** individual (remover o evento daquela capa), respeitando bloqueio de **lote fechado**.

- Preferir **`folha_verba` inativável (`ativo=false`)** no dia a dia; **DELETE físico** só quando **nunca** foi referenciado.

### Regra de demissão (novos lançamentos)

- Um funcionário (ou vínculo) **demitido** **não** pode entrar nem ser gravado em **nova** **`folha_capa`** cuja competência (`ano`, `mes`) seja **posterior** ao mês/ano definido a partir da **data demissão** (definir regra exata nos RN-*: exemplo “bloqueio se `(ano×12+mes)` > período da demissão”). **Consulta** de folhas/competências antigas já existentes deve permanecer para histórico; listagem para **novos** lançamentos não deve incluir esse caso.

### Índices

- Criar **índice** nos filtros típicos (ex.: `folha_capa` por `(unidade_id, ano, mes, folha_tipo_id)` e FKs utilizadas em joins/report futuros).

## Permissões

- Todo endpoint que liste ou altere dados de folha deve **filtrar por `unidade` no service**, coerente com as unidades autorizadas ao usuário/perfil (seguir padrão atual do projeto com `Unidade`).
- Cobrir com **guard** e, quando aplicável, testes automatizados mínimos de autorização ou documentação para testes manuais no critério de aceite.

## Usabilidade — edição da folha (capa + itens)

Fluxo obrigatório na UI/admin:

1. Selecionar **unidade**, **ano**, **mês**, **tipo de folha** e **funcionário** (vínculos daquela unidade).

2. **Criar ou carregar `folha_capa`** antes de liberar edição pesada (“salvar/obter capa” como passo explícito).

3. Na sequência: **lista de `folha_item`** com adicionar verba + valor numérico, totais derivados (**receitas / despesas / líquido**) no painel usando tokens de tema para tags de tipo **sem regressão**.

4. Estado do **lote** (aberto/fechado) visível ao editar (badge/desabilitação); tentativas ilegais espelhar mensagens da API.

5. Acessibilidade: labels claros e foco visível.

**Telas obrigatórias do épico**: **funcionários** (com vínculo unidade), **verbas**, **tipo de folha**, **edição de folha** (fluxo acima), **fechamento** por ano/mês/tipo/unidade.

## Escopo permitido

- Backend: novo módulo (nome a definir) sob `backend/src/modules/`.
- Frontend: páginas, services e models sob `frontend/`, respeitando Standalone/`inject`/Signals conforme padronização atual do projeto.
- Migrations em `backend/src/migrations`.
- `docs/regras-negocio.md`: RN-* (unicidade da capa, unicidade verba×capa, fechamento, demissão, exclusão da verba no cadastro vs exclusão do item).

## Fora de escopo

- Contra-cheque / portal do colaborador.
- Cálculos legais completos, importação em massa, PDF.
- Refinamento avançado de concorrência no fechamento (fase 2 se necessário).

## Critérios de aceite verificáveis

1. Schema com tabelas e constraints descritas; **`numeric(12,2)`** nos valores; **ano** e **mês** inteiros na capa.

2. **DELETE** de `folha_verba` **bloqueado** quando houver uso; **DELETE** de `folha_item` permitido só com **lote aberto** e demais RN.

3. Com lote **fechado**, create/update/delete de capa/item daquele `(ano, mês, tipo, unidade)` retorna erro controlado **4xx** e UI em somente leitura.

4. Duas **`folha_capa`** para o mesmo `funcionario` no mesmo ano/mês/tipo com **unidades diferentes** funcionam; **uma verba repetida na mesma capa** falha pela constraint/unique.

5. APIs documentadas no Swagger com DTOs validados; consumo no Angular atualizado sem quebra de contrato onde reutilizado.

6. **Tema claro/escuro** validado nas telas novas sem cores hardcoded indevidas.

7. Lista de RN-* atualizada em **`docs/regras-negocio.md`** com texto objetivo das regras acima.

## Validação esperada

- Migrations sobem/descem em ambiente de dev conforme projeto.
- `lint`/build backend e frontend.

**Testes manuais sugeridos**: criar funcionário em duas unidades → duas capas mesmo mês/tipo em unidades diferentes; adicionar itens; tentar segunda linha igual verba (deve falhar); criar uso de verba e tentar excluir cadastro da verba (deve falhar); fechar e tentar alterar item (deve falhar); cenário demissão + competência posterior bloqueada.

## Saída esperada da IA (ao concluir implementação)

- Quais **RN-*** foram aplicadas e onde em `docs/regras-negocio.md`.
- **Endpoints/DTOs/migrations** criados ou alterados; impactos de contrato no frontend.
- **Validações** realizadas ou recomendadas; **risco visual/regressão** e checagem de tema.

---

## Template rápido (uso diário — Guia)

```md
Contexto:
<alinhar ao bloco Contexto deste arquivo>

Objetivo:
<trecho objetivo específico desta sprint, se menor que épico inteiro>

Escopo:
<caminhos backend/frontend tocados nesta sprint>

Fora de escopo:
<explícito>

Critérios de aceite:
1) ...
2) ...

Validação esperada:
<lint/build/testes manuais>
```
