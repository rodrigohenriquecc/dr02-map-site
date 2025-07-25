# 📏 Documentação: Linhas por Trecho

## 🏗️ Estrutura da Planilha

### Colunas Obrigatórias:

1. **rodovia** (Texto)
   - **Descrição**: Nome da rodovia onde a linha será desenhada
   - **Formato**: SP XXX (ex: SP 270, SP 079)
   - **Exemplo**: "SP 270"

2. **km_inicial** (Número)
   - **Descrição**: Quilometragem inicial do trecho
   - **Formato**: Decimal com ponto (ex: 195.000, 205.000)
   - **Exemplo**: "195.000"

3. **km_final** (Número)
   - **Descrição**: Quilometragem final do trecho  
   - **Formato**: Decimal com ponto (ex: 195.000, 205.000)
   - **Exemplo**: "205.000"

4. **cor** (Código Hexadecimal - Opcional)
   - **Descrição**: Cor da linha no mapa
   - **Formato**: #RRGGBB (ex: #FF0000, #00FF00)
   - **Padrão**: #FF0000 (vermelho) se não especificado
   - **Exemplo**: "#FF0000"

5. **espessura** (Número - Opcional)
   - **Descrição**: Espessura da linha em pixels
   - **Formato**: Número inteiro (ex: 5, 10, 15)
   - **Padrão**: 5 pixels se não especificado
   - **Exemplo**: "10"

## 📝 Exemplo da Planilha

```csv
rodovia,km_inicial,km_final,cor,espessura
SP 270,195.000,205.000,#FF0000,10
SP 079,45.500,67.800,#00FF00,8
SP 070,12.300,25.600,#0066FF,12
```

## 🔗 URL da Planilha Configurada

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vR2wW76oOiHiip6-ThZWsw6hH5_y-7klCFeKUtR5J7VfSPEfN0G721SFxqLz9twIW25_JhYMXHsH69Z/pub?output=csv
```

## 🎨 Funcionalidades

### **Visualização no Mapa:**
- **Polylines**: Linhas retas conectando os pontos inicial e final
- **Cores Personalizadas**: Cada linha pode ter sua própria cor
- **Espessuras Variáveis**: Controle visual da importância do trecho
- **InfoWindows Interativos**: Clique na linha para ver detalhes

### **Informações Exibidas:**
- Nome da rodovia
- Trecho (Km inicial - Km final)
- Extensão calculada automaticamente
- Detalhes visuais (cor e espessura)
- Coordenadas dos pontos inicial e final
- Link direto para rota no Google Maps

### **Integração com Sistema:**
- Busca automática de coordenadas na base existente de dados
- Correspondência por rodovia e quilometragem
- Fallback para interpolação entre pontos próximos
- Logs detalhados para debugging

## 🎯 Como Usar

1. **Ative a funcionalidade** clicando no botão "📏 Linhas por Trecho" no menu hambúrguer
2. **Edite a planilha** no Google Sheets com novos trechos
3. **Publique as alterações** - aparecerão automaticamente no mapa
4. **Clique nas linhas** para ver informações detalhadas
5. **Toggle on/off** para mostrar/ocultar todas as linhas

## 🎨 Dicas de Cores

### Por Tipo de Obra:
- **🔴 Obras Críticas**: #FF0000 (Vermelho)
- **🟠 Manutenção**: #FF8800 (Laranja) 
- **🟡 Planejamento**: #FFFF00 (Amarelo)
- **🟢 Concluído**: #00FF00 (Verde)
- **🔵 Monitoramento**: #0066FF (Azul)

### Por Prioridade:
- **Alta**: Espessura 12-15px
- **Média**: Espessura 8-10px  
- **Baixa**: Espessura 5-6px

## 📱 Controles Disponíveis

- ✅ **Toggle On/Off**: Mostrar/ocultar todas as linhas
- ✅ **Zoom Automático**: Ajuste da visualização aos trechos ativos
- ✅ **InfoWindows**: Informações detalhadas ao clicar
- ✅ **Navegação**: Link direto para Google Maps
- ✅ **Logs de Debug**: Monitoramento no console do navegador

## 🔧 Configuração Técnica

### **Processamento dos Dados:**
1. Carregamento da planilha via CSV público
2. Validação dos campos obrigatórios
3. Busca de coordenadas na base de dados existente
4. Criação de polylines no Google Maps
5. Configuração de eventos e InfoWindows

### **Tratamento de Erros:**
- Fallback para CORS com proxy
- Logs detalhados para debugging
- Mensagens de erro amigáveis
- Validação de dados de entrada

### **Performance:**
- Carregamento sob demanda
- Limpeza automática de elementos anteriores
- Otimização para grandes volumes de dados
