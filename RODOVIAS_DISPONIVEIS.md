# Lista Completa de Rodovias Disponíveis

Use EXATAMENTE estes nomes nos seus arquivos CSV:

## Rodovias SP
- SP 129 Vang
- SP 139 Vang
- SP 157 Vang
- SP 189 Vang
- SP 250 Vang
- SP 268 Vang
- SP 270 Vang

## Rodovias SPA
- SPA 099/139 Vang
- SPA 142/270 Vang
- SPA 157/270 Vang
- SPA 268/270 Vang
- SPA 270/268 Vang
- SPA 294/250 TRV SP-250

## Exemplos de Uso Correto

### Pontos de Interesse
```csv
Rodovia,Km,Cor,Opacidade,Raio,Obs
SP 250 Vang,159.500,#ff0000,1,8,Posto de combustível
SP 268 Vang,150.000,#00ff00,0.8,6,Restaurante
SP 270 Vang,180.000,#0000ff,1,10,Hospital
```

### Linhas por Trecho
```csv
Rodovia,Km Inicial,Km Final,Cor,Espessura
SP 250 Vang,160.000,165.000,#ff0000,6
SP 268 Vang,145.000,150.000,#00ff00,4
SPA 294/250 TRV SP-250,21.400,24.900,#0000ff,8
```

### Mapa de Calor
```csv
Rodovia,Km Inicial,Km Final
SP 250 Vang,158.600,170.000
SP 268 Vang,140.100,160.000
SP 270 Vang,170.000,190.000
```

## ⚠️ Lembre-se:
1. Use vírgula (,) como separador
2. Nome da rodovia deve ser EXATO
3. Km deve estar dentro da faixa da rodovia (veja meta.csv)
4. Inclua sempre o cabeçalho na primeira linha
