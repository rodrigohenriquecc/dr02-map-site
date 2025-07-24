/**
 * Sistema Completo Google Maps - CGR 02
 * Versão 5.0 - Sistema Modular Restaurado
 */

// Variáveis globais
let mapa;
let dadosCarregados = {
  shapefiles: false,
  kmz: false,
  pontos: false,
  calor: false,
  linhas: false
};
let marcadorUsuario = null;
let watchId = null;
let geolocalizacaoAtiva = false;

// Arrays para armazenar dados
let pontosInteresse = [];
let mapaCalor = [];
let linhasTrecho = [];
let rodovias = [];
let kmsDisponiveis = {};

/**
 * Função principal que carrega todo o sistema
 */
function carregarSistemaCompleto(mapInstance) {
  console.log('🚀 Carregando sistema completo do Google Maps...');
  
  mapa = mapInstance;
  window.mapa = mapa;
  
  // Configurar geolocalização
  configurarGeolocalizacao();
  
  // Carregar todos os dados
  carregarTodosDados();
  
  console.log('✅ Sistema completo carregado!');
}

/**
 * Configurar funcionalidade de geolocalização
 */
function configurarGeolocalizacao() {
  const btnGeo = document.getElementById('btnGeolocalizacao');
  const infoGeo = document.getElementById('geolocalizacaoInfo');
  const statusGeo = document.getElementById('geoStatus');
  const coordenadasGeo = document.getElementById('geoCoordenadas');
  
  if (!btnGeo) return;
  
  btnGeo.addEventListener('click', function() {
    if (geolocalizacaoAtiva) {
      // Parar rastreamento
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (marcadorUsuario) {
        marcadorUsuario.setMap(null);
        marcadorUsuario = null;
      }
      
      geolocalizacaoAtiva = false;
      btnGeo.classList.remove('ativo');
      btnGeo.textContent = '📍';
      infoGeo.classList.remove('ativo');
      statusGeo.textContent = 'Clique para ativar localização';
      coordenadasGeo.textContent = '';
      
      console.log('🔴 Geolocalização desativada');
    } else {
      // Iniciar rastreamento
      if (!navigator.geolocation) {
        alert('Geolocalização não suportada neste navegador');
        return;
      }
      
      statusGeo.textContent = 'Obtendo localização...';
      infoGeo.classList.add('ativo');
      
      const opcoes = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      };
      
      watchId = navigator.geolocation.watchPosition(
        function(position) {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const precisao = Math.round(position.coords.accuracy);
          
          // Atualizar marcador
          if (marcadorUsuario) {
            marcadorUsuario.setPosition({lat, lng});
          } else {
            marcadorUsuario = new google.maps.Marker({
              position: {lat, lng},
              map: mapa,
              title: 'Sua localização',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#4285f4" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
              }
            });
          }
          
          // Centralizar mapa na primeira localização
          if (!geolocalizacaoAtiva) {
            mapa.setCenter({lat, lng});
            mapa.setZoom(15);
          }
          
          geolocalizacaoAtiva = true;
          btnGeo.classList.add('ativo');
          btnGeo.textContent = '🎯';
          statusGeo.textContent = `Localização ativa (±${precisao}m)`;
          coordenadasGeo.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          
          console.log('🟢 Localização atualizada:', lat, lng);
        },
        function(error) {
          console.error('❌ Erro de geolocalização:', error);
          statusGeo.textContent = 'Erro ao obter localização';
          
          let mensagem = 'Erro desconhecido';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              mensagem = 'Permissão negada';
              break;
            case error.POSITION_UNAVAILABLE:
              mensagem = 'Posição indisponível';
              break;
            case error.TIMEOUT:
              mensagem = 'Tempo esgotado';
              break;
          }
          
          alert(`Erro na geolocalização: ${mensagem}`);
        },
        opcoes
      );
    }
  });
}

/**
 * Carregar todos os dados do sistema
 */
function carregarTodosDados() {
  console.log('📁 Carregando dados do sistema...');
  
  // Carregar shapefiles das RCs
  carregarShapefiles();
  
  // Carregar KMZ das rodovias
  carregarKMZ();
  
  // Carregar dados CSV
  carregarPontosInteresse();
  carregarMapaCalor();
  carregarLinhasTrecho();
  
  // Configurar filtros
  configurarFiltros();
}

/**
 * Carregar shapefiles das RCs
 */
function carregarShapefiles() {
  const arquivosRC = [
    'archives/assets/data/RC_2.1.zip',
    'archives/assets/data/RC_2.2.zip',
    'archives/assets/data/RC_2.4.zip',
    'archives/assets/data/RC_2.5.zip',
    'archives/assets/data/RC_2.6_2.8.zip',
    'archives/assets/data/RC_2.7.zip'
  ];
  
  arquivosRC.forEach(arquivo => {
    fetch(arquivo)
      .then(response => response.arrayBuffer())
      .then(buffer => shp(buffer))
      .then(geojson => {
        processarShapefile(geojson, arquivo);
      })
      .catch(error => {
        console.error(`Erro ao carregar ${arquivo}:`, error);
      });
  });
}

/**
 * Processar dados do shapefile
 */
function processarShapefile(geojson, arquivo) {
  const nomeRC = arquivo.match(/RC_[\d._]+/)[0];
  console.log(`📍 Processando ${nomeRC}...`);
  
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const coordsArray = feature.geometry.type === 'Polygon' 
        ? [feature.geometry.coordinates] 
        : feature.geometry.coordinates;
      
      coordsArray.forEach(coords => {
        const paths = coords[0].map(coord => ({
          lat: coord[1],
          lng: coord[0]
        }));
        
        const polygon = new google.maps.Polygon({
          paths: paths,
          strokeColor: '#1976d2',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#42a5f5',
          fillOpacity: 0.2,
          map: mapa
        });
        
        // Adicionar label da RC
        const bounds = new google.maps.LatLngBounds();
        paths.forEach(coord => bounds.extend(coord));
        const center = bounds.getCenter();
        
        const label = new google.maps.Marker({
          position: center,
          map: mapa,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="20">
                <rect width="60" height="20" rx="3" fill="rgba(0,0,0,0.7)" stroke="#555"/>
                <text x="30" y="14" text-anchor="middle" fill="white" font-size="8" font-weight="600">${nomeRC}</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(60, 20),
            anchor: new google.maps.Point(30, 10)
          }
        });
      });
    }
  });
  
  dadosCarregados.shapefiles = true;
  console.log(`✅ ${nomeRC} carregado com sucesso`);
}

/**
 * Carregar arquivo KMZ das rodovias
 */
function carregarKMZ() {
  fetch('archives/assets/data/malha_dr02.kmz')
    .then(response => response.arrayBuffer())
    .then(buffer => JSZip.loadAsync(buffer))
    .then(zip => {
      const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
      if (kmlFile) {
        return zip.files[kmlFile].async('string');
      }
      throw new Error('Arquivo KML não encontrado no KMZ');
    })
    .then(kmlString => {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
      const geojson = toGeoJSON.kml(kmlDoc);
      processarKMZ(geojson);
    })
    .catch(error => {
      console.error('Erro ao carregar KMZ:', error);
    });
}

/**
 * Processar dados do KMZ
 */
function processarKMZ(geojson) {
  console.log('🛣️ Processando malha rodoviária...');
  
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
      
      const polyline = new google.maps.Polyline({
        path: coords,
        geodesic: true,
        strokeColor: '#ff5722',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapa
      });
      
      // Labels das rodovias removidos - desabilitado por solicitação do usuário
      /*
      if (feature.properties && feature.properties.name) {
        const midPoint = coords[Math.floor(coords.length / 2)];
        
        const label = new google.maps.Marker({
          position: midPoint,
          map: mapa,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="16">
                <rect width="80" height="16" rx="3" fill="rgba(255,255,255,0.9)" stroke="#ccc"/>
                <text x="40" y="11" text-anchor="middle" fill="black" font-size="7" font-weight="600">${feature.properties.name}</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(80, 16),
            anchor: new google.maps.Point(40, 8)
          }
        });
      }
      */
    }
  });
  
  dadosCarregados.kmz = true;
  console.log('✅ Malha rodoviária carregada');
}

/**
 * Carregar pontos de interesse
 */
function carregarPontosInteresse() {
  fetch('archives/assets/data/pontos_de_interesse.csv')
    .then(response => response.text())
    .then(csvText => {
      Papa.parse(csvText, {
        header: true,
        complete: function(results) {
          pontosInteresse = results.data;
          processarPontosInteresse();
        }
      });
    })
    .catch(error => {
      console.error('Erro ao carregar pontos de interesse:', error);
    });
}

/**
 * Processar pontos de interesse
 */
function processarPontosInteresse() {
  console.log('📍 Processando pontos de interesse...');
  
  pontosInteresse.forEach(ponto => {
    if (ponto.latitude && ponto.longitude) {
      const marker = new google.maps.Marker({
        position: {
          lat: parseFloat(ponto.latitude),
          lng: parseFloat(ponto.longitude)
        },
        map: mapa,
        title: ponto.nome || 'Ponto de Interesse',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" fill="#e91e63" stroke="#ffffff" stroke-width="2"/>
              <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">!</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(10, 10)
        }
      });
      
      // Adicionar info window se houver descrição
      if (ponto.descricao) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<div><strong>${ponto.nome || 'Ponto de Interesse'}</strong><br>${ponto.descricao}</div>`
        });
        
        marker.addListener('click', () => {
          infoWindow.open(mapa, marker);
        });
      }
    }
  });
  
  dadosCarregados.pontos = true;
  console.log('✅ Pontos de interesse carregados');
}

/**
 * Carregar mapa de calor
 */
function carregarMapaCalor() {
  fetch('archives/assets/data/mapa_de_calor.csv')
    .then(response => response.text())
    .then(csvText => {
      Papa.parse(csvText, {
        header: true,
        complete: function(results) {
          mapaCalor = results.data;
          processarMapaCalor();
        }
      });
    })
    .catch(error => {
      console.error('Erro ao carregar mapa de calor:', error);
    });
}

/**
 * Processar mapa de calor
 */
function processarMapaCalor() {
  console.log('🔥 Processando mapa de calor...');
  
  const heatmapData = [];
  
  mapaCalor.forEach(item => {
    if (item.latitude && item.longitude && item.intensidade) {
      heatmapData.push(new google.maps.LatLng(
        parseFloat(item.latitude),
        parseFloat(item.longitude)
      ));
    }
  });
  
  if (heatmapData.length > 0) {
    const heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: mapa
    });
    
    heatmap.set('radius', 20);
    heatmap.set('opacity', 0.6);
  }
  
  dadosCarregados.calor = true;
  console.log('✅ Mapa de calor carregado');
}

/**
 * Carregar linhas por trecho
 */
function carregarLinhasTrecho() {
  fetch('archives/assets/data/linhas_por_trecho.csv')
    .then(response => response.text())
    .then(csvText => {
      Papa.parse(csvText, {
        header: true,
        complete: function(results) {
          linhasTrecho = results.data;
          processarLinhasTrecho();
        }
      });
    })
    .catch(error => {
      console.error('Erro ao carregar linhas por trecho:', error);
    });
}

/**
 * Processar linhas por trecho
 */
function processarLinhasTrecho() {
  console.log('📊 Processando linhas por trecho...');
  
  // Extrair rodovias únicas para o filtro
  const roduviasUnicas = [...new Set(linhasTrecho.map(item => item.rodovia).filter(Boolean))];
  rodovias = roduviasUnicas.sort();
  
  // Preencher select de rodovias
  const selectRodovia = document.getElementById('filtroRodovia');
  if (selectRodovia) {
    selectRodovia.innerHTML = '<option value="">Selecione a Rodovia</option>';
    rodovias.forEach(rodovia => {
      const option = document.createElement('option');
      option.value = rodovia;
      option.textContent = rodovia;
      selectRodovia.appendChild(option);
    });
  }
  
  // Organizar KMs por rodovia
  linhasTrecho.forEach(item => {
    if (item.rodovia && item.km) {
      if (!kmsDisponiveis[item.rodovia]) {
        kmsDisponiveis[item.rodovia] = [];
      }
      if (!kmsDisponiveis[item.rodovia].includes(item.km)) {
        kmsDisponiveis[item.rodovia].push(item.km);
      }
    }
  });
  
  // Ordenar KMs
  Object.keys(kmsDisponiveis).forEach(rodovia => {
    kmsDisponiveis[rodovia].sort((a, b) => parseFloat(a) - parseFloat(b));
  });
  
  dadosCarregados.linhas = true;
  console.log('✅ Linhas por trecho carregadas');
}

/**
 * Configurar filtros de rodovia e KM
 */
function configurarFiltros() {
  const selectRodovia = document.getElementById('filtroRodovia');
  const selectKm = document.getElementById('filtroKm');
  const btnLocalizar = document.getElementById('filtroKmBtn');
  
  if (!selectRodovia || !selectKm || !btnLocalizar) return;
  
  // Evento de mudança de rodovia
  selectRodovia.addEventListener('change', function() {
    const rodovia = this.value;
    
    selectKm.innerHTML = '<option value="">Selecione o Km</option>';
    selectKm.disabled = !rodovia;
    btnLocalizar.disabled = !rodovia;
    
    if (rodovia && kmsDisponiveis[rodovia]) {
      kmsDisponiveis[rodovia].forEach(km => {
        const option = document.createElement('option');
        option.value = km;
        option.textContent = `Km ${km}`;
        selectKm.appendChild(option);
      });
      selectKm.disabled = false;
    }
  });
  
  // Evento de localização
  btnLocalizar.addEventListener('click', function() {
    const rodovia = selectRodovia.value;
    const km = selectKm.value;
    
    if (!rodovia || !km) {
      alert('Selecione uma rodovia e um km');
      return;
    }
    
    // Buscar dados do trecho
    const trecho = linhasTrecho.find(item => 
      item.rodovia === rodovia && item.km === km
    );
    
    if (trecho && trecho.latitude && trecho.longitude) {
      const lat = parseFloat(trecho.latitude);
      const lng = parseFloat(trecho.longitude);
      
      // Centralizar mapa
      mapa.setCenter({lat, lng});
      mapa.setZoom(16);
      
      // Adicionar marcador temporário
      const marker = new google.maps.Marker({
        position: {lat, lng},
        map: mapa,
        title: `${rodovia} - Km ${km}`,
        animation: google.maps.Animation.BOUNCE
      });
      
      // Remover marcador após 5 segundos
      setTimeout(() => {
        marker.setMap(null);
      }, 5000);
      
      mostrarMensagemDiscreta(`Localizado: ${rodovia} - Km ${km}`);
    } else {
      alert('Coordenadas não encontradas para este trecho');
    }
  });
}

// Expor função globalmente
window.carregarSistemaCompleto = carregarSistemaCompleto;

console.log('📁 Script do sistema Google Maps carregado');
