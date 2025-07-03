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
const metaRod     = {};      // id → {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon}
const rcLayers    = {}, rodLayers = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer     = null, lineLayer = null;
const rodLabels   = [];

// Base tiles + controle de camadas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(mapa);
L.control.layers(null, null, { collapsed: isMobile }).addTo(mapa);

// 2) Helpers
function addLabel(latlng, text, cls) {
  const m = L.marker(latlng, {
    icon: L.divIcon({ className: cls, html: text, iconSize: null }),
    interactive: false
  }).addTo(mapa);
  if (cls === "rod-label") rodLabels.push(m);
}
function zoomGlobal() {
  const all = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ];
  const b = L.featureGroup(all).getBounds();
  if (b.isValid()) mapa.fitBounds(b);
}
function updateRodLabels() {
  const used = [];
  rodLabels.forEach(m => {
    const el = m.getElement(); if (!el) return;
    const p  = mapa.latLngToLayerPoint(m.getLatLng());
    let ok = true;
    for (const u of used) {
      if (Math.abs(p.x - u.x) < 50 && Math.abs(p.y - u.y) < 50) {
        ok = false; break;
      }
    }
    el.style.display = ok ? "" : "none";
    if (ok) used.push(p);
  });
}

// 3) Carrega metaRod (Google Sheets CSV)
const SHEET_URL = 
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_URL, {
  download: true, header: true, skipEmptyLines: true,
  complete: ({ data }) => {
    console.log("metaRod linhas:", data.length);
    data.forEach(r => {
      const kmIni = parseFloat(r.kmIni.replace(",", "."));
      const kmFim = parseFloat(r.kmFim.replace(",", "."));
      const [iniLat, iniLon] = r.LatLonIni.split(",").map(Number);
      const [fimLat, fimLon] = r.LatLonFim.split(",").map(Number);
      metaRod[r.id] = { kmIni, iniLat, iniLon, kmFim, fimLat, fimLon };
    });
    carregarData();
  },
  error: err => console.error("Erro metaRod:", err)
});

// 4) Carrega RC (.zip) e Rodovias (.kmz)
async function carregarData() {
  console.log("Iniciando carregarData()");
  // 4.1) RC shapefiles — nomes exatos na pasta data/
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
      const name = zipPath.match(/RC_[\d._]+/)[0].replace("_", " ");
      const lyr  = L.geoJSON(geo, { style:{ color:"#000", weight:2.5, fill:false } })
                     .addTo(mapa);
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
        style: { color:"#555", weight:3, opacity:0.9 },
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
  // Toggle KM panel
  document.getElementById("btnToggle").onclick = () => {
    const c = document.getElementById("kmCard");
    c.style.display = c.style.display==="block" ? "none" : "block";
  };
  // Menu import/clear
  const menu = document.getElementById("uploadMenu");
  document.getElementById("btnCSV").onclick = () => {
    menu.style.display = menu.style.display==="block" ? "none" : "block";
  };
  menu.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const m = btn.dataset.mode;
      if (!m) return;
      menu.style.display = "none";
      document.getElementById(
        m==="points"   ? "csvPointsInput" :
        m==="heatmap"  ? "csvHeatInput" :
        m==="line"     ? "csvLineInput" : ""
      ).click();
    };
  });
  // Clear
  document.getElementById("btnClearPoints").onclick   = () => pontosLayer.clearLayers();
  document.getElementById("btnClearHeatmap").onclick = () => {
    if (heatLayer) mapa.removeLayer(heatLayer), heatLayer = null;
  };
  document.getElementById("btnClearLines").onclick   = () => {
    if (lineLayer) mapa.removeLayer(lineLayer), lineLayer = null;
  };
  // Excel inputs
  document.getElementById("csvPointsInput").onchange = e => {
    console.log("csvPointsInput onchange");
    if (e.target.files[0]) processPointsExcel(e.target.files[0]);
  };
  document.getElementById("csvHeatInput").onchange = e => {
    console.log("csvHeatInput onchange");
    if (e.target.files[0]) processHeatExcel(e.target.files[0]);
  };
  document.getElementById("csvLineInput").onchange = e => {
    console.log("csvLineInput onchange");
    if (e.target.files[0]) processLineExcel(e.target.files[0]);
  };
  // KM locator & save button
  document.getElementById("btnKm").onclick   = localizarKm;
  document.getElementById("btnSave").onclick = salvarFirestore;

  // popula select rodovia
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
    const wb  = XLSX.read(buf, { type:"array" });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows= XLSX.utils.sheet_to_json(ws, { defval:"" });
    pontosLayer.clearLayers();
    rows.forEach(d => {
      let key = d.Rodovia, seg = rodLayers[key];
      if (!seg) {
        const mk = Object.keys(rodLayers).find(k => k.endsWith("_"+d.Rodovia));
        if (mk) { seg = rodLayers[mk]; key = mk; }
      }
      const m  = metaRod[key];
      const km = parseFloat(String(d.KM).replace(",","."));
      if (!seg||!m||isNaN(km)||km<m.kmIni||km>m.kmFim) return;
      const rel  = km - m.kmIni;
      const feat = seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
      const pt   = turf.along(feat, rel, { units:"kilometers" });
      const [lon,lat] = pt.geometry.coordinates;
      L.circleMarker([lat,lon], {
        radius: parseFloat(d.Raio)||6,
        color:  d.Cor||"#1976d2",
        weight: 2,
        fillColor: d.Cor||"#1976d2",
        fillOpacity: 1
      })
      .bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs||""}`)
      .addTo(pontosLayer);
    });
    if (pontosLayer.getLayers().length) mapa.fitBounds(pontosLayer.getBounds());
  };
  r.readAsArrayBuffer(file);
}

// 7) Process Excel – Mapa de Calor
function processHeatExcel(file) {
  console.log("processHeatExcel:", file.name);
  const r = new FileReader();
  r.onload = e => {
    const buf = new Uint8Array(e.target.result);
    const wb  = XLSX.read(buf, { type:"array" });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows= XLSX.utils.sheet_to_json(ws, { defval:"" });
    if (heatLayer) mapa.removeLayer(heatLayer), heatLayer = null;
    const pts = [];
    rows.forEach(rw => {
      let key = rw.Rodovia, seg = rodLayers[key];
      if (!seg) {
        const mk = Object.keys(rodLayers).find(k=>k.endsWith("_"+rw.Rodovia));
        if (mk) { seg = rodLayers[mk]; key = mk; }
      }
      const m   = metaRod[key];
      const km0 = parseFloat(String(rw["Km Inicial"]).replace(",","."));
      const km1 = parseFloat(String(rw["Km Final"]).replace(",","."));
      if (!seg||!m||isNaN(km0)||isNaN(km1)) return;
      const rel0 = km0 - m.kmIni, rel1 = km1 - m.kmIni;
      const feat = seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
      const p0   = turf.along(feat, rel0, { units:"kilometers" });
      const p1   = turf.along(feat, rel1, { units:"kilometers" });
      const slice= turf.lineSlice(p0, p1, feat);
      const Ls   = turf.length(slice,{ units:"kilometers" });
      const samples = Math.ceil(Ls*5)+1;
      for (let i=0; i<=samples; i++){
        const p = turf.along(slice, (Ls*i)/samples, { units:"kilometers" });
        pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
      }
    });
    heatLayer = L.heatLayer(pts, { radius:25, blur:15 }).addTo(mapa);
    zoomGlobal();
  };
  r.readAsArrayBuffer(file);
}

// 8) Process Excel – Linhas por trecho
function processLineExcel(file) {
  console.log("processLineExcel:", file.name);
  const r = new FileReader();
  r.onload = e => {
    const buf = new Uint8Array(e.target.result);
    const wb  = XLSX.read(buf, { type:"array" });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows= XLSX.utils.sheet_to_json(ws, { defval:"" });
    if (lineLayer) mapa.removeLayer(lineLayer), lineLayer = null;
    const grp = L.layerGroup().addTo(mapa);
    rows.forEach(rw => {
      let key = rw.Rodovia, seg = rodLayers[key];
      if (!seg) {
        const mk = Object.keys(rodLayers).find(k=>k.endsWith("_"+rw.Rodovia));
        if (mk) { seg = rodLayers[mk]; key = mk; }
      }
      const m   = metaRod[key];
      const km0 = parseFloat(String(rw["Km Inicial"]).replace(",","."));
      const km1 = parseFloat(String(rw["Km Final"]).replace(",","."));
      if (!seg||!m||isNaN(km0)||isNaN(km1)) return;
      const rel0 = km0 - m.kmIni, rel1 = km1 - m.kmIni;
      const feat = seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
      const p0   = turf.along(feat, rel0, { units:"kilometers" });
      const p1   = turf.along(feat, rel1, { units:"kilometers" });
      const slice= turf.lineSlice(p0, p1, feat);
      L.geoJSON(slice, { style:{ color:rw.Cor||"#f00", weight:parseFloat(rw.Espessura)||4 } })
       .bindPopup(`<b>${key}</b><br>Km ${km0}–${km1}<br>${rw.Obs||""}`)
       .addTo(grp);
    });
    lineLayer = grp;
    zoomGlobal();
  };
  r.readAsArrayBuffer(file);
}

// 9) Localizar KM
function localizarKm() {
  const rod = document.getElementById("selRod").value,
        km  = parseFloat(document.getElementById("kmAlvo").value.replace(",","."));
  const m = metaRod[rod];
  if (!rod||isNaN(km)||!m||km<m.kmIni||km>m.kmFim) {
    return alert("Informe rodovia válida e Km dentro do intervalo.");
  }
  const feat = rodLayers[rod].toGeoJSON().features.find(f=>f.geometry.type==="LineString");
  const pt   = turf.along(feat, km - m.kmIni, { units:"kilometers" });
  const [lon, lat] = pt.geometry.coordinates;
  L.popup().setLatLng([lat, lon])
    .setContent(`<b>${rod}</b><br>KM ${km.toFixed(3)}`)
    .openOn(mapa);
  mapa.setView([lat, lon], 15);
}

// 10) Firestore load/save
function carregarFirestore() {
  col.get().then(snap => {
    console.log("Firestore:", snap.size, "pontos");
    snap.forEach(doc => console.log(doc.id, doc.data()));
    zoomGlobal();
  }).catch(e => console.warn("Firestore off-line:", e.message));
}
async function salvarFirestore() {
  if (!online) return alert("Firestore off-line.");
  const pts = Object.values(pontosLayer._layers).map(m => m.options.meta);
  if (!pts.length) return alert("Nenhum ponto para salvar.");
  try {
    const snap = await col.get();
    const del  = db.batch();
    snap.forEach(d => del.delete(d.ref));
    await del.commit();
    const setB = db.batch();
    pts.forEach((d,i) => setB.set(col.doc(String(i)), d));
    await setB.commit();
    alert("✅ Dados salvos com sucesso!");
  } catch(e) {
    console.error(e);
    alert("Erro ao salvar.");
  }
}

// 11) KML → GeoJSON helper
function kmlToGeoJSON(xmlStr) {
  const dom = new DOMParser().parseFromString(xmlStr, "text/xml"),
        feats = [];
  Array.from(dom.getElementsByTagName("Placemark")).forEach(pm => {
    const ls = pm.getElementsByTagName("LineString")[0];
    if (!ls) return;
    const coords = ls.getElementsByTagName("coordinates")[0].textContent
      .trim().split(/\s+/).map(s => s.split(",").map(Number).slice(0,2));
    if (coords.length>1) feats.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords }
    });
  });
  return { type:"FeatureCollection", features: feats };
}
