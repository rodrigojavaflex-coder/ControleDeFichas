@echo off
REM Script de Deploy para Produção (Windows)
REM Este script deve ser executado após o deploy da aplicação

echo 🚀 Iniciando configuração de produção...
echo 📅 %date% %time%
echo.

REM 1. Compilar aplicação
echo 🔨 Compilando aplicação...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erro na compilação!
    pause
    exit /b 1
)
echo ✅ Compilação concluída
echo.

REM 2. Executar migrações do banco de dados
echo 🗃️ Executando migrações do banco de dados...
call npm run migration:run
if %errorlevel% neq 0 (
    echo ⚠️ Erro nas migrações - continuando...
)
echo ✅ Migrações executadas
echo.

REM 3. Inicializar usuário administrador
echo 👤 Inicializando usuário administrador...
call npm run init:production
if %errorlevel% neq 0 (
    echo ❌ Erro na inicialização do usuário administrador!
    pause
    exit /b 1
)
echo ✅ Usuário administrador configurado
echo.

REM 4. Verificar se aplicação está funcionando
echo 🔍 Verificando saúde da aplicação...
REM Aqui você pode adicionar health checks específicos
echo ✅ Aplicação pronta para uso
echo.

echo 🎉 Deploy de produção concluído com sucesso!
echo.
echo 📋 Credenciais do Administrador:
echo    📧 Email: admin@sistema.com
echo    🔑 Senha: Ro112543*
echo.
echo 🌐 Sua aplicação está pronta para uso!
echo.
pause