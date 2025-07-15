# 🚀 CONFIGURAÇÃO DE SINCRONIZAÇÃO AUTOMÁTICA COM GITHUB

## 📋 **O que foi implementado:**

O sistema agora possui **4 fontes de dados em ordem de prioridade**:

1. **📂 GitHub Repository** (site publicado) ← **NOVA**
2. **💻 Pastas Locais** (computadores)
3. **🌐 Pasta Compartilhada** (Nextcloud)
4. **☁️ Google Sheets** (fallback)

---

## ⚙️ **CONFIGURAÇÃO NECESSÁRIA:**

### **1️⃣ Configurar URLs do GitHub no script.js**

**IMPORTANTE**: Edite o arquivo `js/script.js` e substitua:

```javascript
// LINHA 37 - Substitua pelos seus dados:
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/DadosSite/";
```

**Exemplo real:**
```javascript
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/rodrigo-henrique/site-rodovias/main/DadosSite/";
```

### **2️⃣ Sincronização Automática**

#### **Opção A: Script Manual (RECOMENDADO)**

1. **Configure o Git** (primeira vez):
   ```powershell
   git config --global user.name "Seu Nome"
   git config --global user.email "seu@email.com"
   ```

2. **Execute quando quiser sincronizar:**
   - Duplo-clique em `SINCRONIZAR.bat`
   - O script irá pedir a URL do seu repositório GitHub

#### **Opção B: Tarefa Agendada (AUTOMÁTICO)**

1. Abra **Agendador de Tarefas** do Windows
2. Crie nova tarefa:
   - **Nome**: "Sincronizar Dados CSV"
   - **Acionador**: A cada 30 minutos (ou conforme necessário)
   - **Ação**: Executar `SINCRONIZAR.bat`

---

## 🔄 **FLUXO DE TRABALHO:**

### **No seu computador local:**
1. Edite os arquivos CSV em: `Z:\LBR IMPORTANTES\POWER BI LBR\Site\Site Completo\DadosSite\`
2. Execute `SINCRONIZAR.bat` (ou configure automático)
3. Os dados são enviados para o GitHub

### **No site publicado:**
1. GitHub recebe os novos dados
2. Site detecta automaticamente e carrega do GitHub
3. Usuários veem dados atualizados em tempo real

---

## 📁 **ARQUIVOS CRIADOS:**

- `sync-github.ps1` - Script PowerShell de sincronização
- `SINCRONIZAR.bat` - Script simples para executar
- `CONFIGURACAO_GITHUB.md` - Este arquivo de instruções

---

## 🐛 **SOLUÇÃO DE PROBLEMAS:**

### **Erro "not a git repository"**
- **Solução**: O script clona o repositório automaticamente

### **Erro de credenciais Git**
1. Configure credenciais:
   ```powershell
   git config --global credential.helper store
   ```
2. Na primeira vez, digite usuário/senha ou token do GitHub

### **Arquivo não sincroniza**
- Verifique se o arquivo existe em `DadosSite/`
- Execute manualmente: `SINCRONIZAR.bat`
- Veja logs no terminal

### **Site não atualiza**
1. Verifique se a URL do GitHub está correta no `script.js`
2. Aguarde alguns minutos (cache do navegador)
3. Abra o Console do navegador (F12) e veja mensagens

---

## ✅ **TESTE DA CONFIGURAÇÃO:**

1. **Edite um arquivo CSV** (ex: adicione uma linha em `meta.csv`)
2. **Execute** `SINCRONIZAR.bat`
3. **Aguarde 2-3 minutos**
4. **Abra o site publicado** e veja se os dados foram atualizados
5. **Verifique o Console** (F12) - deve mostrar "✓ DADOS CARREGADOS DO GITHUB"

---

## 📞 **PRÓXIMOS PASSOS:**

1. **Configure as URLs do GitHub** no arquivo `js/script.js`
2. **Teste a sincronização** uma vez
3. **Configure execução automática** (opcional)
4. **Confirme que o site publicado está funcionando**

**🎯 Resultado**: Quando você editar um CSV localmente e executar a sincronização, o site no GitHub será atualizado automaticamente!
