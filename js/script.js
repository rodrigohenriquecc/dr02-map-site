/* global L, shp, XLSX */
/* ---------------------------------------------------------
 * 1. MAPA BASE
 * --------------------------------------------------------- */
const map = L.map('map').setView([-23.5, -47.8], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function randomColor(alpha = 1) {                // alpha = 1 → cor opaca
  const r = () => Math.floor(Math.random() * 255);
  return `rgba(${r()},${r()},${r()},${alpha})`;
}

/* ---------------------------------------------------------
 * 2. REGIÕES – SHAPEFILES (somente bordas grossas, sem fill)
 * --------------------------------------------------------- */
const regions = [
  { name: 'RC 2.1', file: 'RC 2.1.zip' },
  { name: 'RC 2.2', file: 'RC 2.2.zip' },
  { name: 'RC 2.4', file: 'RC 2.4.zip' },
  { name: 'RC 2.5', file: 'RC 2.5.zip' },
  { name: 'RC 2.6+2.8', file: 'RC 2.6+2.8.zip' },
  { name: 'RC 2.7', file: 'RC 2.7.zip' }
];

const regionLayers = {};
regions.forEach(({ name, file }) => {
  const stroke = randomColor();                         // cor da borda
  const layer = L.geoJson(null, {
    style: { color: stroke, weight: 3, fillOpacity: 0 } // ← sem preenchimento
  });

  shp(`data/${encodeURIComponent(file)}`)
    .then(gj => {
      layer.addData(gj);
      if (!map._fit) { map.fitBounds(layer.getBounds()); map._fit = true; }
    })
    .catch(err => console.error(`Erro ao ler ${file}:`, err));

  layer.addTo(map);
  regionLayers[name] = layer;
});

document.querySelectorAll('.region-filter').forEach(cb =>
  cb.onchange = e => e.target.checked
    ? map.addLayer(regionLayers[e.target.dataset.region])
    : map.removeLayer(regionLayers[e.target.dataset.region])
);

/* ---------------------------------------------------------
 * 3. MALHA DE RODOVIAS – PLANILHA EXCEL (RC, SP, KM, LAT, LON)
 * --------------------------------------------------------- */
const excelFile = 'planilha.xlsx';

fetch(`data/${encodeURIComponent(excelFile)}`)
  .then(r => r.arrayBuffer())
  .then(buf => parseExcel(buf))
  .catch(() => alert(`Falha ao baixar ${excelFile
