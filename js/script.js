/* global L, JSZip, shp, turf, Papa, toGeoJSON */

console.log("script.js carregado (lite v1)");

// ═══════════════════════ 1) Mapa
const mapa = L.map("map").setView([-23.8, -48.5], 7);
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
