# 🔧 Configuração da API Google Maps

## 🚫 Problema Atual
**RefererNotAllowedMapError**: A chave da API não permite acesso a partir de domínios locais.

## ✅ Soluções

### **Opção 1: Configurar Domínios na Google Cloud Console**

1. **Acesse o Google Cloud Console:**
   - https://console.cloud.google.com/

2. **Navegue para APIs & Services > Credentials:**
   - Encontre sua chave de API: `AIzaSyATqOLfz4oHNnqXFT6svI27ZJbg0wMtOvA`

3. **Edite as Restrições da Chave:**
   - Clique na chave para editá-la
   - Em "Application restrictions" selecione "HTTP referrers (web sites)"
   - Adicione os seguintes referrers:
     ```
     http://localhost:*/*
     http://127.0.0.1:*/*
     https://localhost:*/*
     https://127.0.0.1:*/*
     http://192.168.*.*:*/*
     ```

4. **Salve as alterações**

### **Opção 2: Criar Nova Chave de API (Recomendado)**

1. **No Google Cloud Console:**
   - APIs & Services > Credentials
   - "+ CREATE CREDENTIALS" > API key

2. **Configure a nova chave:**
   - Nome: "Maps API - Desenvolvimento Local"
   - Application restrictions: "HTTP referrers"
   - Website restrictions:
     ```
     http://localhost:*/*
     http://127.0.0.1:*/*
     https://localhost:*/*
     https://127.0.0.1:*/*
     *://127.0.0.1:*/*
     *://localhost:*/*
     ```

3. **Ative as APIs necessárias:**
   - Maps JavaScript API
   - Places API (se usar)
   - Geocoding API (se usar)

### **Opção 3: Chave Temporária Sem Restrições (NÃO para produção)**

1. **Edite a chave atual:**
   - Application restrictions: "None"
   - ⚠️ **CUIDADO**: Remova as restrições apenas para desenvolvimento local
   - ⚠️ **IMPORTANTE**: Adicione as restrições novamente antes de publicar

## 🔄 Depois de Configurar

1. **Aguarde 5-10 minutos** para as alterações propagarem
2. **Recarregue a página** (Ctrl+F5)
3. **Verifique o console** para confirmar que não há mais erros

## 📝 Notas Importantes

- **Para produção**: Sempre use restrições específicas do domínio
- **Para desenvolvimento**: Adicione localhost e IPs locais
- **Monitoramento**: Configure quotas e alertas de uso
- **Segurança**: Nunca commit chaves de API sem restrições

## 🌐 Domínios Típicos para Adicionar

**Desenvolvimento:**
```
http://localhost:*/*
http://127.0.0.1:*/*
http://localhost:3000/*
http://localhost:8000/*
```

**Produção (exemplo):**
```
https://seudominio.com/*
https://www.seudominio.com/*
```

## 🔍 Verificação Rápida

Após configurar, teste com:
```javascript
// No console do navegador
console.log('Google Maps carregado:', typeof google !== 'undefined');
```

---
**Status atual**: ✅ Chave API atualizada: `AIzaSyATqOLfz4oHNnqXFT6svI27ZJbg0wMtOvA`  
**Próximo passo**: Aguardar propagação (5-10 min) e testar o mapa
