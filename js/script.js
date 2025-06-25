/* global L, shp, XLSX */

// ========== 1. MAPA BASE ==========
const map = L.map('map').setView([-23.5, -47.8], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Utilitário: cor aleatória
function randomColor(alpha = 0.2) {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ========== 2. REGIÕES (shapefiles) ==========
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
    style: { color, weight: 1, fillColor: color, fillOpacity: 0.2 }
  });

  shp(`data/${info.file}`)
    .then(gj => {
      layer.addData(gj);
      if (!map._initialFitDone) {
        map.fitBounds(layer.getBounds());
        map._initialFitDone = true;
      }
    })
    .catch(err => {
      console.error(`Erro no ${info.file}:`, err);
      alert(`Não foi possível ler ${info.file}. Veja o console.`);
    });

  layer.addTo(map);
  regionLayers[info.name] = layer;
});

document.querySelectorAll('.region-filter').forEach(cb => {
  cb.addEventListener('change', e => {
    const name = e.target.dataset.region;
    e.target.checked ? map.addLayer(regionLayers[name])
                     : map.removeLayer(regionLayers[name]);
  });
});

// ========== 3. MALHA DE RODOVIAS (Excel) ==========
fetch('data/PLANILHA BI - OFICIAL.xlsx')
  .then(r
