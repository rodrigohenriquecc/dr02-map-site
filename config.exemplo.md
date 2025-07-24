# 🔐 CONFIGURAÇÃO SEGURA - APENAS PARA USO LOCAL

## ⚠️ ESTE ARQUIVO NÃO DEVE SER COMMITADO!

### Instruções para configurar sua chave:

1. **Crie uma nova chave no Google Cloud Console:**
   - Acesse: https://console.cloud.google.com/apis/credentials
   - Clique em "Criar Credenciais" → "Chave de API"
   - Copie a nova chave gerada

2. **Configure as restrições IMEDIATAMENTE:**
   ```
   URLs permitidas:
   - https://rodrigohenriquecc.github.io/*
   - http://localhost/*
   - http://127.0.0.1/*
   - file://*
   ```

3. **Substitua no arquivo config.js:**
   - Abra o arquivo `config.js`
   - Encontre: `SUA_NOVA_CHAVE_AQUI_SUBSTITUA_ESTA_LINHA`
   - Substitua pela sua nova chave
   - Salve o arquivo

4. **NUNCA commite este arquivo:**
   - O arquivo está no `.gitignore`
   - Mantenha apenas localmente
   - Para cada deploy, configure localmente

### ✅ Exemplo de configuração:
```javascript
const GOOGLE_MAPS_API_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
```

### 🚨 Chaves que devem ser DESATIVADAS:
- AIzaSyDRgz2fjGIsRXztCQpIWXMlsQifV1C4IDM
- AIzaSyB3nNHYBU1qCnR9LiXgewa3WaLYnx4n-tQ
