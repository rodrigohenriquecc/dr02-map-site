/* Google Maps - Sistema de Localização CGR 02 */

console.log("🗺️ DR.02 - Sistema Google Maps carregado (v3.0)");

// ═══════════════════════ 1) Variáveis Globais
let mapa;
let marcadores = [];
let poligonosRC = [];
let linhasRodovias = [];
let marcadorUsuario = null;
let circuloPrecisao = null;
let infoWindow;

// Dados
let dadosPlanilhaOficial = [];
let rodoviasPlanilha = [];
let kmsPorRodovia = {};
let metadadosRodovias = {};

// ═══════════════════════ 2) Função para carregar sistema completo
function carregarSistemaCompleto(mapaExistente) {
  console.log("🚀 Carregando sistema completo...");
  
  // Usar o mapa já criado
  mapa = mapaExistente;
    zoom: 7,
    center: { lat: -23.8, lng: -48.5 },
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    
    // ═══ ESTILOS PERSONALIZADOS ═══
    styles: [
      // Ocultar POIs desnecessários
      {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.medical",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.place_of_worship",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      },
      // Melhorar contraste das estradas
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [
          { color: "#2c5aa0" },
          { weight: 3 }
        ]
      },
      {
        featureType: "road.highway",
        elementType: "labels",
        stylers: [
          { color: "#1a237e" },
          { weight: "bold" }
        ]
      },
      // Destacar rodovias estaduais
      {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [
          { color: "#1976d2" },
          { weight: 2 }
        ]
      },
      // Água mais azul
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#1565c0" }]
      },
      // Vegetação mais verde
      {
        featureType: "landscape.natural",
        elementType: "geometry",
        stylers: [{ color: "#66bb6a" }]
      }
    ],
    
    // ═══ CONTROLES AVANÇADOS ═══
    gestureHandling: "greedy", // Permite zoom com scroll direto
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
      style: google.maps.ZoomControlStyle.LARGE
    },
    mapTypeControl: true,
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.TOP_LEFT,
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
      mapTypeIds: [
        google.maps.MapTypeId.ROADMAP,
        google.maps.MapTypeId.SATELLITE,
        google.maps.MapTypeId.HYBRID,
        google.maps.MapTypeId.TERRAIN
      ]
    },
    scaleControl: true,
    scaleControlOptions: {
      position: google.maps.ControlPosition.BOTTOM_LEFT
    },
    streetViewControl: true,
    streetViewControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    },
    rotateControl: false,
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.TOP_RIGHT
    },
    
    // ═══ CONFIGURAÇÕES DE PERFORMANCE ═══
    clickableIcons: false, // Desabilita cliques em ícones padrão do Google
    keyboardShortcuts: true,
    disableDoubleClickZoom: false,
    draggable: true,
    scrollwheel: true,
    
    // ═══ LIMITES DE ZOOM PARA PERFORMANCE ═══
    minZoom: 6,  // Não permitir zoom muito distante
    maxZoom: 18, // Zoom máximo para detalhes
    
    // ═══ RESTRIÇÕES DE ÁREA (opcional) ═══
    restriction: {
      latLngBounds: {
        north: -19.0, // Norte de SP
        south: -26.0, // Sul de SP
        west: -54.0,  // Oeste de SP
        east: -44.0   // Leste de SP
      },
      strictBounds: false
    }
  });

  // ═══ CRIAR INFOWINDOW AVANÇADA ═══
  infoWindow = new google.maps.InfoWindow({
    maxWidth: 300,
    pixelOffset: new google.maps.Size(0, -10)
  });

  // ═══ ADICIONAR CONTROLES CUSTOMIZADOS ═══
  adicionarControlesCustomizados();

  // Expor globalmente
  window.mapa = mapa;
  
  console.log("✅ Google Maps inicializado com sucesso!");
  
  // Carregar dados após mapa estar pronto
  carregarDadosCompletos();
}

// ═══════════════════════ 2.1) Controles Customizados
function adicionarControlesCustomizados() {
  // Botão para centralizar no Estado de SP
  const btnCentralizar = document.createElement('button');
  btnCentralizar.innerHTML = '🎯 SP';
  btnCentralizar.title = 'Centralizar no Estado de São Paulo';
  btnCentralizar.style.cssText = `
    background: #fff;
    border: 2px solid #1976d2;
    border-radius: 6px;
    margin: 8px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: bold;
    color: #1976d2;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: all 0.2s;
  `;
  
  btnCentralizar.addEventListener('mouseover', () => {
    btnCentralizar.style.background = '#1976d2';
    btnCentralizar.style.color = '#fff';
  });
  
  btnCentralizar.addEventListener('mouseout', () => {
    btnCentralizar.style.background = '#fff';
    btnCentralizar.style.color = '#1976d2';
  });
  
  btnCentralizar.addEventListener('click', () => {
    mapa.setCenter({ lat: -23.8, lng: -48.5 });
    mapa.setZoom(7);
    mostrarMensagemDiscreta('🎯 Centralizado no Estado de São Paulo');
  });
  
  mapa.controls[google.maps.ControlPosition.TOP_CENTER].push(btnCentralizar);
  
  // Indicador de escala melhorado
  const indicadorEscala = document.createElement('div');
  indicadorEscala.style.cssText = `
    background: rgba(255,255,255,0.9);
    padding: 6px 12px;
    margin: 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    color: #333;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    backdrop-filter: blur(5px);
  `;
  
  function atualizarEscala() {
    const zoom = mapa.getZoom();
    let escala = '';
    if (zoom >= 14) escala = '🔍 Detalhado';
    else if (zoom >= 11) escala = '🏘️ Bairros';
    else if (zoom >= 8) escala = '🏙️ Cidades';
    else if (zoom >= 6) escala = '🗺️ Regional';
    else escala = '🌍 Geral';
    
    indicadorEscala.innerHTML = `Zoom: ${zoom} • ${escala}`;
  }
  
  google.maps.event.addListener(mapa, 'zoom_changed', atualizarEscala);
  atualizarEscala();
  
  mapa.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(indicadorEscala);
}

// ═══════════════════════ 3) Carregamento de Dados
async function carregarPlanilhaOficial() {
  try {
    console.log("📊 Carregando PLANILHA BI - OFICIAL.csv...");
    const response = await fetch('archives/assets/data/PLANILHA BI - OFICIAL.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        transform: (value) => value.trim(),
        complete: (results) => {
          dadosPlanilhaOficial = results.data;
          
          // Criar índice por rodovia e km
          kmsPorRodovia = {};
          dadosPlanilhaOficial.forEach(linha => {
            const rod = linha.SP?.trim();
            const kmStr = linha['KM ']?.replace(',', '.');
            const km = parseFloat(kmStr);
            if (!rod || isNaN(km)) return;
            
            if (!kmsPorRodovia[rod]) kmsPorRodovia[rod] = [];
            kmsPorRodovia[rod].push({
              ...linha,
              km,
              lat: parseFloat((linha.LOCALIZAÇÃO||'').split(',')[0]),
              lng: parseFloat((linha.LOCALIZAÇÃO||'').split(',')[1])
            });
          });
          
          // Ordenar kms
          Object.values(kmsPorRodovia).forEach(arr => arr.sort((a,b) => a.km - b.km));
          
          rodoviasPlanilha = [...new Set(dadosPlanilhaOficial.map(l => l.SP?.trim()).filter(Boolean))];
          
          console.log(`✅ PLANILHA BI - OFICIAL carregada: ${dadosPlanilhaOficial.length} pontos`);
          resolve();
        },
        error: reject
      });
    });
  } catch (error) {
    console.error('❌ Erro ao carregar PLANILHA BI - OFICIAL:', error);
    throw error;
  }
}

async function carregarMetadadosRodovias() {
  try {
    console.log("📊 Carregando metadados das rodovias (meta.csv)...");
    const response = await fetch('archives/assets/data/meta.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const csvText = await response.text();
    
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          metadadosRodovias = {};
          data.forEach(row => {
            const rodovia = row.Rodovia?.trim();
            if (!rodovia) return;
            
            const kmInicial = parseFloat(row['Km Inicial']?.replace(',', '.'));
            const kmFinal = parseFloat(row['Km Final']?.replace(',', '.'));
            const [latInicial, lngInicial] = row['Lat e Long km Inicial']?.split(',').map(c => parseFloat(c.trim())) || [];
            const [latFinal, lngFinal] = row['Lat e Long km final']?.split(',').map(c => parseFloat(c.trim())) || [];
            
            if (!isNaN(kmInicial) && !isNaN(kmFinal) && !isNaN(latInicial) && !isNaN(lngInicial) && !isNaN(latFinal) && !isNaN(lngFinal)) {
              if (!metadadosRodovias[rodovia]) metadadosRodovias[rodovia] = [];
              metadadosRodovias[rodovia].push({
                kmInicial, kmFinal,
                coordInicial: { lat: latInicial, lng: lngInicial },
                coordFinal: { lat: latFinal, lng: lngFinal }
              });
            }
          });
          
          Object.values(metadadosRodovias).forEach(trechos => 
            trechos.sort((a, b) => a.kmInicial - b.kmInicial)
          );
          
          console.log('✅ Metadados carregados:', Object.keys(metadadosRodovias).length, 'rodovias');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('❌ Erro ao carregar metadados:', error);
  }
}

async function carregarShapefilesRC() {
  console.log("🗺️ Carregando shapefiles das RCs...");
  
  const rcList = [
    "archives/assets/data/RC_2.1.zip",
    "archives/assets/data/RC_2.2.zip", 
    "archives/assets/data/RC_2.4.zip",
    "archives/assets/data/RC_2.5.zip",
    "archives/assets/data/RC_2.6_2.8.zip",
    "archives/assets/data/RC_2.7.zip",
  ];

  for (const rcPath of rcList) {
    try {
      const response = await fetch(rcPath);
      if (!response.ok) continue;
      
      const arrayBuffer = await response.arrayBuffer();
      const geojson = await shp(arrayBuffer);
      
      const rcNome = rcPath.match(/RC_([\d._]+)/)?.[1] || 'Desconhecida';
      
      geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'Polygon') {
          const paths = feature.geometry.coordinates[0].map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }));
          
          const polygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: getCorRC(rcNome),
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: getCorRC(rcNome),
            fillOpacity: 0.15,
            map: mapa
          });
          
          // Adicionar label da RC
          const bounds = new google.maps.LatLngBounds();
          paths.forEach(path => bounds.extend(path));
          const center = bounds.getCenter();
          
          const label = new google.maps.Marker({
            position: center,
            map: mapa,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">
                  <rect width="40" height="20" fill="rgba(0,0,0,0.7)" rx="3"/>
                  <text x="20" y="14" text-anchor="middle" fill="white" font-size="8" font-weight="bold">RC ${rcNome}</text>
                </svg>
              `),
              anchor: new google.maps.Point(20, 10)
            }
          });
          
          poligonosRC.push({ polygon, label, nome: rcNome });
        }
      });
      
      console.log(`✅ RC ${rcNome} carregada`);
    } catch (error) {
      console.error(`❌ Erro ao carregar ${rcPath}:`, error);
    }
  }
}

async function carregarMalhaRodoviaria() {
  console.log("🛣️ Carregando malha rodoviária...");
  
  try {
    const response = await fetch("archives/assets/data/malha_dr02.kmz");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    for (const filename of Object.keys(zip.files)) {
      if (filename.endsWith('.kml')) {
        const kmlText = await zip.file(filename).async('text');
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
        const geojson = toGeoJSON.kml(kmlDoc);
        
        geojson.features.forEach(feature => {
          if (feature.geometry && feature.geometry.type === 'LineString') {
            const path = feature.geometry.coordinates.map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }));
            
            const rodovia = feature.properties?.name || 'Rodovia';
            
            const polyline = new google.maps.Polyline({
              path: path,
              geodesic: true,
              strokeColor: '#2196F3',
              strokeOpacity: 0.8,
              strokeWeight: 3,
              map: mapa
            });
            
            // Adicionar label da rodovia no meio da linha
            if (path.length > 2) {
              const midIndex = Math.floor(path.length / 2);
              const label = new google.maps.Marker({
                position: path[midIndex],
                map: mapa,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="16">
                      <rect width="60" height="16" fill="rgba(255,255,255,0.9)" stroke="#ccc" rx="2"/>
                      <text x="30" y="11" text-anchor="middle" fill="black" font-size="8" font-weight="bold">${rodovia}</text>
                    </svg>
                  `),
                  anchor: new google.maps.Point(30, 8)
                }
              });
              
              linhasRodovias.push({ polyline, label, nome: rodovia });
            }
          }
        });
        
        console.log('✅ Malha rodoviária carregada');
        break;
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar malha rodoviária:', error);
  }
}

function getCorRC(rcNome) {
  const cores = {
    '2.1': '#E91E63',
    '2.2': '#9C27B0', 
    '2.4': '#3F51B5',
    '2.5': '#2196F3',
    '2.6_2.8': '#00BCD4',
    '2.7': '#4CAF50'
  };
  return cores[rcNome] || '#757575';
}

// ═══════════════════════ 4) Sistema de Geolocalização
let geolocalizacaoAtiva = false;
let watchId = null;

function verificarSuporteGeolocalizacao() {
  if (!navigator.geolocation) {
    mostrarMensagemDiscreta('Geolocalização não suportada pelo navegador', 3000);
    return false;
  }
  return true;
}

function atualizarPosicaoUsuario(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const precisao = position.coords.accuracy;
  
  if (!mapa) {
    setTimeout(() => atualizarPosicaoUsuario(position), 100);
    return;
  }
  
  // Remove marcadores anteriores
  if (marcadorUsuario) {
    marcadorUsuario.setMap(null);
  }
  if (circuloPrecisao) {
    circuloPrecisao.setMap(null);
  }
  
  // Adiciona marcador do usuário
  marcadorUsuario = new google.maps.Marker({
    position: { lat, lng },
    map: mapa,
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
          <circle cx="10" cy="10" r="8" fill="#4285f4" stroke="white" stroke-width="3"/>
          <circle cx="10" cy="10" r="3" fill="white"/>
        </svg>
      `),
      anchor: new google.maps.Point(10, 10)
    },
    title: 'Sua Localização'
  });
  
  // Adiciona círculo de precisão
  circuloPrecisao = new google.maps.Circle({
    strokeColor: '#4285f4',
    strokeOpacity: 0.5,
    strokeWeight: 2,
    fillColor: '#4285f4',
    fillOpacity: 0.1,
    map: mapa,
    center: { lat, lng },
    radius: precisao
  });
  
  // Atualiza informações na interface
  const geoStatus = document.getElementById('geoStatus');
  const geoCoordenadas = document.getElementById('geoCoordenadas');
  
  if (geoStatus) geoStatus.textContent = `Localização ativa (±${Math.round(precisao)}m)`;
  if (geoCoordenadas) geoCoordenadas.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  
  // Popup no marcador
  marcadorUsuario.addListener('click', () => {
    infoWindow.setContent(`
      <div style="text-align: center; font-size: 14px;">
        <strong>📍 Sua Localização</strong><br>
        <span style="font-size: 12px; color: #666;">
          Lat: ${lat.toFixed(6)}<br>
          Lng: ${lng.toFixed(6)}<br>
          Precisão: ±${Math.round(precisao)}m
        </span><br>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" 
           style="color: #1976d2; text-decoration: underline; font-size: 12px;">
          Abrir no Google Maps
        </a>
      </div>
    `);
    infoWindow.open(mapa, marcadorUsuario);
  });
}

function erroGeolocalizacao(error) {
  let mensagem = 'Erro ao obter localização';
  
  switch(error.code) {
    case error.PERMISSION_DENIED:
      mensagem = 'Permissão de localização negada';
      break;
    case error.POSITION_UNAVAILABLE:
      mensagem = 'Localização indisponível';
      break;
    case error.TIMEOUT:
      mensagem = 'Timeout na obtenção da localização';
      break;
  }
  
  mostrarMensagemDiscreta(mensagem, 3000);
  pararGeolocalizacao();
}

function iniciarGeolocalizacao() {
  if (!verificarSuporteGeolocalizacao()) return;
  
  const opcoes = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000
  };
  
  geolocalizacaoAtiva = true;
  
  watchId = navigator.geolocation.watchPosition(
    atualizarPosicaoUsuario,
    erroGeolocalizacao,
    opcoes
  );
  
  // Atualiza interface
  const btn = document.getElementById('btnGeolocalizacao');
  const info = document.getElementById('geolocalizacaoInfo');
  const status = document.getElementById('geoStatus');
  
  if (btn) {
    btn.classList.add('ativo');
    btn.innerHTML = '🔴';
    btn.title = 'Parar rastreamento de localização';
  }
  if (info) info.classList.add('ativo');
  if (status) status.textContent = 'Obtendo localização...';
  
  mostrarMensagemDiscreta('Rastreamento de localização ativado', 2000);
}

function pararGeolocalizacao() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  geolocalizacaoAtiva = false;
  
  // Remove marcadores do mapa
  if (marcadorUsuario) {
    marcadorUsuario.setMap(null);
    marcadorUsuario = null;
  }
  if (circuloPrecisao) {
    circuloPrecisao.setMap(null);
    circuloPrecisao = null;
  }
  
  // Atualiza interface
  const btn = document.getElementById('btnGeolocalizacao');
  const info = document.getElementById('geolocalizacaoInfo');
  const status = document.getElementById('geoStatus');
  
  if (btn) {
    btn.classList.remove('ativo');
    btn.innerHTML = '📍';
    btn.title = 'Ativar localização em tempo real';
  }
  if (info) info.classList.remove('ativo');
  if (status) status.textContent = 'Clique para ativar localização';
  
  const geoCoordenadas = document.getElementById('geoCoordenadas');
  if (geoCoordenadas) geoCoordenadas.textContent = '';
  
  mostrarMensagemDiscreta('Rastreamento de localização desativado', 2000);
}

function centralizarNaLocalizacao() {
  if (!verificarSuporteGeolocalizacao()) return;
  
  mostrarMensagemDiscreta('Obtendo sua localização...', 2000);
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      if (mapa) {
        mapa.setCenter({ lat, lng });
        mapa.setZoom(16);
        mostrarMensagemDiscreta('Mapa centralizado na sua localização', 2000);
      }
    },
    erroGeolocalizacao,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

// ═══════════════════════ 5) Sistema de Busca por Km
function preencherRodoviasFiltroOficial() {
  const select = document.getElementById('filtroRodovia');
  if (!select) return;
  
  select.innerHTML = '<option value="">Rodovia</option>';
  if (!Array.isArray(dadosPlanilhaOficial)) return;
  
  const rodoviasUnicas = [...new Set(dadosPlanilhaOficial.map(l => l.SP?.trim()).filter(Boolean))].sort();
  rodoviasUnicas.forEach(r => {
    if (r && r.length > 0) {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      select.appendChild(opt);
    }
  });
}

function atualizarListaKmOficial() {
  const rod = document.getElementById('filtroRodovia')?.value;
  const kmSelect = document.getElementById('filtroKm');
  if (!kmSelect) return;
  
  kmSelect.innerHTML = '<option value="">Selecione o Km</option>';
  if (!rod || !Array.isArray(dadosPlanilhaOficial)) {
    kmSelect.disabled = true;
    const btn = document.getElementById('filtroKmBtn');
    if (btn) btn.disabled = true;
    return;
  }
  
  const arr = dadosPlanilhaOficial.filter(l => (l.SP?.trim() === rod) && (l['KM '] || l.Km));
  arr.forEach(p => {
    let kmNum = p['KM '] ? parseFloat(p['KM '].replace(',', '.')) : (p.Km ? parseFloat(p.Km.replace(',', '.')) : NaN);
    if (!isNaN(kmNum)) {
      const opt = document.createElement('option');
      opt.value = kmNum.toFixed(3);
      opt.textContent = kmNum.toFixed(3);
      kmSelect.appendChild(opt);
    }
  });
  
  kmSelect.disabled = arr.length === 0;
  const btn = document.getElementById('filtroKmBtn');
  if (btn) btn.disabled = arr.length === 0;
}

// ═══════════════════════ 6) Carregamento Inicial
async function carregarDadosCompletos() {
  try {
    console.log("🔄 Iniciando carregamento completo dos dados...");
    
    await Promise.all([
      carregarPlanilhaOficial(),
      carregarMetadadosRodovias()
    ]);
    
    // Preencher filtros após carregar dados
    preencherRodoviasFiltroOficial();
    
    // Carregar camadas visuais
    await Promise.all([
      carregarShapefilesRC(),
      carregarMalhaRodoviaria()
    ]);
    
    console.log("✅ Todos os dados foram carregados com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro no carregamento:", error);
  }
}

// ═══════════════════════ 7) Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Event listener para filtro de rodovia
  const filtroRodovia = document.getElementById('filtroRodovia');
  if (filtroRodovia) {
    filtroRodovia.addEventListener('change', atualizarListaKmOficial);
  }
  
  // Event listener para botão de busca
  const filtroKmBtn = document.getElementById('filtroKmBtn');
  if (filtroKmBtn) {
    filtroKmBtn.addEventListener('click', function() {
      const rod = document.getElementById('filtroRodovia')?.value;
      const kmSelect = document.getElementById('filtroKm');
      const quadroFoto = document.getElementById('quadroFotoKm');
      
      if (quadroFoto) quadroFoto.style.display = 'none';
      
      if (!rod || !kmSelect?.value) {
        alert('Selecione uma rodovia e um Km válido!');
        return;
      }
      
      const arr = kmsPorRodovia[rod] || [];
      if (!arr.length) {
        alert('Dados não encontrados para esta rodovia!');
        return;
      }
      
      let km = parseFloat(kmSelect.value.replace(',', '.'));
      let ponto = arr.find(p => p.km.toFixed(3) === km.toFixed(3));
      let usouProximo = false;
      
      if (!ponto) {
        ponto = arr.reduce((prev, curr) => 
          Math.abs(curr.km - km) < Math.abs(prev.km - km) ? curr : prev, arr[0]
        );
        km = ponto.km;
        usouProximo = true;
      }
      
      if (usouProximo) {
        const msgKmProximo = document.getElementById('msgKmProximo');
        if (msgKmProximo) {
          msgKmProximo.textContent = `Km não disponível. Mostrando informações do Km mais próximo: ${ponto.km.toFixed(3)}`;
          msgKmProximo.style.display = '';
        }
      }
      
      // Remove marcador anterior
      if (window.filtroMarker) {
        window.filtroMarker.setMap(null);
      }
      
      // Adiciona novo marcador
      if (mapa && !isNaN(ponto.lat) && !isNaN(ponto.lng)) {
        window.filtroMarker = new google.maps.Marker({
          position: { lat: ponto.lat, lng: ponto.lng },
          map: mapa,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41">
                <path d="M12.5,0 C19.4,0 25,5.6 25,12.5 C25,19.4 12.5,41 12.5,41 S0,19.4 0,12.5 C0,5.6 5.6,0 12.5,0 z" fill="#dc2626"/>
                <circle cx="12.5" cy="12.5" r="6" fill="white"/>
              </svg>
            `),
            anchor: new google.maps.Point(12.5, 41)
          }
        });
        
        mapa.setCenter({ lat: ponto.lat, lng: ponto.lng });
        mapa.setZoom(15);
      }
      
      // Atualizar link do Google Maps
      const link = document.getElementById('filtroKmLink');
      if (link && !isNaN(ponto.lat) && !isNaN(ponto.lng)) {
        link.href = `https://www.google.com/maps?q=${ponto.lat},${ponto.lng}`;
        link.textContent = `Ver no Google Maps (${ponto.lat.toFixed(6)}, ${ponto.lng.toFixed(6)})`;
        link.classList.add('active');
      }
      
      // Mostrar informações
      if (quadroFoto) {
        let infoHtml = `<div style='font-size:15px;text-align:left;margin-bottom:6px;'>`;
        if (usouProximo) {
          infoHtml += `<span style='color:#c62828;font-size:13px;'>Km não disponível. Mostrando informações do Km mais próximo: <b>${ponto.km !== undefined ? ponto.km.toFixed(3) : '-'}</b></span><br>`;
        }
        infoHtml += `<b>Rodovia:</b> ${ponto.SP || rod || '-'}<br>`;
        infoHtml += `<b>Km:</b> ${ponto.km !== undefined ? ponto.km.toFixed(3) : '-'}<br>`;
        infoHtml += `<b>Município:</b> ${ponto.MUNICÍPIO || ponto.municipio || '-'}<br>`;
        infoHtml += `<b>Tipo:</b> ${ponto.TIPO || ponto.tipo || '-'}<br>`;
        
        let latFinal = ponto.lat !== undefined ? ponto.lat : undefined;
        let lngFinal = ponto.lng !== undefined ? ponto.lng : undefined;
        let coordStr = (latFinal !== undefined && lngFinal !== undefined) ? 
          `${parseFloat(latFinal).toFixed(6)}, ${parseFloat(lngFinal).toFixed(6)}` : '-';
        let linkGoogle = (latFinal !== undefined && lngFinal !== undefined) ? 
          `<a href='https://www.google.com/maps?q=${latFinal},${lngFinal}' target='_blank' style='color:#1976d2;text-decoration:underline;font-size:14px;'>(Google Maps)</a>` : '';
        
        infoHtml += `<b>Coordenada:</b> ${coordStr} ${linkGoogle}<br>`;
        infoHtml += `</div>`;
        
        quadroFoto.innerHTML = infoHtml;
        quadroFoto.style.display = '';
      }
    });
  }
  
  // Event listener para geolocalização
  const btnGeolocalizacao = document.getElementById('btnGeolocalizacao');
  if (btnGeolocalizacao) {
    btnGeolocalizacao.addEventListener('click', function() {
      if (geolocalizacaoAtiva) {
        pararGeolocalizacao();
      } else {
        iniciarGeolocalizacao();
      }
    });
    
    btnGeolocalizacao.addEventListener('dblclick', function(e) {
      e.preventDefault();
      if (!geolocalizacaoAtiva) {
        centralizarNaLocalizacao();
      }
    });
  }
});

// Limpar recursos ao fechar
window.addEventListener('beforeunload', function() {
  if (geolocalizacaoAtiva) {
    pararGeolocalizacao();
  }
});

// Função auxiliar para mensagens
function mostrarMensagemDiscreta(texto, tempo = 2500) {
  let msgDiv = document.getElementById('msgDiscreta');
  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = 'msgDiscreta';
    msgDiv.style.position = 'fixed';
    msgDiv.style.bottom = '18px';
    msgDiv.style.left = '50%';
    msgDiv.style.transform = 'translateX(-50%)';
    msgDiv.style.background = 'rgba(25, 118, 210, 0.08)';
    msgDiv.style.color = '#1976d2';
    msgDiv.style.fontSize = '13px';
    msgDiv.style.padding = '4px 16px';
    msgDiv.style.borderRadius = '8px';
    msgDiv.style.boxShadow = '0 2px 8px #1976d222';
    msgDiv.style.zIndex = '9999';
    msgDiv.style.pointerEvents = 'none';
    document.body.appendChild(msgDiv);
  }
  msgDiv.textContent = texto;
  msgDiv.style.opacity = '1';
  msgDiv.style.display = 'block';
  clearTimeout(msgDiv._hideTimeout);
  msgDiv._hideTimeout = setTimeout(() => {
    msgDiv.style.opacity = '0';
    setTimeout(() => { msgDiv.style.display = 'none'; }, 400);
  }, tempo);
}

// Expor funções globalmente se necessário
window.initMapInternal = initMapInternal;
window.mapa = mapa;
