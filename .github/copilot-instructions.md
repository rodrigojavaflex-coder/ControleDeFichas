# Instruções para Agentes de IA - Projeto NestJS + Angular

## Visão Geral da Arquitetura
Este é um projeto full-stack que combina:
- **Backend**: NestJS (Node.js com TypeScript)
- **Frontend**: Angular (TypeScript)
- **Banco de Dados**: PostgreSQL
- **Arquitetura**: Separação clara entre API REST e aplicação cliente

## Estrutura do Projeto
```
├── backend/          # API NestJS
│   ├── src/
│   │   ├── modules/  # Módulos organizados por funcionalidade
│   │   ├── common/   # Utilitários compartilhados
│   │   └── config/   # Configurações da aplicação
│   └── test/         # Testes E2E
├── frontend/         # Aplicação Angular
│   ├── src/app/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── services/    # Serviços para comunicação com API
│   │   └── models/      # Interfaces TypeScript
└── shared/           # Tipos/interfaces compartilhados
```

## Convenções de Desenvolvimento

### Backend (NestJS)
- **Módulos**: Organize funcionalidades em módulos separados (`@Module()`)
- **DTOs**: Use classes com decorators de validação (`class-validator`)
- **Injeção de Dependência**: Prefira constructor injection
- **Documentação**: Use Swagger decorators (`@ApiResponse`, `@ApiProperty`)
- **ORM**: Use TypeORM com entidades decoradas para PostgreSQL
- **Migrations**: Sempre crie migrations para mudanças no schema

```typescript
// Exemplo de controller
@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  
  @Post()
  @ApiOperation({ summary: 'Criar usuário' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}

// Exemplo de entidade TypeORM
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Frontend (Angular)
- **Componentes**: Use OnPush change detection quando possível
- **Serviços**: Implemente HttpClient com RxJS observables
- **Roteamento**: Configure lazy loading para modules
- **Forms**: Use Reactive Forms com FormBuilder

```typescript
// Exemplo de serviço
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}
  
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }
}
```

## Fluxos de Trabalho Essenciais

### Desenvolvimento Local
```bash
# Backend
cd backend
npm run start:dev    # Inicia em modo watch

# Frontend  
cd frontend
ng serve            # Inicia servidor de desenvolvimento

# PostgreSQL (Docker)
docker run --name postgres-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### Banco de Dados
```bash
# Migrations
npm run migration:generate -- -n NomeDaMigration
npm run migration:run       # Executa migrations pendentes
npm run migration:revert    # Reverte última migration

# Seeds
npm run seed:run           # Executa seeds de dados iniciais
```

### Testes
```bash
# Backend - Testes unitários
npm run test
npm run test:e2e    # Testes E2E

# Frontend - Testes
ng test             # Karma/Jasmine
ng e2e              # Protractor/Cypress
```

## Padrões Importantes

### Comunicação Frontend-Backend
- Use interfaces TypeScript compartilhadas em `/shared`
- Implemente interceptors Angular para autenticação/erro
- Configure CORS no backend para desenvolvimento local

### Tratamento de Erros
- Backend: Use exception filters personalizados
- Frontend: Implemente global error handler

### Autenticação
- JWT tokens armazenados no localStorage/sessionStorage
- Guards Angular para proteção de rotas
- Middleware NestJS para validação de tokens

## Dependências Principais
- **Backend**: `@nestjs/common`, `@nestjs/typeorm`, `class-validator`, `pg`
- **Frontend**: `@angular/core`, `@angular/router`, `rxjs`
- **Banco de Dados**: `typeorm`, `pg` (driver PostgreSQL)
- **Shared**: `class-transformer` para serialização de dados

## Configuração do Banco de Dados
- Use variáveis de ambiente para configuração do PostgreSQL
- Configure connection pooling no TypeORM
- Implemente migrations para versionamento do schema
- Use UUIDs como chaves primárias por padrão
- Configure timezone para UTC nas configurações do PostgreSQL

## Notas para Agentes de IA
- Sempre valide DTOs no backend antes de processar dados
- Use typed responses em serviços Angular para melhor autocomplete
- Implemente lazy loading para otimizar performance do frontend
- Configure environment files para diferentes ambientes (dev/prod)

---
*Instruções geradas automaticamente. Atualize conforme o projeto evolui.*