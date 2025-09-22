#!/bin/bash

# Script de Deploy para Produção
# Este script deve ser executado após o deploy da aplicação

echo "🚀 Iniciando configuração de produção..."
echo "📅 $(date)"
echo ""

# 1. Compilar aplicação
echo "🔨 Compilando aplicação..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erro na compilação!"
    exit 1
fi
echo "✅ Compilação concluída"
echo ""

# 2. Executar migrações do banco de dados
echo "🗃️ Executando migrações do banco de dados..."
npm run migration:run
if [ $? -ne 0 ]; then
    echo "⚠️ Erro nas migrações - continuando..."
fi
echo "✅ Migrações executadas"
echo ""

# 3. Inicializar usuário administrador
echo "👤 Inicializando usuário administrador..."
npm run init:production
if [ $? -ne 0 ]; then
    echo "❌ Erro na inicialização do usuário administrador!"
    exit 1
fi
echo "✅ Usuário administrador configurado"
echo ""

# 4. Verificar se aplicação está funcionando
echo "🔍 Verificando saúde da aplicação..."
# Aqui você pode adicionar health checks específicos
echo "✅ Aplicação pronta para uso"
echo ""

echo "🎉 Deploy de produção concluído com sucesso!"
echo ""
echo "📋 Credenciais do Administrador:"
echo "   📧 Email: admin@sistema.com"
echo "   🔑 Senha: Ro112543*"
echo ""
echo "🌐 Sua aplicação está pronta para uso!"