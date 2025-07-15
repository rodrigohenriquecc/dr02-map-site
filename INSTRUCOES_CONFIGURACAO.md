# Instruções para Configuração dos Arquivos CSV

## ⚠️ FORMATO CORRETO DOS CSVs

### 🔧 Regras Importantes:
1. **Separador**: Use VÍRGULA (,) e NÃO ponto e vírgula (;)
2. **Nome da Rodovia**: Deve ser EXATAMENTE igual ao arquivo meta.csv
3. **Números decimais**: Use ponto (.) ou vírgula (,) - o código converte automaticamente
4. **Cabeçalho**: A primeira linha deve conter os nomes das colunas

## 📂 Estrutura de Pastas

Crie a pasta **DadosSite** na área de trabalho de cada computador:
```
C:\Users\[NOME_DO_USUARIO]\Desktop\DadosSite\
```

## 📋 Arquivos Necessários

### 1. meta.csv ✅ (NÃO MODIFICAR)
Já está correto, contém informações das rodovias
```csv
Rodovia,Km Inicial,Lat e Long km Inicial,Km Final,Lat e Long km final
SP 250 Vang,158.600,-23.858920, -47.843170,201.810,-23.923730, -48.178490
```

### 2. pontos_interesse.csv
**FORMATO CORRETO:**
```csv
Rodovia,Km,Cor,Opacidade,Raio,Obs
SP 250 Vang,159.500,#ff0000,1,8,Ponte sobre rio
SP 268 Vang,150.000,#00ff00,0.8,6,Posto de combustível
```

**❌ FORMATO ERRADO:**
```csv
SP 250 Jon;250.400;262.000;#00ff00;8
```

### 3. mapa_calor.csv
**FORMATO CORRETO:**
```csv
Rodovia,Km Inicial,Km Final
SP 250 Vang,159.000,162.000
SP 268 Vang,145.000,155.000
```

### 4. linhas_trecho.csv
**FORMATO CORRETO:**
```csv
Rodovia,Km Inicial,Km Final,Cor,Espessura
SP 250 Vang,160.000,165.000,#00ff00,8
SP 268 Vang,150.000,155.000,#ff00ff,6
```

## 🗺️ Nomes de Rodovias Disponíveis

Use EXATAMENTE um destes nomes (do arquivo meta.csv):
- SP 129 Vang
- SP 139 Vang  
- SP 157 Vang
- SP 189 Vang
- SP 250 Vang
- SP 268 Vang
- SP 270 Vang
- SPA 099/139 Vang
- SPA 142/270 Vang
- ... (veja todos no meta.csv)

## ✅ Exemplo Completo Funcionando

**pontos_interesse.csv:**
```csv
Rodovia,Km,Cor,Opacidade,Raio,Obs
SP 250 Vang,159.500,#ff0000,1,8,Ponto vermelho
SP 250 Vang,170.000,#00ff00,0.8,6,Ponto verde
SP 268 Vang,150.000,#0000ff,1,10,Ponto azul
```

## 🔧 Como Usar

1. **Verifique o nome da rodovia** no arquivo meta.csv
2. **Use vírgula como separador** (não ponto e vírgula)
3. **Inclua cabeçalhos** na primeira linha
4. **Salve como CSV** com codificação UTF-8
5. **Coloque na pasta DadosSite** na área de trabalho
6. **Atualize a página** do site

## 🚨 Problemas Comuns

- ❌ **"SP 250 Jon"** → ✅ **"SP 250 Vang"** (nome exato do meta.csv)
- ❌ **Separador ;** → ✅ **Separador ,**
- ❌ **Sem cabeçalho** → ✅ **Com cabeçalho na linha 1**
- ❌ **Km fora da faixa** → ✅ **Km entre Km Inicial e Km Final da rodovia**
