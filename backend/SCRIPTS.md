# Scripts de Inicialização do Sistema

## 🚀 Script de Criação do Usuário Administrador

### `npm run init:database`

Este script cria um usuário administrador com todas as permissões no sistema, sem afetar outros dados existentes.

#### O que o script faz:

1. **✅ Verifica existência**: Checa se já existe um administrador
2. **👤 Cria administrador**: Cria usuário com permissões completas (se não existir)
3. **🔐 Senha criptografada**: Aplica hash bcrypt na senha
4. **🛡️ Todas as permissões**: Inclui todas as permissões disponíveis

#### Credenciais do Administrador:
- **📧 Email**: `admin@sistema.com`
- **🔑 Senha**: `Ro112543*`
- **👑 Nome**: `Administrador`

#### Permissões Incluídas:
- ✅ `user:create` - Criar usuários
- ✅ `user:read` - Visualizar usuários
- ✅ `user:update` - Editar usuários
- ✅ `user:delete` - Excluir usuários
- ✅ `admin:full` - Administração completa
- ✅ `system:config` - Configurações do sistema
- ✅ `system:logs` - Visualização de logs
- ✅ `reports:view` - Visualizar relatórios
- ✅ `reports:export` - Exportar relatórios

#### Como usar:

```bash
# No diretório backend
cd backend
npm run init:database
```

#### Quando usar:
- ✅ Primeira vez configurando o sistema
- ✅ Precisa criar usuário administrador
- ✅ Esqueceu credenciais do admin (recria se não existir)
- ✅ Setup de desenvolvimento

#### Segurança:
- ✅ **SEGURO**: NÃO apaga dados existentes
- ✅ **Inteligente**: Só cria se não existir
- 🔒 Senha é criptografada com bcrypt (salt rounds = 10)
- 🛡️ Usuário criado com todas as permissões disponíveis

---

## 📋 Outros Scripts Disponíveis

### `npm run create:user`
Cria usuário administrador sem limpar a base (se não existir)

### `npm run create:test-user`
Cria usuário de teste **sem** permissão de exclusão para testar o sistema de permissões

### `npm run hash:passwords`
Criptografa senhas existentes em texto plano no banco

---

## 🧪 Fluxo de Desenvolvimento Recomendado

1. **Configuração inicial**:
   ```bash
   npm run init:database
   ```

2. **Login no sistema**:
   - Acesse: http://localhost:4201
   - Email: `admin@sistema.com`
   - Senha: `admin123`

3. **Teste de permissões**:
   ```bash
   npm run create:test-user
   ```
   - Login com `teste@test.com` / `123456`
   - Observe que botão "Excluir" não aparece

4. **Reset quando necessário**:
   ```bash
   npm run init:database  # Recomeça do zero
   ```