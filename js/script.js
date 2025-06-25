/* global L, shp, XLSX */
/* ---------------------------------------------------------
 * 1. MAPA BASE
 * --------------------------------------------------------- */
const map = L.map('map').setView([-23.5, -47.8], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function randomColor(alpha = 0.2) {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------------------------------------------------
 * 2. REGIÕES – SHAPEFILES ZIP
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
regions.forEach(info => {
  const color = randomColor();
  const layer = L.geoJson(null, {
    style: { color, weight: 1, fillColor: color, fillOpacity: 0.2 }
  });

  shp(`data/${encodeURIComponent(info.file)}`)
    .then(gj => {
      layer.addData(gj);
      if (!map._initialFitDone) {
        map.fitBounds(layer.getBounds());
        map._initialFitDone = true;
      }
    })
    .catch(err => console.error(`Erro ao ler ${info.file}:`, err));

  layer.addTo(map);
  regionLayers[info.name] = layer;
});

document.querySelectorAll('.region-filter').forEach(cb => {
  cb.addEventListener('change', e => {
    const n = e.target.dataset.region;
    e.target.checked ? map.addLayer(regionLayers[n])
                     : map.removeLayer(regionLayers[n]);
  });
});

/* ---------------------------------------------------------
 * 3. MALHA DE RODOVIAS – PLANILHA EXCEL
 * --------------------------------------------------------- */
const excelFile = 'planilha.xlsx';        // nome da planilha em /data/

(async () => {
  try {
    const url  = `data/${encodeURIComponent(excelFile)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    parseExcel(await resp.arrayBuffer());
  } catch (err) {
    console.error(err);
    alert(`Não foi possível baixar "${excelFile}". Verifique o nome em /data/.`);
  }
})();

function parseExcel(buf) {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS não carregou – confira as tags <script>.');
    return;
  }

  const wb    = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const head  = data[0].map(h => (h || '').toString().trim());

  /* ---- DETECÇÃO DE ÍNDICES POR NOME ---- */
  const rcIdx  = head.findIndex(h => /^rc$/i.test(h));
  const rodIdx = head.findIndex(h => /^sp$/i.test(h));
  const kmIdx  = head.findIndex(h => /^km$/i.test(h));
  const latIdx = head.findIndex(h => /^lat$/i.test(h));
  const lonIdx = head.findIndex(h => /^lon$/i.test(h));

  if ([rcIdx, rodIdx, kmIdx, latIdx, lonIdx].includes(-1)) {
    console.table(head);
    alert('Alguma das colunas RC, SP, KM, LAT ou LON não foi encontrada. Veja o console.');
    return;
  }

  /* ---- AGRUPA PONTOS ---- */
  const grupos = {};
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const lat = parseFloat(String(row[latIdx]).replace(',', '.'));
    const lon = parseFloat(String(row[lonIdx]).replace(',', '.'));
    if (isNaN(lat) || isNaN(lon)) continue;

    total++;
    const chave = `${row[rcIdx]} ${row[rodIdx]}`.trim();
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ lat, lon, seq: +row[kmIdx] || i });
  }
  console.log('Pontos válidos encontrados:', total);

  /* ---- DESENHA LINHAS ---- */
  const roadLayers = {};
  Object.entries(grupos).forEach(([name, pts]) => {
    pts.sort((a, b) => a.seq - b.seq);
    const line = L.polyline(pts.map(p => [p.lat, p.lon]),
                            { color: '#666', weight: 3 });
    line.addTo(map);
    roadLayers[name] = line;
  });

  /* ---- FILTROS ---- */
  const box = document.getElementById('rodovia-filters');
  Object.keys(roadLayers).sort().forEach(name => {
    const lab = document.createElement('label');
    const cb  = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.onchange = e => e.target.checked
      ? map.addLayer(roadLayers[name])
      : map.removeLayer(roadLayers[name]);
    lab.append(cb, ' ', name);
    box.appendChild(lab);
  });
}
