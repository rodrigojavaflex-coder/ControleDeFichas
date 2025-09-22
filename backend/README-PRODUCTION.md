# 🚀 Deploy em Produção

## Configuração Inicial do Sistema

### Quando a aplicação for deployada em produção e conectada à base de dados do cliente, siga estes passos:

## 📋 Pré-requisitos

1. **✅ Aplicação compilada** (`npm run build`)
2. **✅ Banco PostgreSQL configurado** no cliente
3. **✅ Variáveis de ambiente** configuradas:
   ```bash
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_USERNAME=postgres
   DATABASE_PASSWORD=senha_do_cliente
   DATABASE_NAME=nome_do_banco_cliente
   NODE_ENV=production
   ```

## 🔧 Processo de Deploy

### Opção 1: Script Automático (Recomendado)

**Linux/Mac:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

**Windows:**
```cmd
deploy-production.bat
```

### Opção 2: Passo a Passo Manual

1. **Compilar aplicação:**
   ```bash
   npm run build
   ```

2. **Executar migrações:**
   ```bash
   npm run migration:run
   ```

3. **Criar usuário administrador:**
   ```bash
   npm run init:production
   ```

## 👤 Usuário Administrador

### O que acontece na primeira execução:
- ✅ **Verifica** se usuário `admin@sistema.com` existe
- ✅ **Cria** o usuário se não existir
- ✅ **Configura** todas as permissões administrativas
- ✅ **Criptografa** a senha com bcrypt

### Credenciais Padrão:
- **📧 Email:** `admin@sistema.com`
- **🔑 Senha:** `Ro112543*`
- **👑 Nome:** `Administrador`

### Permissões Incluídas:
- `user:create` - Criar usuários
- `user:read` - Visualizar usuários  
- `user:update` - Editar usuários
- `user:delete` - Excluir usuários
- `admin:full` - Administração completa
- `system:config` - Configurações
- `system:logs` - Logs do sistema
- `reports:view` - Visualizar relatórios
- `reports:export` - Exportar relatórios

## 🛡️ Segurança

### O sistema é seguro porque:
- ✅ **Não duplica:** Só cria se não existir
- ✅ **Senha criptografada:** Bcrypt com salt rounds = 10
- ✅ **Logs mínimos:** Não exposte credenciais em produção
- ✅ **Validação:** Verifica conexão com banco antes de criar

## 🔄 Execuções Subsequentes

### Se executar o script novamente:
- ✅ **Detecta** usuário existente
- ✅ **Não cria** duplicatas
- ✅ **Informa** credenciais para uso
- ✅ **Continua** funcionamento normal

## ⚠️ Troubleshooting

### Problemas Comuns:

**1. Erro de Conexão com Banco:**
```
❌ database connection failed
```
**Solução:** Verificar variáveis de ambiente e conectividade

**2. Usuário Já Existe:**
```
⚠️ Já existe um usuário cadastrado com este email
```
**Solução:** Normal! Use as credenciais existentes para login

**3. Permissões de Banco:**
```
❌ permission denied for table users
```
**Solução:** Verificar permissões do usuário do banco de dados

## 📞 Suporte

### Em caso de problemas:
1. **Verificar logs** da aplicação
2. **Confirmar variáveis** de ambiente
3. **Testar conectividade** com banco
4. **Executar diagnósticos** do script

### Logs importantes:
- ✅ `Usuário administrador criado com sucesso!`
- ⚠️ `Usuário administrador já existe!`
- ❌ `Erro durante inicialização do sistema`

---

## 🚀 Resumo para o Cliente

**Após o deploy:**
1. Execute `npm run init:production`
2. Acesse o sistema web
3. Login: `admin@sistema.com` / `Ro112543*`
4. Configure outros usuários conforme necessário
5. **Altere a senha** do administrador por segurança

**O usuário administrador será criado automaticamente na primeira execução e estará pronto para uso imediato!**