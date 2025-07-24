# 🚨 INSTRUÇÕES DE SEGURANÇA - LEIA ANTES DE USAR

## ⚠️ CHAVE DE API EXPOSTA - AÇÃO IMEDIATA NECESSÁRIA

### 1. **DESATIVE AS CHAVES EXPOSTAS IMEDIATAMENTE:**
- Acesse: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Encontre e **DESATIVE** estas chaves:
  - `[CHAVE_REMOVIDA_POR_SEGURANCA]`
  - `[CHAVE_REMOVIDA_POR_SEGURANCA]`
- **EXCLUA** estas chaves

### 2. **CRIE UMA NOVA CHAVE SEGURA:**
```bash
# No Google Cloud Console:
# 1. Criar Credenciais → Chave de API
# 2. Copiar a nova chave
# 3. Configurar restrições IMEDIATAMENTE
```

### 3. **CONFIGURE A NOVA CHAVE:**
1. Abra o arquivo `config.js`
2. Substitua `SUA_NOVA_CHAVE_SEGURA_AQUI` pela sua nova chave
3. **NÃO COMMITE** o arquivo `config.js` no GitHub

### 4. **CONFIGURAR RESTRIÇÕES NO GOOGLE CLOUD:**
```
URLs permitidas:
- https://rodrigohenriquecc.github.io/*
- http://localhost/*
- http://127.0.0.1/*
- http://127.0.0.1:3000/*
```

### 5. **TESTE LOCAL:**
```bash
# Abrir em servidor local:
python -m http.server 3000
# ou
npx serve -p 3000
```

---

## ✅ **SISTEMA AGORA SEGURO:**
- ✅ Chave **NÃO** exposta no código público
- ✅ Arquivo `config.js` no `.gitignore`
- ✅ Sistema funciona localmente e no GitHub Pages
- ✅ Configuração flexível para diferentes ambientes

## 🔐 **COMO FUNCIONA:**
1. `index.html` carrega `config.js` 
2. `config.js` carrega a API dinamicamente
3. GitHub **não recebe** o arquivo `config.js`
4. **Você mantém** o arquivo localmente

---

**🚨 IMPORTANTE:** Sempre que fizer deploy, configure a chave localmente no `config.js`
