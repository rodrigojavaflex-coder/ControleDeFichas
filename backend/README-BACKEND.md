# Backend - NestJS API

## Descrição
API REST desenvolvida with NestJS, TypeORM e PostgreSQL para o projeto NestJS + Angular.

## Tecnologias
- **NestJS** - Framework Node.js
- **TypeScript** - Linguagem de programação
- **PostgreSQL** - Banco de dados
- **TypeORM** - ORM para TypeScript
- **Swagger** - Documentação da API
- **Class Validator** - Validação de DTOs
- **Docker** - Containerização

## Pré-requisitos
- Node.js (v18 ou superior)
- PostgreSQL (ou Docker)
- npm ou yarn

## Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure as variáveis:
```bash
cp .env.example .env
```

### 3. Iniciar PostgreSQL (com Docker)
```bash
cd ..
docker-compose up -d postgres
```

## Executar a aplicação

### Desenvolvimento
```bash
npm run start:dev
```

### Debug
```bash
npm run start:debug
```

### Produção
```bash
npm run build
npm run start:prod
```

## Documentação da API
A documentação Swagger estará disponível em: `http://localhost:3000/api/docs`

## Scripts disponíveis

### Desenvolvimento
- `npm run start:dev` - Inicia em modo desenvolvimento com watch
- `npm run start:debug` - Inicia em modo debug
- `npm run build` - Compila o projeto
- `npm run format` - Formatar código com Prettier
- `npm run lint` - Executar ESLint

### Testes
- `npm run test` - Executar testes unitários
- `npm run test:watch` - Executar testes em modo watch
- `npm run test:cov` - Executar testes com coverage
- `npm run test:e2e` - Executar testes E2E

### Banco de Dados
- `npm run migration:generate -- -n NomeDaMigration` - Gerar nova migration
- `npm run migration:run` - Executar migrations pendentes
- `npm run migration:revert` - Reverter última migration

## Estrutura do Projeto
```
src/
├── config/           # Configurações da aplicação
├── common/           # Utilitários compartilhados
│   ├── dto/          # DTOs base
│   ├── entities/     # Entidades base
│   └── decorators/   # Decorators personalizados
├── modules/          # Módulos da aplicação
│   └── users/        # Módulo de usuários (exemplo)
├── migrations/       # Migrations do banco de dados
└── main.ts          # Ponto de entrada da aplicação
```

## Funcionalidades Implementadas
- ✅ CRUD completo de usuários
- ✅ Paginação e filtros
- ✅ Validação de dados com DTOs
- ✅ Documentação automática com Swagger
- ✅ Configuração de ambiente
- ✅ Estrutura modular do NestJS

## Próximos Passos
- [ ] Implementar autenticação JWT
- [ ] Adicionar testes unitários
- [ ] Configurar CI/CD
- [ ] Implementar logging estruturado