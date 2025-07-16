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

// ═══════════════════════ 4) Funções de Carregamento de Dados

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
 * Carrega todos os CSVs
 */
async function carregarTodosDados() {
  console.log("🚀 Iniciando carregamento de dados...");
  
  try {
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
    
    // Mensagem específica baseada no tipo de erro
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
      
      // TEMPORÁRIO: Coordenadas baseadas em região São Paulo
      // TODO: Integrar com sistema de coordenadas real baseado em rodovia e Km
      const latBase = -23.5 - (index * 0.15);
      const lngBase = -46.6 + (index * 0.2);
      
      const linha_geom = L.polyline([
        [latBase, lngBase],
        [latBase - 0.05, lngBase + 0.1]
      ], {
        color: cor,
        weight: espessura,
        pane: 'rodoviasPane',
        opacity: 0.8
      });
      
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
    
    console.log(`🔥 Processando ponto de calor: ${rodovia}, Km ${kmInicial}-${kmFinal}`);
    
    // TEMPORÁRIO: Coordenadas baseadas em região São Paulo  
    // TODO: Integrar com sistema de coordenadas real baseado em rodovia e Km
    const lat = -23.6 - (index * 0.1);
    const lng = -46.8 + (index * 0.15);
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
      
      console.log(`📍 Processando ponto: ${rodovia} Km ${km}, ${obs}, Cor: ${cor}, Raio: ${raio}m`);
      
      // TEMPORÁRIO: Coordenadas baseadas em região São Paulo
      // TODO: Integrar com sistema de coordenadas real baseado em rodovia e Km
      const lat = -23.4 - (index * 0.12);
      const lng = -46.4 + (index * 0.18);
      
      const circulo = L.circle([lat, lng], {
        color: cor,
        fillColor: cor,
        fillOpacity: opacidade,
        radius: raio,
        pane: 'overlayPane',
        weight: 2
      });
      
      circulo.bindPopup(`
        <strong>📍 ${obs}</strong><br>
        🛣️ ${rodovia} - Km ${km.toFixed(3)}<br>
        🎨 ${cor} (${(opacidade * 100).toFixed(0)}% opacidade)<br>
        📏 Raio: ${raio}m<br>
        📄 <small>Dados da planilha: Pontos de Interesse</small>
      `);
      
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
    "../data/RC_2.1.zip",
    "../data/RC_2.2.zip", 
    "../data/RC_2.4.zip",
    "../data/RC_2.5.zip",
    "../data/RC_2.6_2.8.zip",
    "../data/RC_2.7.zip",
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
  
  const MALHA_PATH = "../data/malha_dr02.kmz";
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
          // Extrai "SPA 294/250", "SPA 294" ou "SP 250" do nome
          const nome = nomeCompleto.match(/SPA ?\d+\/\d+|SPA ?\d+|SP ?\d+/i)?.[0] || nomeCompleto;
          
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
          
          // Adiciona o label e armazena referência
          const label = addLabel(rodLayers[nomeCompleto].getBounds().getCenter(), nome, "rod-label");
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
