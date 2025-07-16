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

let dados = {
  linhasPorTrecho: [],
  mapaDeCalor: [],
  pontosDeInteresse: []
};

// ═══════════════════════ 3) URLs dos CSVs
const CSV_URLS = {
  // URLs para produção (GitHub Pages)
  linhasPorTrecho: '../data/linhas_por_trecho.csv',
  mapaDeCalor: '../data/mapa_de_calor.csv', 
  pontosDeInteresse: '../data/pontos_de_interesse.csv'
};

// ═══════════════════════ 4) Funções de Carregamento de Dados

/**
 * Carrega um CSV e retorna os dados parseados
 */
async function carregarCSV(url, nome) {
  console.log(`📊 Carregando ${nome}...`);
  
  try {
    const response = await fetch(url);
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
    
    // Renderiza os dados no mapa
    renderizarLinhasPorTrecho();
    renderizarMapaDeCalor();
    renderizarPontosDeInteresse();
    
    console.log("🎉 Todos os dados carregados e renderizados com sucesso!");
    
  } catch (error) {
    console.error("💥 Erro ao carregar dados:", error);
    mostrarNotificacao("Erro ao carregar dados. Verifique a conexão.", "error");
  }
}

// ═══════════════════════ 5) Funções de Renderização

/**
 * Renderiza as linhas por trecho
 */
function renderizarLinhasPorTrecho() {
  console.log("🛣️ Renderizando linhas por trecho...");
  
  layers.linhas.clearLayers();
  
  dados.linhasPorTrecho.forEach((linha, index) => {
    try {
      const kmInicial = parseFloat(linha.km_inicial);
      const kmFinal = parseFloat(linha.km_final);
      const cor = linha.cor || '#0000FF';
      const espessura = parseInt(linha.espessura) || 3;
      
      // Para demonstração, criamos uma linha simples
      // Em produção, você integraria com dados de coordenadas reais
      const latInicial = -23.8 + (index * 0.1);
      const latFinal = latInicial + 0.05;
      const lngInicial = -48.5 + (index * 0.1);
      const lngFinal = lngInicial + 0.05;
      
      const linha_geom = L.polyline([
        [latInicial, lngInicial],
        [latFinal, lngFinal]
      ], {
        color: cor,
        weight: espessura,
        pane: 'rodoviasPane'
      });
      
      linha_geom.bindPopup(`
        <strong>🛣️ ${linha.rodovia}</strong><br>
        📍 Km ${kmInicial} - ${kmFinal}<br>
        🎨 Cor: ${cor}<br>
        📏 Espessura: ${espessura}
      `);
      
      layers.linhas.addLayer(linha_geom);
      
    } catch (error) {
      console.error(`Erro ao renderizar linha ${index}:`, error);
    }
  });
  
  console.log(`✅ ${dados.linhasPorTrecho.length} linhas renderizadas`);
}

/**
 * Renderiza o mapa de calor
 */
function renderizarMapaDeCalor() {
  console.log("🔥 Renderizando mapa de calor...");
  
  if (layers.calor) {
    mapa.removeLayer(layers.calor);
  }
  
  // Prepara dados para o heatmap
  const pontosCalor = dados.mapaDeCalor.map((item, index) => {
    const lat = -23.8 + (index * 0.05);
    const lng = -48.5 + (index * 0.05);
    const intensidade = 0.8; // Intensidade base
    
    return [lat, lng, intensidade];
  });
  
  if (pontosCalor.length > 0) {
    layers.calor = L.heatLayer(pontosCalor, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      pane: 'overlayPane'
    }).addTo(mapa);
    
    console.log(`✅ Mapa de calor criado com ${pontosCalor.length} pontos`);
  }
}

/**
 * Renderiza os pontos de interesse
 */
function renderizarPontosDeInteresse() {
  console.log("📍 Renderizando pontos de interesse...");
  
  layers.pontos.clearLayers();
  
  dados.pontosDeInteresse.forEach((ponto, index) => {
    try {
      const km = parseFloat(ponto.km);
      const cor = ponto.cor || '#FF0000';
      const opacidade = parseFloat(ponto.opacidade) || 0.8;
      const raio = parseInt(ponto.raio) || 30;
      
      // Para demonstração, calculamos coordenadas baseadas no índice
      // Em produção, você usaria coordenadas reais baseadas na rodovia e km
      const lat = -23.8 + (index * 0.08);
      const lng = -48.5 + (index * 0.08);
      
      const circulo = L.circle([lat, lng], {
        color: cor,
        fillColor: cor,
        fillOpacity: opacidade,
        radius: raio,
        pane: 'overlayPane'
      });
      
      circulo.bindPopup(`
        <strong>📍 ${ponto.obs}</strong><br>
        🛣️ ${ponto.rodovia} - Km ${km}<br>
        🎨 ${cor} (${(opacidade * 100).toFixed(0)}%)<br>
        📏 Raio: ${raio}m
      `);
      
      layers.pontos.addLayer(circulo);
      
    } catch (error) {
      console.error(`Erro ao renderizar ponto ${index}:`, error);
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
