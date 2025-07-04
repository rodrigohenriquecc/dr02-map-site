/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// ── 0) Firebase compat ─────────────────────────────────────
let db = null, col = null, online = false;
try {
  firebase.initializeApp({
    apiKey:            "AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:        "consorciolh-8b5bc.firebaseapp.com",
    projectId:         "consorciolh-8b5bc",
    storageBucket:     "consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId: "128910789036",
    appId:             "1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  });
  db  = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch (e) {
  console.warn("Firestore não configurado:", e);
}

// ── 1) Mapa + panes ───────────────────────────────────────
const mapa = L.map("map").setView([-23.8, -48.5], 7);
["shapefilePane", "rodoviasPane", "overlayPane"].forEach((p, i) => {
  mapa.createPane(p).style.zIndex = 400 + i * 50;
  if (i < 2) mapa.getPane(p).style.pointerEvents = "none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);

// helpers
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: cls, html: txt, iconSize: null }),
    interactive: false
  }).addTo(mapa);

const zoomGlobal = () => {
  const b = L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodoviasLayers),
    ...pontosLayer.getLayers()
  ]).getBounds();
  if (b.isValid()) mapa.fitBounds(b);
};

// ── 2) Dados globais ───────────────────────────────────────
const metaRod = {}, rcLayers = {}, rodoviasLayers = {};
const pontosLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
let heatLayer = null, lineLayer = null;

// ── 3) URLs das planilhas (CSV) ────────────────────────────
const SHEETS = {
  meta:   "https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139",
  points: "https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat:   "https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
  lines:  "https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/export?format=csv"
};

// ── 4) metaRod → depois shapefiles/KMZ ─────────────────────
Papa.parse(SHEETS.meta, {
  download: true, header: true, skipEmptyLines: true,
  complete: ({ data }) => {
    data.forEach(r => {
      const kmIni = parseFloat(r.kmIni.replace(",", "."));
      const kmFim = parseFloat(r.kmFim.replace(",", "."));
      const [iniLat, iniLon] = r.LatLonIni.split(",").map(Number);
      const [fimLat, fimLon] = r.LatLonFim.split(",").map(Number);
      metaRod[r.id] = { kmIni, iniLat, iniLon, kmFim, fimLat, fimLon };
    });
    carregarBase();
  },
  error: err => console.error("metaRod falhou:", err)
});

// ── 5) Carrega shapefiles RC e KMZ rodovias ───────────────
async function carregarBase() {

  // 5-A  RC
  for (const p of [
    "data/RC_2.1.zip", "data/RC_2.2.zip", "data/RC_2.4.zip",
    "data/RC_2.5.zip", "data/RC_2.6_2.8.zip", "data/RC_2.7.zip"
  ]) {
    try {
      const geo = await shp(p);
      const name = p.match(/RC_[\d._]+/)[0].replace("_", " ");
      rcLayers[name] = L.geoJSON(geo, {
        pane: "shapefilePane",
        style: { color: "#000", weight: 2.5, fill: false }
      }).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(), name, "rc-label");
    } catch (e) { console.error("RC falhou:", p, e); }
  }

  // 5-B  KMZ
  if (typeof toGeoJSON === "undefined") {
    alert("Biblioteca toGeoJSON não carregou.");
    return;
  }
  for (const id of Object.keys(metaRod)) {
    try {
      const resp = await fetch(`data/${id}.kmz`);
      if (!resp.ok) continue;
      const zip = await JSZip.loadAsync(await resp.arrayBuffer());
      const kml = Object.keys(zip.files).find(f => f.toLowerCase().endsWith(".kml"));
      const geo = toGeoJSON.kml(
        new DOMParser().parseFromString(await zip.file(kml).async("string"), "text/xml")
      );
      rodoviasLayers[id] = L.geoJSON(geo, {
        pane: "rodoviasPane",
        filter: f => f.geometry &&
          (f.geometry.type === "LineString" || f.geometry.type === "MultiLineString"),
        style: { color: "#555", weight: 3, opacity: 0.9 }
      }).addTo(mapa);
      addLabel(rodoviasLayers[id].getBounds().getCenter(),
               id.split("_")[1], "rod-label");
    } catch (e) { console.error("KMZ falhou:", id, e); }
  }

  // filtro rodovias
  const sel = document.getElementById("selRod");
  sel.innerHTML = '<option value="">(todas)</option>' +
    Object.keys(rodoviasLayers).sort()
      .map(id => `<option value="${id}">${id.split("_")[1]}</option>`).join("");
  sel.onchange = () => {
    const v = sel.value;
    Object.entries(rodoviasLayers)
      .forEach(([id, lyr]) => (v === "" || id === v)
        ? mapa.addLayer(lyr) : mapa.removeLayer(lyr));
  };

  // planilhas dinâmicas
  reloadSheets();
  zoomGlobal();
}

// ── 6) Recarrega as três planilhas online ──────────────────
function reloadSheets() {
  pontosLayer.clearLayers();
  if (heatLayer) mapa.removeLayer(heatLayer);
  if (lineLayer) mapa.removeLayer(lineLayer);

  loadPoints();
  loadHeat();
  loadLines();
}

// botão ⟳ sempre ativo
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnCSV");
  if (btn) btn.onclick = reloadSheets;
});

// ── 7) Pontos de interesse ─────────────────────────────────
function loadPoints() {
  Papa.parse(SHEETS.points, {
    download: true, header: true, skipEmptyLines: true,
    complete: ({ data }) => {
      data.forEach(d => {
        let key = d.Rodovia, seg = rodoviasLayers[key];
        if (!seg) {
          const mk = Object.keys(rodoviasLayers).find(k => k.endsWith("_" + d.Rodovia));
          if (mk) { seg = rodoviasLayers[mk]; key = mk; }
        }
        const m = metaRod[key], km = parseFloat(d.KM.replace(",", "."));
        if (!seg || !m || isNaN(km) || km < m.kmIni || km > m.kmFim) return;
        const rel = km - m.kmIni,
          line = seg.toGeoJSON().features.find(f => f.geometry.type === "LineString"),
          pt = turf.along(line, rel, { units: "kilometers" });
        L.circleMarker([pt.geometry.coordinates[1], pt.geometry.coordinates[0]], {
          pane: "overlayPane",
          radius: parseFloat(d.Raio) || 6,
          color: d.Cor || "#1976d2",
          weight: 2, fillColor: d.Cor || "#1976d2", fillOpacity: 1
        }).bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs || ""}`)
          .addTo(pontosLayer);
      });
    }
  });
}

// ── 8) Heatmap ─────────────────────────────────────────────
function loadHeat() {
  Papa.parse(SHEETS.heat, {
    download: true, header: true, skipEmptyLines: true,
    complete: ({ data }) => {
      if (heatLayer) mapa.removeLayer(heatLayer);
      const pts = [];
      data.forEach(r => {
        let key = r.Rodovia, seg = rodoviasLayers[key];
        if (!seg) {
          const mk = Object.keys(rodoviasLayers).find(k => k.endsWith("_" + r.Rodovia));
          if (mk) { seg = rodoviasLayers[mk]; key = mk; }
        }
        const m = metaRod[key],
          km0 = parseFloat(r["Km Inicial"].replace(",", ".")),
          km1 = parseFloat(r["Km Final"].replace(",", "."));
        if (!seg || !m || isNaN(km0) || isNaN(km1)) return;
        const rel0 = km0 - m.kmIni, rel1 = km1 - m.kmIni,
          line = seg.toGeoJSON().features.find(f => f.geometry.type === "LineString"),
          p0 = turf.along(line, rel0, { units: "kilometers" }),
          p1 = turf.along(line, rel1, { units: "kilometers" }),
          slice = turf.lineSlice(p0, p1, line),
          Ls = turf.length(slice, { units: "kilometers" }),
          samples = Math.ceil(Ls * 5) + 1;
        for (let i = 0; i <= samples; i++) {
          const p = turf.along(slice, (Ls * i) / samples, { units: "kilometers" });
          pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
        }
      });
      heatLayer = L.heatLayer(pts, { radius: 25, blur: 15 }).addTo(mapa);
    }
  });
}

// ── 9) Linhas por trecho ───────────────────────────────────
function loadLines() {
  Papa.parse(SHEETS.lines, {
    download: true, header: true, skipEmptyLines: true,
    complete: ({ data }) => {
      if (lineLayer) mapa.removeLayer(lineLayer);
      const grp = L.layerGroup([], { pane: "rodoviasPane" }).addTo(mapa);
      data.forEach(rw => {
        let key = rw.Rodovia, seg = rodoviasLayers[key];
        if (!seg) {
          const mk = Object.keys(rodoviasLayers).find(k => k.endsWith("_" + rw.Rodovia));
          if (mk) { seg = rodoviasLayers[mk]; key = mk; }
        }
        const m = metaRod[key],
          km0 = parseFloat(rw["Km Inicial"].replace(",", ".")),
          km1 = parseFloat(rw["Km Final"].replace(",", "."));
        if (!seg || !m || isNaN(km0) || isNaN(km1)) return;

        const feat = seg.toGeoJSON().features
          .find(f => f.geometry.type === "LineString");
        if (!feat) return;

        const p0 = turf.along(feat, km0 - m.kmIni, { units: "kilometers" }),
          p1 = turf.along(feat, km1 - m.kmIni, { units: "kilometers" }),
          slice = turf.lineSlice(p0, p1, feat);

        L.geoJSON(slice, {
          pane: "rodoviasPane",
          style: {
            color: rw.Cor || "#f00",
            weight: parseFloat(rw.Espessura) || 4
          }
        })
          .bindPopup(
            `<b>${key}</b><br>Km ${km0.toFixed(3)}–${km1.toFixed(3)}<br>${rw.Obs || ""}`
          )
          .addTo(grp);
      });
      lineLayer = grp;
    }
  });
}
