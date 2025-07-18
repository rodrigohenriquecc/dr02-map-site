/* global L, JSZip, shp, turf, Papa, toGeoJSON */

console.log("🗺️ DR.02 - Sistema Colaborativo carregado (v2.0)");

// ═══════════════════════ 1) Inicialização do Mapa
const mapa = L.map("map").setView([-23.8, -48.5], 7);
window.mapa = mapa;

// Criação de panes para melhor organização das camadas
["shapefilePane", "rodoviasPane", "overlayPane", "markerPane"].forEach((p, i) => {
  mapa.createPane(p).style.zIndex = 400 + i * 50;
  if (i < 2) mapa.getPane(p).style.pointerEvents = "none";
});

// Camada base do mapa
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap | DR.02 Sistema Colaborativo",
}).addTo(mapa);

// ═══════════════════════ 2) Variáveis Globais
const layers = {
  pontos: L.layerGroup([], { pane: "overlayPane" }).addTo(mapa),
  linhas: L.layerGroup([], { pane: "rodoviasPane" }).addTo(mapa),
  calor: null
};

// ═══════════════════════ 2.1) Dados km a km da malha oficial
let pontosMalhaOficial = [];
let indexMalhaOficial = {};

/**
 * Carrega PLANILHA BI - OFICIAL.csv e indexa por rodovia e km
 */
async function carregarMalhaOficial() {
  try {
    const response = await fetch('assets/data/PLANILHA BI - OFICIAL.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const csvText = await response.text();
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        transform: (value) => value.trim(),
        complete: (results) => {
          pontosMalhaOficial = results.data;
          indexMalhaOficial = {};
          pontosMalhaOficial.forEach((row) => {
            const rodovia = row.SP?.trim();
            const kmStr = row['KM ']?.replace(',', '.');
            const km = parseFloat(kmStr);
            if (!rodovia || isNaN(km)) return;
            if (!indexMalhaOficial[rodovia]) indexMalhaOficial[rodovia] = {};
            indexMalhaOficial[rodovia][kmStr] = row;
          });
          console.log(`✅ PLANILHA BI - OFICIAL carregada: ${pontosMalhaOficial.length} pontos`);
          resolve();
        },
        error: (error) => {
          console.error('❌ Erro no parsing da PLANILHA BI - OFICIAL:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('❌ Erro ao carregar PLANILHA BI - OFICIAL:', error);
    throw error;
  }
}

// Variáveis para shapefiles
const rcLayers = {};
const rodLayers = {};
let rodLabels = [];

let dados = {
  linhasPorTrecho: [],
  mapaDeCalor: [],
  pontosDeInteresse: []
};

// ═══════════════════════ 3) URLs dos CSVs do Google Drive
const CSV_URLS = {
  // URLs públicas do Google Drive (compartilhado entre 4 usuários)
  // Usando formato /export?format=csv que funciona melhor
  linhasPorTrecho: 'https://docs.google.com/spreadsheets/d/1r-7wdW8IwNhDMmGJ_QoflML-Mo1wvgAuw6ILK_LFlpo/export?format=csv',
  mapaDeCalor: 'https://docs.google.com/spreadsheets/d/1IcM6qrF9JpZlJ6c6P1pvb8O5bhmdgDz4gKCtf8V2JUg/export?format=csv', 
  pontosDeInteresse: 'https://docs.google.com/spreadsheets/d/1Zxrq6L68fkTuygCE6yVVLOb9wU0UhoQfQHOMm_Xr8RI/export?format=csv'
};

// ═══════════════════════ 4) Sistema de Coordenadas Reais

/**
 * Dados de metadados das rodovias carregados do meta.csv
 */
let metadadosRodovias = {};

/**
 * Carrega o arquivo meta.csv com coordenadas reais das rodovias
 */
async function carregarMetadadosRodovias() {
  console.log("📊 Carregando metadados das rodovias (meta.csv)...");
  
  try {
    const response = await fetch('assets/data/meta.csv');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        complete: (results) => {
          metadadosRodovias = {};
          
          results.data.forEach((row, index) => {
            try {
              const rodovia = row.Rodovia?.trim();
              const kmInicialStr = row['Km Inicial']?.replace(',', '.');
              const kmFinalStr = row['Km Final']?.replace(',', '.');
              const coordInicialStr = row['Lat e Long km Inicial'];
              const coordFinalStr = row['Lat e Long km final'];
              
              if (!rodovia || !kmInicialStr || !kmFinalStr || !coordInicialStr || !coordFinalStr) {
                return;
              }
              
              const kmInicial = parseFloat(kmInicialStr);
              const kmFinal = parseFloat(kmFinalStr);
              
              // Parse coordenadas iniciais (formato: "-23.415050, -48.043810")
              const [latInicial, lngInicial] = coordInicialStr.split(',').map(c => parseFloat(c.trim()));
              const [latFinal, lngFinal] = coordFinalStr.split(',').map(c => parseFloat(c.trim()));
              
              if (isNaN(kmInicial) || isNaN(kmFinal) || isNaN(latInicial) || isNaN(lngInicial) || isNaN(latFinal) || isNaN(lngFinal)) {
                console.warn(`⚠️ Dados inválidos na linha ${index + 2}: ${rodovia}`);
                return;
              }
              
              if (!metadadosRodovias[rodovia]) {
                metadadosRodovias[rodovia] = [];
              }
              
              metadadosRodovias[rodovia].push({
                kmInicial,
                kmFinal,
                coordInicial: { lat: latInicial, lng: lngInicial },
                coordFinal: { lat: latFinal, lng: lngFinal }
              });
              
            } catch (error) {
              console.error(`❌ Erro ao processar linha ${index + 2}:`, error, row);
            }
          });
          
          // Ordena trechos por km inicial para facilitar interpolação
          Object.values(metadadosRodovias).forEach(trechos => {
            trechos.sort((a, b) => a.kmInicial - b.kmInicial);
          });
          
          console.log(`✅ Metadados carregados: ${Object.keys(metadadosRodovias).length} rodovias`);
          console.log("📍 Rodovias disponíveis:", Object.keys(metadadosRodovias));
          resolve(metadadosRodovias);
        },
        error: (error) => {
          console.error("❌ Erro no parsing do meta.csv:", error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("❌ Erro ao carregar meta.csv:", error);
    throw error;
  }
}

/**
 * Calcula coordenadas reais baseadas na rodovia e quilometragem
 * @param {string} rodovia - Nome da rodovia (ex: "SP 270 Vang")
 * @param {number} km - Quilometragem desejada
 * @returns {Object|null} - {lat, lng} ou null se não encontrado
 */
function obterCoordenadaReal(rodovia, km) {
  // Tenta buscar na PLANILHA BI - OFICIAL para máxima precisão
  if (indexMalhaOficial[rodovia]) {
    // Busca exata
    let ponto = indexMalhaOficial[rodovia][km.toString()];
    if (!ponto) {
      // Busca aproximada (caso decimal ou erro de separador)
      const kmStr = km.toFixed(1).replace('.', ',');
      ponto = indexMalhaOficial[rodovia][kmStr];
      if (!ponto) {
        // Busca pelo km mais próximo
        const kms = Object.keys(indexMalhaOficial[rodovia]).map(k => parseFloat(k.replace(',', '.')));
        const kmMaisProx = kms.reduce((prev, curr) => Math.abs(curr - km) < Math.abs(prev - km) ? curr : prev, kms[0]);
        ponto = indexMalhaOficial[rodovia][kmMaisProx.toString().replace('.', ',')];
      }
    }
    if (ponto && ponto.LOCALIZAÇÃO) {
      const [lat, lng] = ponto.LOCALIZAÇÃO.split(',').map(c => parseFloat(c.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, ponto };
      }
    }
  }
  // Fallback: sistema antigo
  // ...existing code...
  if (!metadadosRodovias[rodovia]) {
    const rodoviaLimpa = rodovia.replace(/ Vang| Jon| Madri| Obragen| Ellenco| Vale/g, '').trim();
    const possiveisNomes = Object.keys(metadadosRodovias).filter(r => 
      r.includes(rodoviaLimpa) || rodoviaLimpa.includes(r.split(' ')[0] + ' ' + r.split(' ')[1])
    );
    if (possiveisNomes.length === 0) {
      console.warn(`⚠️ Rodovia não encontrada nos metadados: ${rodovia}`);
      return null;
    }
    rodovia = possiveisNomes[0];
  }
  const trechos = metadadosRodovias[rodovia];
  if (!trechos || trechos.length === 0) return null;
  const trecho = trechos.find(t => km >= t.kmInicial && km <= t.kmFinal);
  if (!trecho) {
    const trechoProximo = trechos.reduce((prev, curr) => {
      const distPrev = Math.min(Math.abs(km - prev.kmInicial), Math.abs(km - prev.kmFinal));
      const distCurr = Math.min(Math.abs(km - curr.kmInicial), Math.abs(km - curr.kmFinal));
      return distPrev < distCurr ? prev : curr;
    });
    const distInicial = Math.abs(km - trechoProximo.kmInicial);
    const distFinal = Math.abs(km - trechoProximo.kmFinal);
    return distInicial < distFinal ? trechoProximo.coordInicial : trechoProximo.coordFinal;
  }
  const progresso = (km - trecho.kmInicial) / (trecho.kmFinal - trecho.kmInicial);
  const lat = trecho.coordInicial.lat + (trecho.coordFinal.lat - trecho.coordInicial.lat) * progresso;
  const lng = trecho.coordInicial.lng + (trecho.coordFinal.lng - trecho.coordInicial.lng) * progresso;
  return { lat, lng };
}

// ═══════════════════════ 5) Funções de Carregamento de Dados

/**
 * Carrega um CSV e retorna os dados parseados
 */
async function carregarCSV(url, nome) {
  console.log(`📊 Carregando ${nome}...`);
  
  try {
    // Primeira tentativa: URL normal
    let response = await fetch(url);
    
    // Se receber 303 ou 500, tenta URLs alternativas
    if (response.status === 303 || response.status === 500) {
      console.warn(`⚠️ ${nome}: Status ${response.status}, tentando método alternativo...`);
      
      // Extrai ID da URL e tenta formato CSV direto
      const idMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
      if (idMatch) {
        const fileId = idMatch[1];
        const urlAlternativa = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
        console.log(`🔄 Tentando URL alternativa para ${nome}: ${urlAlternativa}`);
        response = await fetch(urlAlternativa);
      }
    }
    
    // Verifica se houve redirecionamento (planilha não pública)
    if (response.status === 303 || response.url.includes('accounts.google.com')) {
      throw new Error(`Planilha "${nome}" não está pública. Configure permissões para "qualquer pessoa com o link".`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Verifica se o conteúdo parece ser HTML (erro de login)
    if (csvText.trim().startsWith('<!DOCTYPE') || csvText.includes('<html')) {
      throw new Error(`Planilha "${nome}" retornou HTML ao invés de CSV. Verifique as permissões públicas.`);
    }
    
    // Verifica se o CSV está vazio ou só tem cabeçalhos
    const linhas = csvText.trim().split('\n');
    if (linhas.length <= 1) {
      console.warn(`⚠️ ${nome}: Planilha parece estar vazia (${linhas.length} linhas)`);
    }
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn(`⚠️ Avisos no parsing de ${nome}:`, results.errors);
          }
          console.log(`✅ ${nome} carregado: ${results.data.length} registros`);
          resolve(results.data);
        },
        error: (error) => {
          console.error(`❌ Erro no parsing de ${nome}:`, error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error(`❌ Erro ao carregar ${nome}:`, error);
    throw error;
  }
}

/**
 * Carrega todos os CSVs e metadados
 */
async function carregarTodosDados() {
  console.log("🚀 Iniciando carregamento de dados...");
  
  try {
    // Carrega metadados primeiro para ter coordenadas disponíveis
    console.log("📍 Carregando metadados das rodovias...");
    await Promise.all([
      carregarMetadadosRodovias(),
      carregarMalhaOficial()
    ]);
    // Carrega todos os CSVs em paralelo
    const [linhas, calor, pontos] = await Promise.all([
      carregarCSV(CSV_URLS.linhasPorTrecho, 'Linhas por Trecho'),
      carregarCSV(CSV_URLS.mapaDeCalor, 'Mapa de Calor'),
      carregarCSV(CSV_URLS.pontosDeInteresse, 'Pontos de Interesse')
    ]);
    dados.linhasPorTrecho = linhas;
    dados.mapaDeCalor = calor;
    dados.pontosDeInteresse = pontos;
    // Debug: mostra dados carregados
    console.log("📊 DADOS CARREGADOS:");
    console.log("🛣️ Linhas por Trecho:", dados.linhasPorTrecho);
    console.log("🔥 Mapa de Calor:", dados.mapaDeCalor);
    console.log("📍 Pontos de Interesse:", dados.pontosDeInteresse);
    // Renderiza os dados no mapa
    renderizarLinhasPorTrecho();
    renderizarMapaDeCalor();
    renderizarPontosDeInteresse();
    console.log("🎉 Todos os dados carregados e renderizados com sucesso!");
    mostrarNotificacao("✅ Dados atualizados com sucesso!", "success");
  } catch (error) {
    console.error("💥 Erro ao carregar dados:", error);
    let mensagem = "Erro ao carregar dados.";
    if (error.message.includes('não está pública')) {
      mensagem = "🔒 Planilhas não públicas. Configure permissões no Google Drive.";
    } else if (error.message.includes('Failed to fetch')) {
      mensagem = "🌐 Erro de conexão. Verifique sua internet.";
    } else if (error.message.includes('HTTP 500')) {
      mensagem = "⚠️ Servidor temporariamente indisponível. Tente novamente em alguns segundos.";
    } else if (error.message.includes('HTTP')) {
      mensagem = `📡 Erro no servidor: ${error.message}`;
    }
    mostrarNotificacao(mensagem, "error");
  }
}

// ═══════════════════════ 5) Funções de Renderização

/**
 * Renderiza as linhas por trecho
 */
function renderizarLinhasPorTrecho() {
  console.log("🛣️ Renderizando linhas por trecho...");
  console.log("📊 Dados recebidos:", dados.linhasPorTrecho);
  
  layers.linhas.clearLayers();
  
  dados.linhasPorTrecho.forEach((linha, index) => {
    try {
      const rodovia = linha.rodovia || `Rodovia ${index + 1}`;
      const kmInicial = parseFloat(linha.km_inicial) || 0;
      const kmFinal = parseFloat(linha.km_final) || 0;
      const cor = linha.cor || '#0000FF';
      const espessura = parseInt(linha.espessura) || 3;
      
      console.log(`🛣️ Processando linha: ${rodovia}, Km ${kmInicial}-${kmFinal}, Cor: ${cor}, Espessura: ${espessura}`);
      
      // Gera pontos intermediários para máxima precisão (malha oficial)
      let pontos = [];
      if (indexMalhaOficial[rodovia]) {
        // Seleciona todos os pontos entre kmInicial e kmFinal
        const kms = Object.keys(indexMalhaOficial[rodovia])
          .map(k => parseFloat(k.replace(',', '.')))
          .filter(k => k >= kmInicial && k <= kmFinal)
          .sort((a, b) => a - b);
        kms.forEach(k => {
          const ponto = indexMalhaOficial[rodovia][k.toString().replace('.', ',')];
          if (ponto && ponto.LOCALIZAÇÃO) {
            const [lat, lng] = ponto.LOCALIZAÇÃO.split(',').map(c => parseFloat(c.trim()));
            if (!isNaN(lat) && !isNaN(lng)) pontos.push([lat, lng]);
          }
        });
      }
      // Se não encontrou pontos, usa sistema antigo
      if (pontos.length < 2) {
        const coordInicial = obterCoordenadaReal(rodovia, kmInicial);
        const coordFinal = obterCoordenadaReal(rodovia, kmFinal);
        if (coordInicial && coordFinal) {
          pontos = [
            [coordInicial.lat, coordInicial.lng],
            [coordFinal.lat, coordFinal.lng]
          ];
        } else {
          // Fallback: coordenadas baseadas em região São Paulo
          const latBase = -23.5 - (index * 0.15);
          const lngBase = -46.6 + (index * 0.2);
          pontos = [
            [latBase, lngBase],
            [latBase - 0.05, lngBase + 0.1]
          ];
        }
      }
      const linha_geom = L.polyline(pontos, {
        color: cor,
        weight: espessura,
        pane: 'rodoviasPane',
        opacity: 0.8
      });
      // Popup detalhado
      linha_geom.bindPopup(`
        <strong>🛣️ ${rodovia}</strong><br>
        📍 Km ${kmInicial.toFixed(3)} - ${kmFinal.toFixed(3)}<br>
        🎨 Cor: ${cor}<br>
        📏 Espessura: ${espessura}px<br>
        <small>📄 Dados da planilha: Linhas por Trecho</small>
      `);
      layers.linhas.addLayer(linha_geom);
      
    } catch (error) {
      console.error(`Erro ao renderizar linha ${index}:`, error, linha);
    }
  });
  
  console.log(`✅ ${dados.linhasPorTrecho.length} linhas por trecho renderizadas`);
}

/**
 * Renderiza o mapa de calor
 */
function renderizarMapaDeCalor() {
  console.log("🔥 Renderizando mapa de calor...");
  console.log("📊 Dados recebidos:", dados.mapaDeCalor);
  
  if (layers.calor) {
    mapa.removeLayer(layers.calor);
  }
  
  // Prepara dados para o heatmap usando dados reais da planilha
  const pontosCalor = dados.mapaDeCalor.map((item, index) => {
    const rodovia = item.rodovia || `Rodovia ${index + 1}`;
    const kmInicial = parseFloat(item.km_inicial) || 0;
    const kmFinal = parseFloat(item.km_final) || 0;
    const kmMedio = (kmInicial + kmFinal) / 2; // Usa o ponto médio do trecho
    
    console.log(`🔥 Processando ponto de calor: ${rodovia}, Km ${kmInicial}-${kmFinal} (médio: ${kmMedio.toFixed(3)})`);
    
    // Obtém coordenadas reais baseadas no ponto médio do trecho
    const coordReal = obterCoordenadaReal(rodovia, kmMedio);
    let lat, lng;
    
    if (coordReal) {
      lat = coordReal.lat;
      lng = coordReal.lng;
      console.log(`✅ Coordenada real para heatmap: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } else {
      // Fallback: coordenadas baseadas em região São Paulo
      lat = -23.6 - (index * 0.1);
      lng = -46.8 + (index * 0.15);
      console.warn(`⚠️ Usando coordenada fallback para heatmap: ${rodovia}`);
    }
    
    const intensidade = 0.9; // Intensidade alta para destaque
    
    return [lat, lng, intensidade];
  });
  
  if (pontosCalor.length > 0) {
    layers.calor = L.heatLayer(pontosCalor, {
      radius: 30,
      blur: 20,
      maxZoom: 17,
      pane: 'overlayPane'
    }).addTo(mapa);
    
    console.log(`✅ Mapa de calor criado com ${pontosCalor.length} pontos`);
  } else {
    console.log("⚠️ Nenhum dado para mapa de calor");
  }
}

/**
 * Renderiza os pontos de interesse
 */
function renderizarPontosDeInteresse() {
  console.log("📍 Renderizando pontos de interesse...");
  console.log("📊 Dados recebidos:", dados.pontosDeInteresse);
  
  layers.pontos.clearLayers();
  
  dados.pontosDeInteresse.forEach((ponto, index) => {
    try {
      const rodovia = ponto.rodovia || `Rodovia ${index + 1}`;
      const km = parseFloat(ponto.km) || 0;
      const obs = ponto.obs || 'Ponto de interesse';
      const cor = ponto.cor || '#FF0000';
      const opacidade = parseFloat(ponto.opacidade) || 0.8;
      const raio = parseInt(ponto.raio) || 30;
      const fotos = ponto.fotos || ''; // NOVA: coluna fotos
      
      console.log(`📍 Processando ponto: ${rodovia} Km ${km}, ${obs}, Cor: ${cor}, Raio: ${raio}m${fotos ? ', Fotos: ✓' : ''}`);
      
      // Obtém coordenadas reais baseadas na rodovia e Km
      const coordReal = obterCoordenadaReal(rodovia, km);
      let lat, lng, pontoInfo;
      if (coordReal) {
        lat = coordReal.lat;
        lng = coordReal.lng;
        pontoInfo = coordReal.ponto;
        console.log(`✅ Coordenada real encontrada: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        lat = -23.4 - (index * 0.12);
        lng = -46.4 + (index * 0.18);
        console.warn(`⚠️ Usando coordenada fallback para ${rodovia} Km ${km}`);
      }
      const circulo = L.circle([lat, lng], {
        color: cor,
        fillColor: cor,
        fillOpacity: opacidade,
        radius: raio,
        pane: 'overlayPane',
        weight: 2
      });
      // Popup simplificado com informações essenciais
      let popup = `<strong>📍 ${obs}</strong><br>
        🛣️ ${rodovia} - Km ${km.toFixed(3)}<br>`;
      
      // Adiciona município se disponível nos dados oficiais
      if (pontoInfo && pontoInfo.MUNICÍPIO) {
        popup += `📍 ${pontoInfo.MUNICÍPIO}<br>`;
      }
      
      // NOVA: Exibe fotos da coluna "fotos" da planilha pontos_de_interesse
      if (fotos && fotos.trim().length > 0) {
        // Verifica se são múltiplas URLs separadas por vírgula ou ponto e vírgula
        const urlsFotos = fotos.split(/[,;]/).map(url => url.trim()).filter(url => url.length > 0);
        
        if (urlsFotos.length > 0) {
          urlsFotos.forEach((fotoUrl, indexFoto) => {
            if (fotoUrl.startsWith('http')) {
              popup += `<a href='${fotoUrl}' target='_blank' style='color:#1976d2;text-decoration:underline;font-size:13px;'>📷 ${urlsFotos.length > 1 ? `Foto ${indexFoto + 1}` : 'Ver Foto'}</a><br>`;
            }
          });
        }
      }
      
      popup += `<a href='https://www.google.com/maps/search/?api=1&query=${lat},${lng}' target='_blank' style='color:#1976d2;text-decoration:underline;'>🗺️ Ver no Maps</a>`;
      circulo.bindPopup(popup);
      layers.pontos.addLayer(circulo);
      
    } catch (error) {
      console.error(`Erro ao renderizar ponto ${index}:`, error, ponto);
    }
  });
  
  console.log(`✅ ${dados.pontosDeInteresse.length} pontos de interesse renderizados`);
}

// ═══════════════════════ 6) Funções Utilitárias

/**
 * Mostra notificação para o usuário
 */
function mostrarNotificacao(mensagem, tipo = 'info') {
  const div = document.createElement('div');
  div.className = `notificacao notificacao-${tipo}`;
  div.innerHTML = `
    <span>${mensagem}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  
  // Adiciona estilos se não existirem
  if (!document.getElementById('notificacao-styles')) {
    const style = document.createElement('style');
    style.id = 'notificacao-styles';
    style.textContent = `
      .notificacao {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
      }
      .notificacao-info { background: #2196F3; }
      .notificacao-error { background: #f44336; }
      .notificacao-success { background: #4CAF50; }
      .notificacao button {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(div);
  
  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (div.parentElement) {
      div.remove();
    }
  }, 5000);
}

/**
 * Controles do mapa
 */
function adicionarControles() {
  const controles = L.control({ position: 'topleft' });
  
  controles.onAdd = function() {
    const div = L.DomUtil.create('div', 'controles-mapa');
    div.innerHTML = `
      <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h4 style="margin: 0 0 8px 0; color: #1976d2;">📊 Camadas</h4>
        <label style="display: block; margin: 4px 0; cursor: pointer;">
          <input type="checkbox" id="toggle-linhas" checked> 🛣️ Linhas por Trecho
        </label>
        <label style="display: block; margin: 4px 0; cursor: pointer;">
          <input type="checkbox" id="toggle-calor" checked> 🔥 Mapa de Calor
        </label>
        <label style="display: block; margin: 4px 0; cursor: pointer;">
          <input type="checkbox" id="toggle-pontos" checked> 📍 Pontos de Interesse
        </label>
        <button id="recarregar-dados" style="margin-top: 8px; padding: 6px 12px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          🔄 Recarregar Dados
        </button>
      </div>
    `;
    
    // Previne propagação de eventos do mapa
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    
    return div;
  };
  
  controles.addTo(mapa);
  
  // Event listeners para os controles
  setTimeout(() => {
    document.getElementById('toggle-linhas')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        mapa.addLayer(layers.linhas);
      } else {
        mapa.removeLayer(layers.linhas);
      }
    });
    
    document.getElementById('toggle-calor')?.addEventListener('change', (e) => {
      if (e.target.checked && layers.calor) {
        mapa.addLayer(layers.calor);
      } else if (layers.calor) {
        mapa.removeLayer(layers.calor);
      }
    });
    
    document.getElementById('toggle-pontos')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        mapa.addLayer(layers.pontos);
      } else {
        mapa.removeLayer(layers.pontos);
      }
    });
    
    document.getElementById('recarregar-dados')?.addEventListener('click', () => {
      mostrarNotificacao("🔄 Recarregando dados...", "info");
      carregarTodosDados();
    });
  }, 100);
}

// ═══════════════════════ 6) Carregamento de Shapefiles

// Helper para adicionar rótulos
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: "", html: `<div class='${cls}'>${txt}</div>`, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

/**
 * Carrega shapefiles das RCs
 */
async function carregarRC() {
  console.log("🗺️ Carregando shapefiles das RCs...");
  
  const rcList = [
    "assets/data/RC_2.1.zip",
    "assets/data/RC_2.2.zip", 
    "assets/data/RC_2.4.zip",
    "assets/data/RC_2.5.zip",
    "assets/data/RC_2.6_2.8.zip",
    "assets/data/RC_2.7.zip",
  ];

  for (const p of rcList) {
    try {
      if (typeof shp !== 'undefined') {
        const geo = await shp(p);
        const name = p.match(/RC_[\d._]+/)[0].replace("_", " ");
        rcLayers[name] = L.geoJSON(geo, {
          pane: "shapefilePane",
          style: { color: "#000", weight: 2.5, fill: false },
        }).addTo(mapa);
        addLabel(rcLayers[name].getBounds().getCenter(), name, "rc-label");
        console.log(`✅ RC carregado: ${name}`);
      }
    } catch (err) {
      console.warn(`❌ Erro ao carregar RC ${p}:`, err);
    }
  }

  carregarMalha();
}

/**
 * Carrega malha rodoviária DR.02
 */
async function carregarMalha() {
  console.log("🛣️ Carregando malha rodoviária...");
  
  const MALHA_PATH = "assets/data/malha_dr02.kmz";
  try {
    if (typeof JSZip !== 'undefined' && typeof toGeoJSON !== 'undefined') {
      const resp = await fetch(MALHA_PATH);
      if (!resp.ok) throw new Error(`404 – não achei ${MALHA_PATH}`);

      const zip = await JSZip.loadAsync(await resp.arrayBuffer());
      const kmlFile = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith(".kml"));
      if (!kmlFile) throw new Error(".kml ausente dentro do KMZ");

      const xml = await zip.file(kmlFile).async("string");
      const geo = toGeoJSON.kml(new DOMParser().parseFromString(xml, "text/xml"));

      // Remove labels antigos das rodovias
      rodLabels.forEach((l) => mapa.removeLayer(l));
      rodLabels = [];
      
      geo.features
        .filter((f) => f.geometry && ["LineString", "MultiLineString"].includes(f.geometry.type))
        .forEach((feat) => {
          const nomeCompleto = (feat.properties?.name || "Rodovia").replaceAll("_", " ").trim();
          // Extrai sempre o nome completo para SPA (ex: SPA 294/250)
          let nome = nomeCompleto;
          if (/SPA/i.test(nomeCompleto)) {
            // Se houver barra, pega tudo após SPA
            const spaMatch = nomeCompleto.match(/SPA ?\d+\/\d+/);
            if (spaMatch) {
              nome = spaMatch[0];
            } else {
              // Se não houver barra, pega SPA + número
              const spaSimple = nomeCompleto.match(/SPA ?\d+/);
              if (spaSimple) nome = spaSimple[0];
            }
          } else {
            // Para SP, pega SP + número
            const spMatch = nomeCompleto.match(/SP ?\d+/);
            if (spMatch) nome = spMatch[0];
          }
          // Adiciona o label e armazena referência
          if (typeof turf !== 'undefined') {
            rodLayers[nomeCompleto] = L.geoJSON(turf.simplify(feat, { tolerance: 0.00005 }), {
              pane: "rodoviasPane",
              style: { color: "#555", weight: 3, opacity: 0.9 },
            }).addTo(mapa);
          } else {
            rodLayers[nomeCompleto] = L.geoJSON(feat, {
              pane: "rodoviasPane", 
              style: { color: "#555", weight: 3, opacity: 0.9 },
            }).addTo(mapa);
          }
          // Evita sobreposição: empilha os labels com classe .stacked
          const label = addLabel(rodLayers[nomeCompleto].getBounds().getCenter(), nome, "rod-label stacked");
          rodLabels.push(label);
        });
        
      console.log(`✅ Malha rodoviária carregada com ${Object.keys(rodLayers).length} rodovias`);
    }
  } catch (err) {
    console.warn("❌ Erro ao carregar malha rodoviária:", err);
  }
}

// ═══════════════════════ 7) Inicialização

/**
 * Inicializa o sistema quando o DOM estiver pronto
 */
function inicializar() {
  console.log("🚀 Inicializando sistema DR.02...");
  
  // Adiciona controles
  adicionarControles();
  
  // Carrega dados iniciais
  carregarTodosDados();
  
  // Carrega shapefiles (RCs e malha rodoviária)
  setTimeout(() => {
    carregarRC();
  }, 1000);
  
  // Mostra notificação de boas-vindas
  mostrarNotificacao("🗺️ Sistema DR.02 carregado! Dados colaborativos atualizados.", "success");
}

// Aguarda todas as dependências estarem carregadas
if (typeof Papa !== 'undefined' && typeof L !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
} else {
  console.log("⏳ Aguardando dependências carregar...");
  setTimeout(inicializar, 1000);
}

// ═══════════════════════ 8) Exporta funções para uso global
window.carregarTodosDados = carregarTodosDados;
window.mostrarNotificacao = mostrarNotificacao;

console.log("✅ Script DR.02 Sistema Colaborativo inicializado!");
