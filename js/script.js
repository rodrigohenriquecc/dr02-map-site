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
  .catch(() => alert(`Falha ao baixar ${excelFile}. Verifique em /data/.`));

function detectIdx(header, key) {
  return header.findIndex(h => h.replace(/\s+/g, '').toUpperCase() === key);
}

function parseExcel(buf) {
  if (!window.XLSX) { alert('SheetJS não carregou.'); return; }

  const sheet = XLSX.read(buf, { type:'array' }).Sheets;
  const data  = XLSX.utils.sheet_to_json(sheet[Object.keys(sheet)[0]], { header:1, defval:null });
  const head  = data[0].map(h => (h || '').toString().trim());

  const rc   = detectIdx(head,'RC');
  const sp   = detectIdx(head,'SP');
  const km   = detectIdx(head,'KM');
  const lat  = detectIdx(head,'LAT');
  const lon  = detectIdx(head,'LON');

  if ([rc,sp,km,lat,lon].includes(-1)) {
    console.table(head);
    alert('RC, SP, KM, LAT ou LON não encontrados.');
    return;
  }

  const roads = {}, toNum = v => parseFloat(String(v).replace(',','.'));
  for (let i = 1; i < data.length; i++) {
    const row = data[i], la = toNum(row[lat]), lo = toNum(row[lon]);
    if (isNaN(la) || isNaN(lo)) continue;
    const key = `${row[rc]} ${row[sp]}`.trim();
    (roads[key] ||= []).push({ la, lo, seq:+row[km] || i });
  }

  const roadLayers = {};
  Object.entries(roads).forEach(([name, pts]) => {
    pts.sort((a,b) => a.seq - b.seq);
    roadLayers[name] = L.polyline(pts.map(p => [p.la,p.lo]),
                                  { color:'#666', weight:3 }).addTo(map);
  });

  /* filtros */
  const box = document.getElementById('rodovia-filters');
  Object.keys(roadLayers).sort().forEach(name => {
    const lab = document.createElement('label');
    const cb  = document.createElement('input');
    cb.type='checkbox'; cb.checked=true;
    cb.onchange = e => e.target.checked
      ? map.addLayer(roadLayers[name])
      : map.removeLayer(roadLayers[name]);
    lab.append(cb,' ',name); box.append(lab);
  });
}
