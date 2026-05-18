# Prompt para adaptacao das regras Cursor (NEST_ANGULAR)

**Estado:** a adaptacao inicial (globs NEST_ANGULAR, sem `mobile/`, `docs/regras-negocio.md`, guia e complemento no `.cursorrules`) ja foi aplicada. Os `.mdc` incluem tambem `agent/src/**`, raiz `frontend/src/app/*.ts`, `guards/**`, `backend/src/main.ts`, `app.module.ts` e `frontend/src/styles.css` — alinhe estes paths se a arvore do repo mudar.

Copie todo o bloco abaixo e cole num **chat novo no Cursor** apenas se precisar **repetir ou revisar** a adaptacao, com este repositorio **NEST_ANGULAR** aberto como projeto.

---

## Copiar a partir da linha seguinte

```md
Voce esta no repositorio NEST_ANGULAR (NestJS + Angular). Foram copiadas do projeto OMNI as regras em:

- `.cursor/rules/regras-ui.mdc`
- `.cursor/rules/regras-negocio.mdc`
- `.cursor/rules/regras-api-dados.mdc`
- `docs/GUIA_OPERACAO_AGENTE.md`

O projeto ja possui um `.cursorrules` extenso; NAO sobrescreva esse arquivo inteiro por um modelo de outro projeto. Preserve o conteudo especifico de NEST_ANGULAR (encoding, datas, migrações, Firebird/sync, etc.).

Tarefas:

1) **Frontmatter `globs` nos tres `.mdc`**
   - Varra `frontend/src/app/` (pastas components, modules, services, models) e `backend/src/modules/`.
   - Substitua os padroes de glob que referem dominios OMNI (vistoria, ocorrencia, irregularidade, mobile, empresa-terceira, veiculo, motorista…) por globs que **realmente correspondam** a esta arvore:
     - Exemplos de modulos Nest atuais: auditoria, auth, baixas, certificado, clientes, configuracao, ficha-tecnica, laudo, migracao, perfil, prescritores, sincronizacao, usuarios, vendas, vendedores.
     - Exemplos de areas frontend (ajuste conforme a pasta real): clientes, baixas, certificado, laudo, configuracao, prescritores, sincronizacao, vendas, vendedores, auth, auditoria…
   - Se **nao existir** pasta `mobile/`, **remova** todas as linhas de glob que apontam para `mobile/…`.
   - Manter `docs/regras-negocio.md` e `.cursorrules` nos globs onde fizer sentido.
   - Evite listar dezenas de arquivos inexistentes: use padroes por pasta (ex.: `frontend/src/app/components/**/clientes*/**/*.{html,scss,ts}`) alinhados ao que existe.

2) **`docs/regras-negocio.md`**
   - Se o arquivo **nao existir**, crie um esqueleto minimo: titulo, como citar RN-*, e uma secao "A preencher" orientando o time a documentar regras.
   - Se **ja existir** com outro nome ou local, ajuste o texto em `regras-negocio.mdc` na secao "Fonte oficial" para apontar para o caminho correto **ou** mantenha `docs/regras-negocio.md` como doc canônico e referencie isso no guia.

3) **`docs/GUIA_OPERACAO_AGENTE.md`**
   - Revise exemplos e caminhos (modulos, nomes de telas) para refletir NEST_ANGULAR, sem mudar a estrutura dos templates de prompt.
   - Onde o guia citar `frontend/mobile`, deixe apenas `frontend` se nao houver app mobile.

4) **`.cursorrules` (apenas complemento)**
   - No **topo** ou **final** do `.cursorrules` existente, acrescente um bloco curto (se ainda nao existir) com:
     - prioridade: instrucao do usuario > `.cursorrules` > `.cursor/rules/*.mdc`;
     - lembrete de nao commitar segredos / `.env`;
     - resposta da IA deve incluir: o que mudou, arquivos impactados, validacoes, riscos residuais.
   - Nao duplicar longas secoes que ja estao nos `.mdc` (UI, API, negocio).

5) **Validacao**
   - Confirme que os tres `.mdc` mantem YAML valido no frontmatter (`---`, `description`, `globs`, `alwaysApply: true`).
   - Liste em bullet quais dominios OMNI foram removidos e quais padroes NEST foram adicionados.

Criterios de aceite:
- Nenhum glob obrigatorio aponta so para pastas que nao existem no repo (exceto paths intencionalmente genericos tipo `frontend/src/styles/...` se existirem).
- `regras-negocio.mdc` e o doc de regras de negocio estao alinhados.
- `.cursorrules` original permanece como base; apenas complemento de prioridade/processo.
- Resumo final com arquivos editados.

Escopo: apenas `.cursor/rules/*.mdc`, `docs/GUIA_OPERACAO_AGENTE.md`, `docs/regras-negocio.md` (se criar/ajustar), e trecho minimo no `.cursorrules`.
Fora de escopo: refatorar codigo de producao, alterar dependencias, mudar logica de negocio.
```

---

## Origem

Arquivos copiados a partir do projeto **OMNI** (`C:\PROJETOS\OMNI`). Apos rodar o prompt acima, as regras ficam especificas do **NEST_ANGULAR**.
