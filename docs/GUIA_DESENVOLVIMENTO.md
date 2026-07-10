# Guia de Desenvolvimento — Telas e Permissões

Padrões obrigatórios ao criar ou alterar telas no frontend Angular.

## Acesso por rota (obrigatório)

Esconder o item no menu **não** protege a tela. Qualquer usuário autenticado pode digitar a URL.

Toda rota de negócio deve usar:

1. `authGuard` — usuário logado + token válido
2. `permissionGuard` — permissão declarada em `data.permissions` (OR)

```ts
import { authGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';
import { Permission } from './models/usuario.model';

{
  path: 'relatorios/fechamento-caixa',
  loadComponent: () =>
    import('./components/fechamento-caixa-page/fechamento-caixa-page').then(
      (m) => m.FechamentoCaixaPageComponent,
    ),
  canActivate: [authGuard, permissionGuard],
  data: { permissions: [Permission.VENDA_FECHAR_CAIXA] },
}
```

### Regras

| Tipo de rota | `data.permissions` |
|--------------|--------------------|
| Listagem / tela principal | Mesmo conjunto do menu (`navigation.ts`) — OR |
| `/new` | Permissão `*:create` |
| `/edit/:id` | Permissão `*:update` |
| `/view/:id` | Permissão `*:read` |
| Home (`''`) e login | Só `authGuard` (sem `permissions`) |

Sem `data.permissions` (ou lista vazia), o `permissionGuard` libera qualquer autenticado — use só para home ou rotas públicas internas.

### Checklist — nova tela

| # | Onde | O que fazer |
|---|------|-------------|
| 1 | `frontend/src/app/app.routes.ts` | Rota + `canActivate: [authGuard, permissionGuard]` + `data.permissions` |
| 2 | `frontend/src/app/components/navigation/navigation.ts` | Item de menu com as **mesmas** permissões (OR) |
| 3 | `frontend/src/app/config/home-shortcuts.registry.ts` | Atalho na home (se aplicável) |
| 4 | `backend/src/common/constants/home-shortcut-ids.ts` | Mesmo `id` do atalho |
| 5 | Controller NestJS | `@UseGuards(AuthGuard('jwt'), PermissionsGuard)` + `@Permissions(...)` em **leitura e escrita** |
| 6 | Enum / perfil | Permissão em `permission.enum` (backend + frontend) e rótulo no cadastro de perfil |
| 7 | `docs/regras-negocio.md` | RN-* se houver regra funcional nova |

**Importante:** menu e rota devem usar o mesmo critério de permissão. Divergência = usuário vê o menu e toma 403, ou acessa pela URL sem ver o menu.

## Backend

- UI sem permissão **não** substitui `@Permissions` na API.
- Endpoints de **consulta** (GET) de dados sensíveis também precisam de permissão — não só POST/PUT/DELETE.
- Várias permissões no decorator = OR (basta uma).

## Versão do frontend (anti-cache)

Objetivo: usuário não ficar preso em JS/CSS antigos após deploy.

| Peça | Função |
|------|--------|
| `outputHashing: "all"` (`angular.json`) | Bundles com hash no nome |
| `public/_headers` | `index.html` e `version.json` sem cache; `*.js`/`*.css` com cache longo |
| `scripts/generate-version.mjs` | Gera `public/version.json` no `prebuild` / `prestart` |
| `AppVersionService` | Em produção, compara `buildId` a cada 5 min e ao focar a aba; banner “Atualizar” |

**Deploy:** o diretório publicado do Static Site deve incluir `_headers` e `version.json` (saem de `public/` no build Angular). Confirmar no painel do host (ex.: Render) se `_headers` é suportado; se não for, configurar Cache-Control equivalente no CDN/host.

## Referências

- Guard: `frontend/src/app/guards/permission.guard.ts`
- Rotas: `frontend/src/app/app.routes.ts`
- Menu: `frontend/src/app/components/navigation/navigation.ts`
- Versão: `frontend/src/app/services/app-version.service.ts`
- Checklist de atalhos: `docs/GUIA_OPERACAO_AGENTE.md`
