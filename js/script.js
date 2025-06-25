/* global L, shp, XLSX */

// ===============================
// 1. MAPA BASE
// ===============================
const map = L.map('map').setView([-23.5, -47.8], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Utilitário: cor RGBA aleatória com alpha opcional
function randomColor(alpha = 0.2) {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ===============================
// 2. REGIÕES – SHAPEFILES .ZIP
// ===============================
const regions = [
  { name: 'RC 2.1', file: 'RC 2.1.zip' },
  { name: 'RC 2.2', file: 'RC 2.2.zip' },
  { name: 'RC 2.4', file: 'RC 2.4.zip' },
  { name: 'RC 2.5', file: 'RC 2.5.zip' },
  { name: 'RC 2.6+2.8', file: 'RC 2.6+2.8.zip' },
  { name: 'RC 2.7', file: 'RC 2.7.zip' }
];

const regionLayers = {};

regions.forEach(info => {
  const color = randomColor();
  const layer = L.geoJson(null, {
    style: {
      color: color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.2
    }
  });

  // Carrega o ZIP → GeoJSON
  shp(`data/${info.file}`)
    .then(geojson => {
      layer.addData(geojson);
      // Ajuste opcional de bounds na 1ª região carregada
      if (!map._initialFitDone) {
        map.fitBounds(layer.getBounds());
        map._initialFitDone = true;
      }
    })
    .catch(err => {
      console.error(`Erro ao ler ${info.file}:`, err);
      alert(`Não foi possível ler ${info.file}. Veja o console para detalhes.`);
    });

  layer.addTo(map);
  regionLayers[info.name] = layer;
});

// Checkboxes para ligar/desligar regiões
document.querySelectorAll('.region-filter').forEach(cb => {
  cb.addEventListener('change', e => {
    const name = e.target.dataset.region;
    if (e.target.checked) {
      map.addLayer(regionLayers[name]);
    } else {
      map.removeLayer(regionLayers[name]);
    }
  });
});

// ===============================
// 3. MALHA DE RODOVIAS – EXCEL
// ===============================
fetch('data/PLANILHA BI - OFICIAL.xlsx')
  .then(r => r.arrayBuffer())
  .then(buf => {
    const workbook = XLSX.read(buf, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // ===== 3.1 DETECTA ÍNDICE DAS COLUNAS =====
    const header = data[0].map(h => (h || '').toString().trim());
    const rcIdx   = header.findIndex(h => /rc\b/i.test(h));
    const rodIdx  = header.findIndex(h => /rodovia|rod\./i.test(h));
    const latIdx  = header.findIndex(h => /lat/i.test(h));
    const lonIdx  = header.findIndex(h => /lon/i.test(h));
    const seqIdx  = header.findIndex(h => /seq|ordem|index/i.test(h));

    if ([rcIdx, rodIdx, latIdx, lonIdx].some(i => i === -1)) {
      console.error('Cabeçalhos detectados:', header);
      alert('Colunas de RC, Rodovia, Latitude ou Longitude não encontradas na planilha.');
      return;
    }

    // ===== 3.2 AGRUPA PONTOS POR RODOVIA =====
    const grupos = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[latIdx] == null || row[lonIdx] == null) continue;

      // Converte para número (troca vírgula por ponto, se necessário)
      const lat = parseFloat(row[latIdx].toString().replace(',', '.'));
      const lon = parseFloat(row[lonIdx].toString().replace(',', '.'));
      if (isNaN(lat) || isNaN(lon)) con
