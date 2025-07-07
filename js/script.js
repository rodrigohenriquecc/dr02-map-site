/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado (KMZ único – rev2)");

// ═══════════════════════ 0) Firebase (compat)
let db = null,
  col = null,
  online = false;
try {
  firebase.initializeApp({
    apiKey: "AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain: "consorciolh-8b5bc.firebaseapp.com",
    projectId: "consorciolh-8b5bc",
    storageBucket: "consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId: "128910789036",
    appId: "1:128910789036:web:d0c0b945f0bcd8ab2b1209",
  });
  db = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch (e) {
  console.warn("Firestore off:", e);
}

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

// helper: rótulo
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: cls, html: txt, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

// ═══════════════════════ 2) Variáveis globais
const metaRod = {},
  rcLayers = {},
  rodLayers = {};
const pontosLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
let heatLayer = null,
  lineLayer = null;

// visibilidade
let pointsVisible = true,
  heatVisible = true,
  linesVisible = true;
const refreshVis = () => {
  pointsVisible ? mapa.addLayer(pontosLayer) : mapa.removeLayer(pontosLayer);
  if (heatLayer) (heatVisible ? mapa.addLayer(heatLayer) : mapa.removeLayer(heatLayer));
  if (lineLayer) (linesVisible ? mapa.addLayer(lineLayer) : mapa.removeLayer(lineLayer));
};

// ═══════════════════════ 3) Planilhas CSV
const SHEETS = {
  meta: "https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139",
  points: "https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat: "https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
  lines: "https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/export?format=csv",
};

// ═══════════════════════ 4) Carrega metadados e inicia fluxo
Papa.parse(SHEETS.meta, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: ({ data }) => {
    data.forEach((r) => {
      metaRod[r.id] = {
        kmIni: parseFloat(r.kmIni.replace(/,/, ".")),
        kmFim: parseFloat(r.kmFim.replace(/,/, ".")),
        iniLat: +r.LatLonIni.split(",")[0],
        iniLon: +r.LatLonIni.split(",")[1],
        fimLat: +r.LatLonFim.split(",")[0],
        fimLon: +r.LatLonFim.split(",")[1],
      };
    });
    carregarRC();
  },
});

// ═══════════════════════ 5) Carrega shapefiles das RCs
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

// ═══════════════════════ 6) Carrega KMZ único "malha_dr02.kmz"
async function loadMalha() {
  const MALHA_PATH = "data/malha_dr02.kmz"; // ajuste se necessário

  try {
    const resp = await fetch(MALHA_PATH);
    if (!resp.ok) throw new Error(`Falha HTTP ${resp.status} ao buscar ${MALHA_PATH}`);

    const zipBuffer = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);
    const kmlEntry = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith(".kml"));
    if (!kmlEntry) throw new Error(".kml não encontrado dentro do KMZ");

    const xml = await zip.file(kmlEntry).async("string");
    const geoRaw = toGeoJSON.kml(new DOMParser().parseFromString(xml, "text/xml"));

    const linhas = geoRaw.features
      .filter((f) => f.geometry && ["LineString", "MultiLineString"].includes(f.geometry.type))
      .map((f) => turf.simplify(f, { tolerance: 0.00005, highQuality: false }));

    linhas.forEach((feat) => {
      const id = (feat.properties?.name || "Rodovia").replaceAll("_", " ").trim();
      rodLayers[id] = L.geoJSON(feat, {
        pane: "rodoviasPane",
        style: { color: "#555", weight: 3, opacity: 0.9 },
      }).addTo(mapa);
      // nome completo agora vai para o rótulo
      addLabel(rodLayers[id].getBounds().getCenter(), id, "rod-label");
    });

    if (Object.keys(rodLayers).length) {
      mapa.fitBounds(L.featureGroup(Object.values(rodLayers)).getBounds());
    }

    reloadSheets();
    refreshVis();
  } catch (err) {
    console.error("Falha ao carregar malha DR.02:", err);
  }
}

// ═══════════════════════ 7) Funções CSV dinâmicas (mesmas do rev1) ...
