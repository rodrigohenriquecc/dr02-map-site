/* script.js – DR-02 Map Site
   Requer: leaflet.js, xlsx.full.min.js
   (c) 2025 – Rodrigo Henrique
*/

/* global L, XLSX */

document.addEventListener('DOMContentLoaded', init);

async function init () {
  try {
    const pontos = await lerExcel('planilha.xlsx');   // arquivo deve estar na raiz
    construirMapa(pontos);
  } catch (err) {
    console.error(err);
    alert('Falha ao carregar a planilha:\n' + err.message);
  }
}

/* ------------------------------------------------------------------
   1. Leitura e saneamento da planilha
------------------------------------------------------------------ */
async function lerExcel (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível baixar “${url}”`);
  const buffer = await res.arrayBuffer();

  const wb      = XLSX.read(buffer, { type: 'array' });
  const sheet   = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

  if (rawData.length === 0) throw new Error('Planilha vazia.');

  /* — normaliza cabeçalhos — */
  const cab     = rawData[0].map(s => String(s).trim().toUpperCase());
  const idx     = (arr, name) => arr.indexOf(name);   // helper

  let rc  = idx(cab, 'RC');
  let sp  = idx(cab, 'SP');
  let km  = idx(cab, 'KM');
  let lat = idx(cab, 'LAT');
  let lon = idx(cab, 'LON');

  /* Caso tenha só “LAT,LON” --------------------------------------- */
  const latlon = idx(cab, 'LAT,LON');
  if ((lat === -1 || lon === -1) && latlon !== -1) {
    // substitui um cabeçalho por dois
    cab.splice(latlon, 1, 'LAT', 'LON');
    // percorre as linhas (ignora cabeçalho = linha 0) e divide valores
    for (let i = 1; i < rawData.length; i++) {
      const cel = rawData[i][latlon];
      if (cel == null) continue;
      const [la, lo] = String(cel).split(/[,; ]+/).map(t => t.trim());
      rawData[i].splice(latlon, 1, parseFloat(la), parseFloat(lo));
    }
    lat = latlon;
    lon = latlon + 1;
  }

  /* valida de novo */
  if ([rc, sp, km, lat, lon].includes(-1)) {
    alert('Cabeçalhos RC, SP, KM, LAT, LON não encontrados.');
    console.table(cab);
    throw new Error('Cabeçalhos ausentes');
  }

  /* converte p/ objeto amigável ----------------------------------- */
  return rawData.slice(1).map(l => ({
    rc  : l[rc],
    sp  : l[sp],
    km  : parseFloat(l[km]),
    lat : parseFloat(l[lat]),
    lon : parseFloat(l[lon])
  }));
}

/* ------------------------------------------------------------------
   2. Construção do mapa com Leaflet
------------------------------------------------------------------ */
function construirMapa (pts) {
  const map = L.map('map').setView([-23.8, -48.5], 8);

  /* camada base OSM ------------------------------------------------ */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  /* agrupa pontos por rodovia (RC + SP) ---------------------------- */
  const grupos = {};
  pts.forEach(p => {
    const chave = `${p.rc} | ${p.sp}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(p);
  });

  /* desenha cada rodovia ------------------------------------------ */
  Object.entries(grupos).forEach(([label, arr]) => {
    // ordena por KM para polilinha não “zig-zaguear”
    arr.sort((a, b) => a.km - b.km);

    const linha = L.polyline(
      arr.map(p => [p.lat, p.lon]),
      { color: '#666', weight: 3, opacity: 0.9 }
    ).addTo(map);

    linha.bindPopup(`<b>${label}</b>`);
  });

  /* ajusta a visão ------------------------------------------------- */
  const bounds = pts.map(p => [p.lat, p.lon]);
  if (bounds.length) map.fitBounds(bounds);
}
