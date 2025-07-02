/* global L, JSZip, shp, turf, Papa, firebase */

// ─── 0. Configuração Firebase (compat) ─────────────────────────
let db = null, col = null, online = false;
try {
  const firebaseConfig = {
    apiKey:            "AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:        "consorciolh-8b5bc.firebaseapp.com",
    projectId:         "consorciolh-8b5bc",
    storageBucket:     "consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId: "128910789036",
    appId:             "1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  };
  firebase.initializeApp(firebaseConfig);
  db  = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch(e) {
  console.warn("Firestore off-line ou não configurado:", e);
}

// ─── Globals ────────────────────────────────────────────────────
const isMobile    = matchMedia("(max-width:600px)").matches;
const mapa        = L.map("map").setView([-23.8,-48.5],7);
const metaRod     = {}; // id → {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon}
const rcLayers    = {}, rodLayers = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer, lineLayer;

// Tile + layers control
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "&copy; OpenStreetMap"
}).addTo(mapa);
L.control.layers(null, null, {collapsed: isMobile}).addTo(mapa);

// ─── Helpers ────────────────────────────────────────────────────
const addLabel = (p, txt, cls) =>
  L.marker(p, {
    icon: L.divIcon({className: cls, html: txt, iconSize: null}),
    interactive: false
  }).addTo(mapa);

function zoomGlobal() {
  const grp = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ];
  const b = L.featureGroup(grp).getBounds();
  if (b.isValid()) mapa.fitBounds(b);
}

// ─── 1. Meta-dados via Google Sheets CSV ─────────────────────────
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";

Papa.parse(SHEET_CSV_URL, {
  download: true,
  header:   true,
  skipEmptyLines: true,
  complete: ({data}) => {
    data.forEach(r => {
      const kmIni = parseFloat(r.kmIni.toString().replace(",", "."));
      const kmFim = parseFloat(r.kmFim.toString().replace(",", "."));
      const [iniLat, iniLon] = r.LatLonIni.split(",").map(Number);
      const [fimLat, fimLon] = r.LatLonFim.split(",").map(Number);
      metaRod[r.id] = {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon};
    });
    carregarData();
  },
  error: err => alert("Falha ao carregar meta-planilha:\n" + err.message)
});

// ─── 2. Carrega RC (.zip) e rodovias (.kmz) ─────────────────────
async function carregarData() {
  // 2.1 RC shapefiles
  const RC_ZIPS = [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ];
  for (const zip of RC_ZIPS) {
    try {
      const geo  = await shp(zip);
      const nome = zip.match(/RC_[\d._]+/)[0].replace("_", " ");
      const lyr  = L.geoJSON(geo, {style: {color: "#000", weight: 2.5, fill: false}})
                     .addTo(mapa);
      rcLayers[nome] = lyr;
      addLabel(lyr.getBounds().getCenter(), nome, "rc-label");
    } catch(e) {
      console.error("RC", zip, e);
    }
  }

  // 2.2 Rodovias via metaRod keys
  for (const id of Object.keys(metaRod)) {
    const path = `data/${id}.kmz`;
    try {
      const resp = await fetch(path);
      if (!resp.ok) { console.warn("KMZ não encontrado:", path); continue; }
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const kml = Object.keys(zip.files)
                      .find(n => n.toLowerCase().endsWith(".kml"));
      if (!kml) { console.warn("KMZ sem KML:", path); continue; }
      const txt = await zip.file(kml).async("string");
      const geo = kmlToGeoJSON(txt);
      const lyr = L.geoJSON(geo, {
        style: {color: "#555", weight: 3, opacity: 0.9},
        filter: f => f.geometry.type === "LineString"
      }).addTo(mapa);
      rodLayers[id] = lyr;
      const label = id.includes('_') ? id.split('_')[1] : id;
      addLabel(lyr.getBounds().getCenter(), label, "rod-label");
    } catch(e) {
      console.error("KMZ", path, e);
    }
  }

  zoomGlobal();
  initUI();
  if (online) carregarFirestore();
}

// ─── 3. Monta UI & handlers ─────────────────────────────────────
function initUI() {
  const kmCard = document.getElementById("kmCard");
  if (!isMobile) kmCard.style.display = "block";
  document.getElementById("btnToggle").onclick = () =>
    kmCard.style.display = (kmCard.style.display === "block" ? "none" : "block");

  const menu = document.getElementById("uploadMenu");
  document.getElementById("btnCSV").onclick = () =>
    menu.style.display = (menu.style.display === "block" ? "none" : "block");
  menu.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      menu.style.display = "none";
      document.getElementById({
        points: "csvPointsInput",
        heatmap: "csvHeatInput",
        line: "csvLineInput"
      }[mode]).click();
    };
  });

  document.getElementById("csvPointsInput").onchange = e =>
    e.target.files[0] && processPointsCSV(e.target.files[0]);
  document.getElementById("csvHeatInput").onchange   = e =>
    e.target.files[0] && processHeatCSV(e.target.files[0]);
  document.getElementById("csvLineInput").onchange   = e =>
    e.target.files[0] && processLineCSV(e.target.files[0]);

  const sel = document.getElementById("selRod");
  sel.innerHTML = '<option value="">(selecione)</option>' +
    Object.keys(rodLayers).sort().map(r => `<option>${r}</option>`).join("");
  sel.onchange = e => {
    const m = metaRod[e.target.value];
    document.getElementById("infoKm").textContent =
      m ? `Km ${m.kmIni} – ${m.kmFim}` : "";
  };
  document.getElementById("btnKm").onclick = localizarKm;

  document.getElementById("btnSave").onclick = salvarFirestore;
}

// ─── 4. Pontos de interesse ────────────────────────────────────
function processPointsCSV(file) {
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: res => {
      pontosLayer.clearLayers();
      res.data.forEach(addPonto);
      if (Object.keys(pontosLayer._layers).length)
        mapa.fitBounds(pontosLayer.getBounds());
    }
  });
}
function addPonto(d) {
  const km   = parseFloat(d.KM.toString().replace(",", ".")),
        cor  = d.Cor || "#1976d2",
        raio = parseFloat(d.Raio) || 6;
  const seg = rodLayers[d.Rodovia], meta = metaRod[d.Rodovia];
  if (!seg || !meta || isNaN(km) || km < meta.kmIni || km > meta.kmFim) return;
  const rel  = km - meta.kmIni;
  const line = seg.toGeoJSON().features.find(f => f.geometry.type === "LineString");
  const pt   = turf.along(line, rel, {units:"kilometers"});
  const [lon, lat] = pt.geometry.coordinates;
  L.circleMarker([lat, lon], {
    radius: raio, color: cor, weight:2,
    fillColor: cor, fillOpacity:1
  }).bindPopup(`<b>${d.Rodovia}</b> Km ${d.KM}<br>${d.Obs||""}`)
    .addTo(pontosLayer);
}

// ─── 5. Mapa de Calor ──────────────────────────────────────────
function processHeatCSV(file) {
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: res => {
      if (heatLayer) mapa.removeLayer(heatLayer);
      const pts = [];
      res.data.forEach(r => {
        const seg  = rodLayers[r.Rodovia], meta = metaRod[r.Rodovia];
        if (!seg || !meta) return;
        const km0 = parseFloat(r["Km Inicial"].toString().replace(",", ".")),
              km1 = parseFloat(r["Km Final"].toString().replace(",", "."));
        const rel0 = km0 - meta.kmIni, rel1 = km1 - meta.kmIni;
        const line = seg.toGeoJSON().features.find(f => f.geometry.type==="LineString");
        const p0   = turf.along(line, rel0, {units:"kilometers"});
        const p1   = turf.along(line, rel1, {units:"kilometers"});
        const slice= turf.lineSlice(p0, p1, line);
        const Ls   = turf.length(slice, {units:"kilometers"});
        const samples = Math.ceil(Ls*5)+1;
        for (let i=0; i<=samples; i++) {
          const p = turf.along(slice, Ls*(i/samples), {units:"kilometers"});
          pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
        }
      });
      heatLayer = L.heatLayer(pts, {radius:25, blur:15}).addTo(mapa);
      zoomGlobal();
    }
  });
}

// ─── 6. Linhas por trecho ──────────────────────────────────────
function processLineCSV(file) {
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: res => {
      if (lineLayer) mapa.removeLayer(lineLayer);
      const grp = L.layerGroup().addTo(mapa);
      res.data.forEach(r => {
        const seg = rodLayers[r.Rodovia], meta = metaRod[r.Rodovia];
        if (!seg || !meta) return;
        const km0 = parseFloat(r["Km Inicial"].toString().replace(",", ".")),
              km1 = parseFloat(r["Km Final"].toString().replace(",", "."));
        const rel0 = km0 - meta.kmIni, rel1 = km1 - meta.kmIni;
        const line = seg.toGeoJSON().features.find(f => f.geometry.type==="LineString");
        const p0   = turf.along(line, rel0, {units:"kilometers"});
        const p1   = turf.along(line, rel1, {units:"kilometers"});
        const slice= turf.lineSlice(p0, p1, line);
        L.geoJSON(slice, {
          style: { color: r.Cor || "#f00", weight: parseFloat(r.Espessura) || 4 }
        }).bindPopup(`<b>${r.Rodovia}</b><br>Km ${km0}–${km1}<br>${r.Obs||""}`)
          .addTo(grp);
      });
      lineLayer = grp;
      zoomGlobal();
    }
  });
}

// ─── 7. Localizar Km ───────────────────────────────────────────
function localizarKm() {
  const rod = document.getElementById("selRod").value;
  const km  = parseFloat(document.getElementById("kmAlvo").value.replace(",","."));
  const meta= metaRod[rod];
  if (!rod || isNaN(km) || !meta || km < meta.kmIni || km > meta.kmFim) {
    return alert("Informe rodovia válida e Km dentro do intervalo.");
  }
  const line = rodLayers[rod].toGeoJSON().features.find(f => f.geometry.type===\
