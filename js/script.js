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
    icon: L.divIcon({ className: cls, html: txt, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

// ═══════════════════════ 2) Variáveis globais
const metaRod = {},
  rcLayers = {},
  rodLayers = {};
const pontosLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
let heatLayer = null;

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
  meta: "https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139",
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

    geo.features
      .filter((f) => f.geometry && ["LineString", "MultiLineString"].includes(f.geometry.type))
      .forEach((feat) => {
        const nome = (feat.properties?.name || "Rodovia").replaceAll("_", " ").trim();
        rodLayers[nome] = L.geoJSON(turf.simplify(feat, { tolerance: 0.00005 }), {
          pane: "rodoviasPane",
          style: { color: "#555", weight: 3, opacity: 0.9 },
        }).addTo(mapa);
        addLabel(rodLayers[nome].getBounds().getCenter(), nome, "rod-label");
      });

    mapa.fitBounds(L.featureGroup(Object.values(rodLayers)).getBounds());
    reloadSheets();
    refreshVis();
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
        const km = parseFloat(d.KM.replace(",", "."));
        if (!km || km < meta.kmIni || km > meta.kmFim) return;

        const rel = km - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const pt = turf.along(line, rel, { units: "kilometers" });

        L.circleMarker([pt.geometry.coordinates[1], pt.geometry.coordinates[0]], {
          pane: "overlayPane",
          radius: +d.Raio || 6,
          color: d.Cor || "#1976d2",
          weight: 2,
          fillColor: d.Cor || "#1976d2",
          fillOpacity: 1,
        })
          .bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs || ""}`)
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
