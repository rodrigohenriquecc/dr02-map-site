/* global L, JSZip, shp, turf, XLSX, Papa, firebase */

// Debug
console.log("script.js carregado");

// 0) Firebase compat
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
  console.warn("Firestore não configurado:", e);
}

// 1) Globais e mapa
const isMobile    = matchMedia("(max-width:600px)").matches;
const mapa        = L.map("map").setView([-23.8, -48.5], 7);
// criar pane para destaques acima das rodovias
mapa.createPane('highlightPane');
mapa.getPane('highlightPane').style.zIndex = 650;

const metaRod     = {};      // id → {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon}
const rcLayers    = {}, rodLayers = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer     = null, lineLayer = null;
const rodLabels   = [];

// Base tiles + controle de camadas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom:19, attribution:"© OpenStreetMap"
}).addTo(mapa);
L.control.layers(null, null, {collapsed:isMobile}).addTo(mapa);

// 2) Helpers
function addLabel(latlng, text, cls) {
  const m = L.marker(latlng, {icon:L.divIcon({className:cls,html:text,iconSize:null}),interactive:false}).addTo(mapa);
  if (cls === "rod-label") rodLabels.push(m);
}
function zoomGlobal() {
  const all = [...Object.values(rcLayers), ...Object.values(rodLayers), ...Object.values(pontosLayer._layers)];
  const b = L.featureGroup(all).getBounds(); if (b.isValid()) mapa.fitBounds(b);
}
function updateRodLabels() {
  const used = [];
  rodLabels.forEach(m => {
    const el = m.getElement(); if (!el) return;
    const p = mapa.latLngToLayerPoint(m.getLatLng());
    let ok = true;
    for (const u of used) {
      if (Math.abs(p.x - u.x) < 50 && Math.abs(p.y - u.y) < 50) { ok = false; break; }
    }
    el.style.display = ok ? "" : "none";
    if (ok) used.push(p);
  });
}

// 3) MetaRod (Google Sheets CSV)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_URL, {download:true,header:true,skipEmptyLines:true,
  complete: ({data}) => {
    console.log("metaRod linhas:", data.length);
    data.forEach(r => {
      const kmIni = parseFloat(r.kmIni.replace(",","."));
      const kmFim = parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon] = r.LatLonIni.split(",").map(Number);
      const [fimLat,fimLon] = r.LatLonFim.split(",").map(Number);
      metaRod[r.id] = {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon};
    });
    carregarData();
  },
  error: err => console.error("Erro metaRod:", err)
});

// 4) Carrega RC (.zip) e KMZ rodovias
async function carregarData() {
  console.log("Iniciando carregarData()");
  // 4.1) RC shapefiles — nomes exatos
  const rcZips = [
    "data/RC_2.1.zip",
    "data/RC_2.2.zip",
    "data/RC_2.4.zip",
    "data/RC_2.5.zip",
    "data/RC_2.6_2.8.zip",
    "data/RC_2.7.zip"
  ];
  for (const zipPath of rcZips) {
    try {
      const geo = await shp(zipPath);
      const name = zipPath.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyr  = L.geoJSON(geo, {style:{color:"#000",weight:2.5,fill:false}}).addTo(mapa);
      rcLayers[name] = lyr;
      addLabel(lyr.getBounds().getCenter(), name, "rc-label");
      console.log("RC carregado:", name);
    } catch(e) {
      console.error("Erro carregando", zipPath, e);
    }
  }
  // 4.2) KMZ rodovias
  for (const id of Object.keys(metaRod)) {
    const path = `data/${id}.kmz`;
    console.log("Tentando KMZ:", path);
    try {
      const resp = await fetch(path);
      if (!resp.ok) { console.warn("KMZ não encontrado:", path); continue; }
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const kml = Object.keys(zip.files).find(f => f.toLowerCase().endsWith(".kml"));
      const txt = await zip.file(kml).async("string");
      const geo = kmlToGeoJSON(txt);
      const lyr = L.geoJSON(geo, {
        pane: 'highlightPane',
        style: {color:"#555",weight:3,opacity:0.9},
        filter: f => f.geometry.type === "LineString"
      }).addTo(mapa);
      rodLayers[id] = lyr;
      const lbl = id.split("_")[1] || id;
      addLabel(lyr.getBounds().getCenter(), lbl, "rod-label");
      console.log("KMZ carregado:", id);
    } catch(e) {
      console.error("Erro KMZ", path, e);
    }
  }
  zoomGlobal();
  mapa.on("zoomend", updateRodLabels);
  initUI();
  if (online) carregarFirestore();
}

// 5) UI e handlers
function initUI() {
  console.log("initUI()");
  document.getElementById("btnToggle").onclick = () => {
    const c = document.getElementById("kmCard");
    c.style.display = c.style.display === "block" ? "none" : "block";
  };
  const menu = document.getElementById("uploadMenu");
  document.getElementById("btnCSV").onclick = () => {
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  };
  menu.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const m = btn.dataset.mode;
      if (!m) return;
      menu.style.display = "none";
      document.getElementById(
        m === "points" ? "csvPointsInput" :
        m === "heatmap" ? "csvHeatInput" :
        m === "line" ? "csvLineInput" : ""
      ).click();
    };
  });
  document.getElementById("btnClearPoints").onclick   = () => pontosLayer.clearLayers();
  document.getElementById("btnClearHeatmap").onclick = () => { if (heatLayer) mapa.removeLayer(heatLayer), heatLayer = null; };
  document.getElementById("btnClearLines").onclick   = () => { if (lineLayer) mapa.removeLayer(lineLayer), lineLayer = null; };
  document.getElementById("csvPointsInput").onchange = e => { console.log("csvPointsInput onchange"); if (e.target.files[0]) processPointsExcel(e.target.files[0]); };
  document.getElementById("csvHeatInput").onchange  = e => { console.log("csvHeatInput onchange"); if (e.target.files[0]) processHeatExcel(e.target.files[0]); };
  document.getElementById("csvLineInput").onchange  = e => { console.log("csvLineInput onchange"); if (e.target.files[0]) processLineExcel(e.target.files[0]); };
  document.getElementById("btnKm").onclick   = localizarKm;
  document.getElementById("btnSave").onclick = salvarFirestore;
  const sel = document.getElementById("selRod");
  sel.innerHTML = '<option value="">(selecione)</option>' +
    Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join("");
}

// 6) Process Excel – Pontos de interesse
function processPointsExcel(file) {
  console.log("processPointsExcel:", file.name);
  const r = new FileReader();
  r.onload = e => {
    const buf = new Uint8Array(e.target.result);
    const wb  = XLSX.read(buf, {type:"array"});
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows= XLSX.utils.sheet_to_json(ws, {defval:""});
    pontosLayer.clearLayers();
    rows.forEach(d => {
      let key = d.Rodovia, seg = rodLayers[key];
      if (!seg) {
        const mk = Object.keys(rodLayers).find(k=>k.endsWith("_"+d.Rodovia));
        if (mk) { seg = rodLayers[mk]; key = mk; }
      }
      const m = metaRod[key];
      const km = parseFloat(String(d.KM).replace(",","."));
      if (!seg||!m||isNaN(km)||km<m.kmIni||km>m.kmFim) return;
      const rel  = km - m.kmIni;
      const feat = seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
      const pt   = turf.along(feat

```
