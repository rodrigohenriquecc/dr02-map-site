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
    .catch(err => console.error(`Erro no ${info.file}:`, err));

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
const excelFile = 'planilha.xlsx';   // ↩️  ajuste aqui se usar outro nome

(async () => {
  try {
    const url = `data/${encodeURIComponent(excelFile)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Status ${resp.status} para ${url}`);
    console.info(`✓ Planilha carregada: ${excelFile}`);
    parseExcel(await resp.arrayBuffer());
  } catch (err) {
    console.error(err);
    alert(`Não foi possível baixar "${excelFile}". Verifique o nome e o commit em /data/.`);
  }
})();

/* ------------ FUNÇÃO PRINCIPAL ------------- */
function parseExcel(buf) {
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca SheetJS não carregou. Confira a ordem das tags <script>.');
    console.error('XLSX is not defined.');
    return;
  }

  const wb    = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const head  = data[0].map(h => (h || '').toString().trim());

  /* ---------- MOSTRA CABEÇALHOS ---------- */
  window.head = head;          // pode digitar "head" no console
  console.table(head);         // imprime tabela 0,1,2,… → cabeçalho

  /* ---------- CONFIGURE AQUI ---------- *
   * 1) Veja no console qual coluna é qual;
   * 2) Troque os índices OU regex abaixo;
   * 3) Salve e recarregue.                */
  const rcIdx  = head.findIndex(h => /^rc|regional$/i.test(h));    // ou número fixo
  const rodIdx = head.findIndex(h => /^rod|rodovia$/i.test(h));    // ou número fixo
  const latIdx = head.findIndex(h => /^lat/i.test(h));             // ou número fixo
  const lonIdx = head.findIndex(h => /^lon/i.test(h));             // ou número fixo
  /* ------------------------------------ */

  if ([rcIdx, rodIdx, latIdx, lonIdx].includes(-1)) {
    alert('⚠️ Ajuste os índices/regex em script.js para RC, Rodovia, Latitude, Longitude.\n' +
          'Veja o console.table(head) para os nomes corretos.');
    return;
  }

  const seqIdx = head.findIndex(h => /seq|ordem|index/i.test(h));

  const grupos = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[latIdx] == null || row[lonIdx] == null) continue;

    const lat = parseFloat(row[latIdx].toString().replace(',', '.'));
    const lon = parseFloat(row[lonIdx].toString().replace(',', '.'));
    if (isNaN(lat) || isNaN(lon)) continue;

    const chave = `${row[rcIdx]} ${row[rodIdx]}`.trim();
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ lat, lon, seq: seqIdx >= 0 ? +row[seqIdx] : i });
  }

  const roadLayers = {};
  Object.entries(grupos).forEach(([name, pts]) => {
    pts.sort((a, b) => a.seq - b.seq);
    const line = L.polyline(pts.map(p => [p.lat, p.lon]),
                            { color: '#666', weight: 3 });
    line.addTo(map);
    roadLayers[name] = line;
  });

  // Interface de filtros
  const cont = document.getElementById('rodovia-filters');
  Object.keys(roadLayers).sort().forEach(name => {
    const lb = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.onchange = e => e.target.checked
      ? map.addLayer(roadLayers[name])
      : map.removeLayer(roadLayers[name]);
    lb.append(cb, ` ${name}`);
    cont.appendChild(lb);
  });
}
