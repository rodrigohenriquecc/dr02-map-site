/* global L, JSZip, shp, turf, Papa, toGeoJSON */

window.addEventListener('DOMContentLoaded', function() {
      // Esconde o cartão por padrão em telas pequenas
      function shouldHideImportCard() {
        return window.innerWidth < 700;
      }
      const importCard = document.getElementById('importCard');
      const toggleBtn = document.getElementById('toggleImportCard');
      function setImportCardVisible(visible) {
        if (visible) {
          importCard.classList.remove('hide');
        } else {
          importCard.classList.add('hide');
        }
      }
      // Sempre inicia oculto
      let importCardVisible = false;
      setImportCardVisible(importCardVisible);
      toggleBtn.addEventListener('click', function() {
        importCardVisible = !importCardVisible;
        setImportCardVisible(importCardVisible);
      });
      window.addEventListener('resize', function() {
        if (shouldHideImportCard()) {
          importCardVisible = false;
          setImportCardVisible(false);
        }
      });

      // Filtro de rodovia e km (carrega direto da nova planilha de pontos por Km)
      const SHEET_PONTOS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcA1FtwW6o2AymbsAQx2Ad-15DmJRx0P5Mri4qJ3FnZh52tKw6OcM8dQiNyzXTjQ/pub?output=csv";
      let filtroPontosPorKm = {};
      function preencherRodoviasFiltroPontos() {
        const select = document.getElementById('filtroRodovia');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione a rodovia</option>';
        Object.keys(filtroPontosPorKm).forEach(r => {
          const opt = document.createElement('option');
          opt.value = r;
          opt.textContent = r;
          select.appendChild(opt);
        });
      }
      // Helper para normalizar nomes de colunas
      function normalizarColuna(nome) {
        return nome.normalize('NFD').replace(/[^\w]/g, '').toLowerCase();
      }

      // Carrega planilha de pontos por Km e popula filtro (corrige nomes de colunas)
      function carregarFiltroPontosPorKm() {
        if (typeof Papa === 'undefined') {
          setTimeout(carregarFiltroPontosPorKm, 200);
          return;
        }
        Papa.parse(SHEET_PONTOS_URL, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: ({ data, meta }) => {
            filtroPontosPorKm = {};
            let colunas = {};
            if (meta && meta.fields) {
              meta.fields.forEach((c) => {
                colunas[normalizarColuna(c)] = c;
              });
            }
            data.forEach((r, idx) => {
              // Busca colunas normalizadas
              const rodovia = (r[colunas['sp']] || '').toString().trim();
              const kmStr = (r[colunas['km']] || '').toString().replace(',', '.').trim();
              const localizacao = (r[colunas['localizacao']] || '').toString().trim();
              const urlFoto = (r[colunas['urlfotos']] || '').toString().trim();
              const urlMaps = (r[colunas['urldolinkprogooglemaps']] || '').toString().trim();
              const municipio = (r[colunas['municipio']] || '').toString().trim();
              const tipo = (r[colunas['tipo']] || '').toString().trim();
              const rc = (r[colunas['rc']] || '').toString().trim();
              if (!rodovia || !kmStr || !localizacao) return;
              // Extrai lat/lon da coluna LOCALIZAÇÃO
              let lat = null, lon = null;
              if (/^-?\d+([\.,]\d+)?\s*,\s*-?\d+([\.,]\d+)?$/.test(localizacao)) {
                const [latStr, lonStr] = localizacao.split(',').map(s => s.replace(',', '.').trim());
                lat = parseFloat(latStr);
                lon = parseFloat(lonStr);
              }
              if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return;
              if (!filtroPontosPorKm[rodovia]) filtroPontosPorKm[rodovia] = [];
              filtroPontosPorKm[rodovia].push({
                km: parseFloat(kmStr),
                lat,
                lon,
                urlFoto,
                urlMaps,
                municipio,
                tipo,
                rc
              });
            });
            // Ordena os pontos por Km para cada rodovia
            Object.values(filtroPontosPorKm).forEach(arr => arr.sort((a, b) => a.km - b.km));
            preencherRodoviasFiltroPontos();
            preencherMunicipiosFiltro();
          }
        });
      }
      carregarFiltroPontosPorKm();
      // Preenche autocomplete de municípios
      function preencherMunicipiosFiltro() {
        const municipioInput = document.getElementById('filtroMunicipio');
        if (!municipioInput) return;
        const municipios = new Set();
        Object.values(filtroPontosPorKm).flat().forEach(p => {
          if (p.municipio) municipios.add(p.municipio);
        });
        municipioInput.setAttribute('list', 'filtroMunicipioList');
        let datalist = document.getElementById('filtroMunicipioList');
        if (!datalist) {
          datalist = document.createElement('datalist');
          datalist.id = 'filtroMunicipioList';
          document.body.appendChild(datalist);
        }
        datalist.innerHTML = '';
        Array.from(municipios).sort().forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          datalist.appendChild(opt);
        });
      }

      // Atualiza lista de Km ao selecionar rodovia
      function atualizarListaKm() {
        const rod = document.getElementById('filtroRodovia').value;
        const arr = filtroPontosPorKm[rod] || [];
        const kmSelect = document.getElementById('filtroKm');
        kmSelect.innerHTML = '';
        arr.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.km.toFixed(3);
          opt.textContent = p.km.toFixed(3);
          kmSelect.appendChild(opt);
        });
        kmSelect.disabled = !arr.length;
        document.getElementById('filtroKmBtn').disabled = !arr.length;
      }
      document.getElementById('filtroRodovia').addEventListener('change', atualizarListaKm);

      // Botão de busca
      const quadroFoto = document.getElementById('quadroFotoKm') || document.createElement('div');
      quadroFoto.id = 'quadroFotoKm';
      quadroFoto.style.display = 'none';
      quadroFoto.style.marginTop = '8px';
      quadroFoto.style.textAlign = 'center';
      quadroFoto.innerHTML = '';
      if (!document.getElementById('quadroFotoKm')) {
        document.querySelector('.filtro-rodovia-card').appendChild(quadroFoto);
      }

      document.getElementById('filtroKmBtn').addEventListener('click', function() {
        const rod = document.getElementById('filtroRodovia').value;
        const kmSelect = document.getElementById('filtroKm');
        const arr = filtroPontosPorKm[rod] || [];
        const link = document.getElementById('filtroKmLink');
        const msgKmProximo = document.getElementById('msgKmProximo');
        quadroFoto.style.display = 'none';
        link.classList.remove('active');
        msgKmProximo.style.display = 'none';
        if (!rod || !arr.length) {
          alert('Selecione uma rodovia e um Km válido!');
          return;
        }
        let km = parseFloat(kmSelect.value.replace(',', '.'));
        let ponto = arr.find(p => p.km.toFixed(3) === km.toFixed(3));
        let usouProximo = false;
        if (!ponto) {
          // Busca o mais próximo
          ponto = arr.reduce((prev, curr) => Math.abs(curr.km - km) < Math.abs(prev.km - km) ? curr : prev, arr[0]);
          km = ponto.km;
          usouProximo = true;
        }
        if (usouProximo) {
          msgKmProximo.textContent = `Km não disponível. Mostrando informações do Km mais próximo: ${ponto.km.toFixed(3)}`;
          msgKmProximo.style.display = '';
        }
        // Mostra marcador e link
        if (window.filtroMarker && window.mapa) window.mapa.removeLayer(window.filtroMarker);
        if (window.mapa) {
          // Ícone customizado para destaque (corrige pane para 'markerPane')
          const customIcon = L.icon({
            iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            shadowSize: [41, 41]
          });
          window.filtroMarker = L.marker([ponto.lat, ponto.lon], { pane: "markerPane", icon: customIcon }).addTo(window.mapa);
          window.mapa.setView([ponto.lat, ponto.lon], 15, { animate: true });
          // Animação rápida para chamar atenção
          setTimeout(() => { window.filtroMarker.setZIndexOffset(1000); }, 100);
        }
        link.href = ponto.urlMaps && ponto.urlMaps.startsWith('http') ? ponto.urlMaps : `https://www.google.com/maps?q=${ponto.lat},${ponto.lon}`;
        link.textContent = `Ver no Google Maps (${ponto.lat.toFixed(6)}, ${ponto.lon.toFixed(6)})`;
        link.classList.add('active');
        // Mostra quadro de informações detalhadas
        let infoHtml = `<div style='font-size:14px;text-align:left;margin-bottom:6px;'>`;
        infoHtml += `<b>Rodovia:</b> ${rod}<br>`;
        infoHtml += `<b>Km:</b> ${ponto.km.toFixed(3)}<br>`;
        infoHtml += `<b>Município:</b> ${ponto.municipio || '-'}<br>`;
        infoHtml += `<b>Tipo de pavimento:</b> ${ponto.tipo || '-'}<br>`;
        if (ponto.rc) infoHtml += `<b>RC:</b> ${ponto.rc}<br>`;
        infoHtml += `<b>Coordenada:</b> ${ponto.lat.toFixed(6)}, ${ponto.lon.toFixed(6)}<br>`;
        if (ponto.urlMaps && ponto.urlMaps.startsWith('http')) {
          infoHtml += `<a href='${ponto.urlMaps}' target='_blank' style='color:#1976d2;font-size:13px;'>Abrir no Google Maps</a><br>`;
        }
        infoHtml += `</div>`;
        // Exibe link para foto do local, se houver URL válida
        if (ponto.urlFoto && ponto.urlFoto.length > 4) {
          const fotos = ponto.urlFoto.split(',').map(f => f.trim()).filter(f => f.startsWith('http'));
          fotos.forEach((foto, i) => {
            infoHtml += `<a href='${foto}' target='_blank' style='display:block;margin:8px auto 8px auto;color:#1976d2;font-size:15px;font-weight:600;text-align:center;text-decoration:underline;'>Ver foto do local</a>`;
          });
        }
        quadroFoto.innerHTML = infoHtml;
        quadroFoto.style.display = '';
      });

      // Autocomplete para Km baseado na rodovia selecionada
      document.getElementById('filtroKm').addEventListener('input', function() {
        const rodovia = document.getElementById('filtroRodovia').value;
        const kmInput = this;
        const kmList = document.getElementById('filtroKmList');
        kmList.innerHTML = '';
        if (!rodovia) return;
        const arr = filtroPontosPorKm[rodovia] || [];
        const valorAtual = kmInput.value.replace(',', '.');
        // Adiciona opções ao datalist para autocomplete
        arr.forEach(ponto => {
          const option = document.createElement('option');
          option.value = ponto.km.toFixed(3);
          kmList.appendChild(option);
        });
        // Se o valor atual não estiver na lista, adiciona como opção "outro valor"
        if (!arr.some(ponto => ponto.km.toFixed(3) === parseFloat(valorAtual).toFixed(3))) {
          const option = document.createElement('option');
          option.value = parseFloat(valorAtual).toFixed(3);
          kmList.appendChild(option);
        }
      });
    });

console.log("script.js carregado (lite v1)");

// ═══════════════════════ 1) Mapa
const mapa = L.map("map").setView([-23.8, -48.5], 7);
window.mapa = mapa;
["shapefilePane", "rodoviasPane", "overlayPane"].forEach((p, i) => {
  mapa.createPane(p).style.zIndex = 400 + i * 50;
  if (i < 2) mapa.getPane(p).style.pointerEvents = "none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(mapa);

// helper ➜ adiciona rótulo simples
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: "", html: `<div class='${cls}'>${txt}</div>`, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

// ═══════════════════════ 2) Variáveis globais
const metaRod = {},
  rcLayers = {},
  rodLayers = {};
const pontosLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
let heatLayer = null;
// Referência global para os labels das rodovias
let rodLabels = [];

// visibilidade
let pointsVisible = true,
  heatVisible = true;
const refreshVis = () => {
  pointsVisible ? mapa.addLayer(pontosLayer) : mapa.removeLayer(pontosLayer);
  if (heatLayer) {
    heatVisible ? mapa.addLayer(heatLayer) : mapa.removeLayer(heatLayer);
  }
};

// ═══════════════════════ 3) URLs das planilhas
const SHEETS = {
  meta: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?output=csv",
  points: "https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat: "https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
};

// ═══════════════════════ 4) Carrega metadados e dá início
Papa.parse(SHEETS.meta, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: ({ data }) => {
    data.forEach((r) => {
      // Ajuste para os novos nomes de coluna
      metaRod[r["Rodovia"]] = {
        kmIni: parseFloat(r["Km Inicial"].replace(/,/, ".")),
        kmFim: parseFloat(r["Km Final"].replace(/,/, ".")),
        iniLat: +r["Lat e Long km Inicial"].split(",")[0],
        iniLon: +r["Lat e Long km Inicial"].split(",")[1],
        fimLat: +r["Lat e Long km final"].split(",")[0],
        fimLon: +r["Lat e Long km final"].split(",")[1],
      };
    });
    carregarRC();
  },
});

// ═══════════════════════ 5) Shapefiles das RCs (contorno)
async function carregarRC() {
  const rcList = [
    "data/RC_2.1.zip",
    "data/RC_2.2.zip",
    "data/RC_2.4.zip",
    "data/RC_2.5.zip",
    "data/RC_2.6_2.8.zip",
    "data/RC_2.7.zip",
  ];

  for (const p of rcList) {
    try {
      const geo = await shp(p);
      const name = p.match(/RC_[\d._]+/)[0].replace("_", " ");
      rcLayers[name] = L.geoJSON(geo, {
        pane: "shapefilePane",
        style: { color: "#000", weight: 2.5, fill: false },
      }).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(), name, "rc-label");
    } catch (err) {
      console.error("RC falhou:", p, err);
    }
  }

  loadMalha();
}

// ═══════════════════════ 6) KMZ único da malha DR.02
async function loadMalha() {
  const MALHA_PATH = "data/malha_dr02.kmz"; // ajuste se necessário
  try {
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
        rodLayers[nomeCompleto] = L.geoJSON(turf.simplify(feat, { tolerance: 0.00005 }), {
          pane: "rodoviasPane",
          style: { color: "#555", weight: 3, opacity: 0.9 },
        }).addTo(mapa);
        // Adiciona o label e armazena referência
        const label = addLabel(rodLayers[nomeCompleto].getBounds().getCenter(), nome, "rod-label");
        rodLabels.push(label);
      });

    mapa.fitBounds(L.featureGroup(Object.values(rodLayers)).getBounds());
    reloadSheets();
    refreshVis();
    // Dispara evento customizado para sinalizar que as rodovias estão prontas
    window.dispatchEvent(new Event('rodoviasCarregadas'));
  } catch (err) {
    console.error("Malha DR.02:", err.message);
  }
}

// ═══════════════════════ 7) Planilhas dinâmicas
function reloadSheets() {
  pontosLayer.clearLayers();
  if (heatLayer) mapa.removeLayer(heatLayer), (heatLayer = null);
  loadPoints();
  loadHeat();
}

// --- pontos
function loadPoints() {
  Papa.parse(SHEETS.points, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      data.forEach((d) => {
        const key = d.Rodovia;
        const seg = rodLayers[key];
        const meta = metaRod[key];
        if (!seg || !meta) return;
        // Usa sempre d.Km para o campo Km
        const km = d.Km !== undefined ? parseFloat(d.Km.toString().replace(",", ".")) : undefined;
        if (!km || km < meta.kmIni || km > meta.kmFim) return;
        const rel = km - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const pt = turf.along(line, rel, { units: "kilometers" });
        // Cor
        const cor = d.Cor || "#1976d2";
        // Opacidade
        let opacidade = 1;
        if (d.Opacidade !== undefined && d.Opacidade !== "") {
          const op = parseFloat(d.Opacidade.toString().replace(",", "."));
          if (!isNaN(op) && op >= 0 && op <= 1) opacidade = op;
        }
        // Raio
        let raio = 6;
        if (d.Raio !== undefined && d.Raio !== "") {
          const r = parseFloat(d.Raio.toString().replace(",", "."));
          if (!isNaN(r) && r > 0) raio = r;
        }
        L.circle([pt.geometry.coordinates[1], pt.geometry.coordinates[0]], {
          pane: "overlayPane",
          radius: raio, // agora em metros
          color: cor, // borda igual à cor do preenchimento
          weight: 2,
          opacity: 1, // opacidade da borda
          fill: true,
          fillColor: cor,
          fillOpacity: opacidade,
        })
          .bindPopup(`<b>${key}</b><br>Km ${d.Km}<br>${d.Obs || ""}`)
          .addTo(pontosLayer);
      });
      if (!pointsVisible) mapa.removeLayer(pontosLayer);
    },
  });
}

// --- heatmap
function loadHeat() {
  Papa.parse(SHEETS.heat, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const pts = [];
      data.forEach((r) => {
        const seg = rodLayers[r.Rodovia];
        const meta = metaRod[r.Rodovia];
        if (!seg || !meta) return;

        const km0 = parseFloat(r["Km Inicial"].replace(",", "."));
        const km1 = parseFloat(r["Km Final"].replace(",", "."));
        if (!km0 || !km1) return;

        const rel0 = km0 - meta.kmIni;
        const rel1 = km1 - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const p0 = turf.along(line, rel0, { units: "kilometers" });
        const p1 = turf.along(line, rel1, { units: "kilometers" });
        const slice = turf.lineSlice(p0, p1, line);
        const len = turf.length(slice, { units: "kilometers" });
        const n = Math.ceil(len * 4) + 1;

        for (let i = 0; i <= n; i++) {
          const p = turf.along(slice, (len * i) / n, { units: "kilometers" });
          pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
        }
      });
      heatLayer = L.heatLayer(pts, { radius: 25, blur: 15 }).addTo(mapa);
      if (!heatVisible) mapa.removeLayer(heatLayer);
    },
  });
}

// ═══════════════════════ 8) Controles de UI
// Função para evitar sobreposição de labels
function ajustarVisibilidadeLabels() {
  if (!rodLabels.length) return;
  // Pega a posição dos labels na tela
  const positions = rodLabels.map((label) => {
    const latlng = label.getLatLng();
    return mapa.latLngToContainerPoint(latlng);
  });
  // Define um raio mínimo de separação em pixels
  const minDist = 40;
  // Array para controlar quais labels mostrar
  const visiveis = Array(rodLabels.length).fill(true);
  for (let i = 0; i < positions.length; i++) {
    if (!visiveis[i]) continue;
    for (let j = i + 1; j < positions.length; j++) {
      if (!visiveis[j]) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        visiveis[j] = false; // Oculta o label j
      }
    }
  }
  // Aplica visibilidade
  rodLabels.forEach((label, i) => {
    const el = label.getElement();
    if (el) el.style.display = visiveis[i] ? "" : "none";
  });
}

mapa.on("zoomend moveend", ajustarVisibilidadeLabels);
// Chama ao carregar labels
setTimeout(ajustarVisibilidadeLabels, 1000);

// Importação de pontos via CSV local
const csvInput = document.getElementById('csvInput');
if (csvInput) {
  csvInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: ({ data }) => {
        pontosLayer.clearLayers();
        data.forEach((d) => {
          const key = d.Rodovia;
          const seg = rodLayers[key];
          const meta = metaRod[key];
          if (!seg || !meta) return;
          // Usa sempre d.Km para o campo Km
          const km = d.Km !== undefined ? parseFloat(d.Km.toString().replace(",", ".")) : undefined;
          if (!km || km < meta.kmIni || km > meta.kmFim) return;
          const rel = km - meta.kmIni;
          const line = seg.toGeoJSON().features[0];
          const pt = turf.along(line, rel, { units: "kilometers" });
          const cor = d.Cor || "#1976d2";
          const opacidade = d.Opacidade !== undefined && d.Opacidade !== "" ? parseFloat(d.Opacidade) : 1;
          const raio = d.Raio !== undefined && d.Raio !== "" ? +d.Raio : 6;
          L.circle([pt.geometry.coordinates[1], pt.geometry.coordinates[0]], {
            pane: "overlayPane",
            radius: raio, // agora em metros
            color: cor, // borda igual à cor do preenchimento
            weight: 2,
            opacity: 1, // opacidade da borda
            fill: true,
            fillColor: cor,
            fillOpacity: opacidade,
          })
            .bindPopup(`<b>${key}</b><br>Km ${d.Km}<br>${d.Obs || ""}`)
            .addTo(pontosLayer);
        });
        if (!pointsVisible) mapa.removeLayer(pontosLayer);
      },
      error: (err) => alert('Erro ao ler o CSV: ' + err.message)
    });
  });
}

// Importação de heatmap via CSV local
const heatmapCsvInput = document.getElementById('heatmapCsvInput');
if (heatmapCsvInput) {
  heatmapCsvInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: ({ data }) => {
        // Remove camada anterior
        if (heatLayer) mapa.removeLayer(heatLayer);
        // Processa trechos e gera pontos para heatmap
        const pts = [];
        data.forEach((r) => {
          const seg = rodLayers[r.Rodovia];
          const meta = metaRod[r.Rodovia];
          if (!seg || !meta) return;
          const km0 = parseFloat((r["Km Inicial"]||"").replace(",", "."));
          const km1 = parseFloat((r["Km Final"]||"").replace(",", "."));
          if (!km0 || !km1) return;
          const rel0 = km0 - meta.kmIni;
          const rel1 = km1 - meta.kmIni;
          const line = seg.toGeoJSON().features[0];
          const p0 = turf.along(line, rel0, { units: "kilometers" });
          const p1 = turf.along(line, rel1, { units: "kilometers" });
          const slice = turf.lineSlice(p0, p1, line);
          const len = turf.length(slice, { units: "kilometers" });
          const n = Math.ceil(len * 4) + 1;
          for (let i = 0; i <= n; i++) {
            const p = turf.along(slice, (len * i) / n, { units: "kilometers" });
            pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
          }
        });
        // Agrupa pontos iguais para calcular incidência
        const ptMap = {};
        pts.forEach(([lat, lon, v]) => {
          const key = lat.toFixed(6) + "," + lon.toFixed(6);
          ptMap[key] = (ptMap[key] || 0) + v;
        });
        const ptsFinal = Object.entries(ptMap).map(([k, v]) => {
          const [lat, lon] = k.split(",").map(Number);
          return [lat, lon, v];
        });
        heatLayer = L.heatLayer(ptsFinal, { radius: 25, blur: 15 }).addTo(mapa);
        if (!heatVisible) mapa.removeLayer(heatLayer);
      },
      error: (err) => alert('Erro ao ler o CSV do heatmap: ' + err.message)
    });
  });
}

// Camada para linhas por trecho
let linhasTrechoLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);

// Importação de linhas por trecho via CSV local
const linhasTrechoCsvInput = document.getElementById('linhasTrechoCsvInput');
if (linhasTrechoCsvInput) {
  linhasTrechoCsvInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: ({ data }) => {
        linhasTrechoLayer.clearLayers();
        data.forEach((r) => {
          const seg = rodLayers[r.Rodovia];
          const meta = metaRod[r.Rodovia];
          if (!seg || !meta) return;
          const km0 = parseFloat((r["Km Inicial"]||"").replace(",", "."));
          const km1 = parseFloat((r["Km Final"]||"").replace(",", "."));
          if (!km0 || !km1) return;
          const rel0 = km0 - meta.kmIni;
          const rel1 = km1 - meta.kmIni;
          const line = seg.toGeoJSON().features[0];
          const p0 = turf.along(line, rel0, { units: "kilometers" });
          const p1 = turf.along(line, rel1, { units: "kilometers" });
          const slice = turf.lineSlice(p0, p1, line);
          const cor = r.Cor || "#ff0000";
          let espessura = 6;
          if (r.Espessura !== undefined && r.Espessura !== "") {
            const e = parseFloat(r.Espessura.toString().replace(",", "."));
            if (!isNaN(e) && e > 0) espessura = e;
          }
          L.geoJSON(slice, {
            pane: "overlayPane",
            style: { color: cor, weight: espessura, opacity: 1 },
            interactive: false
          }).addTo(linhasTrechoLayer);
        });
      },
      error: (err) => alert('Erro ao ler o CSV de linhas por trecho: ' + err.message)
    });
  });
}
