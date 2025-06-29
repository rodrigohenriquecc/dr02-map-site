/* global L, JSZip, shp, turf */

/* ─────────── LISTAS ─────────── */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz','data/RC2.2_SP165.kmz','data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz','data/RC2.2_SP250.kmz','data/RC2.2_SPA294.250.kmz'
];

/* ─────────── META-DADOS Km ─────────── */
const metaRod = {};
fetch('data/rodovias_meta.json')
  .then(r => r.json())
  .then(arr => arr.forEach(m => metaRod[m.id] = m));

/* ─────────── MAPA ─────────── */
const isMobile = window.matchMedia('(max-width:600px)').matches;
const mapa = L.map('map').setView([-23.8, -48.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(mapa);

/* ▸ Layers control agora só para basemap (sem overlays de rodovia/RC) */
L.control.layers(null, null, { collapsed: isMobile }).addTo(mapa);

const rcLayers = {}, rodLayers = {};

/* ─────────── helpers ─────────── */
const addLabel = (p, txt, cls) =>
  L.marker(p, { icon: L.divIcon({ className: cls, html: txt, iconSize: null }), interactive: false })
    .addTo(mapa);

function zoomGlobal() {
  const b = L.featureGroup([...Object.values(rcLayers), ...Object.values(rodLayers)]).getBounds();
  if (b.isValid()) mapa.fitBounds(b);
}

/* ─────────── BOTÃO mobile abre/fecha painel KM ─────────── */
const kmCard = document.getElementById('kmCard');
document.getElementById('btnToggle').onclick = () => {
  kmCard.style.display = kmCard.style.display === 'block' ? 'none' : 'block';
};
if (!isMobile) kmCard.style.display = 'block';   // desktop já aberto

/* ─────────── UI localizar Km ─────────── */
document.getElementById('btnKm').onclick = localizarKm;
document.getElementById('selRod').onchange = e => {
  const m = metaRod[e.target.value];
  document.getElementById('infoKm').textContent =
    m ? `Km ${m.kmIni} – ${m.kmFim}` : '';
};
function atualizarSelect() {
  const sel = document.getElementById('selRod');
  const old = sel.value;
  sel.innerHTML = '<option value="">(selecione)</option>' +
    Object.keys(rodLayers).sort().map(r => `<option>${r}</option>`).join('');
  sel.value = old;
  sel.onchange({ target: sel });
}

/* ─────────── REGIÕES RC (somente visuais) ─────────── */
Promise.all(RC_ZIPS.map(async zip => {
  try {
    const geo = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_', ' ');
    const lyr = L.geoJSON(geo, { style: { color: '#000', weight: 2.5, fill: false } })
      .addTo(mapa).bindPopup(nome);
    rcLayers[nome] = lyr;
    addLabel(lyr.getBounds().getCenter(), nome, 'rc-label');
  } catch (e) { console.error('RC', zip, e); }
})).then(zoomGlobal);

/* ─────────── KMZ → GeoJSON (só LineString, sem overlay) ─────────── */
KMZ_FILES.forEach(async file => {
  try {
    const resp = await fetch(encodeURI(file));
    if (!resp.ok) { console.error('404', file); return; }

    const buf = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const kml = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.kml'));
    if (!kml) { console.warn('KMZ sem KML:', file); return; }

    const geo = kmlToGeoJSON(await zip.file(kml).async('string'));
    const title = file.split('/').pop().replace('.kmz', '');

    /* apenas adiciona a linha no mapa — sem filtros */
    const lyr = L.geoJSON(geo, {
      style: { color: '#555', weight: 3, opacity: .9 },
      filter: f => f.geometry.type === 'LineString'
    }).addTo(mapa);

    rodLayers[title] = lyr;
    atualizarSelect();

    /* rótulo SP ### */
    const sig = (/SP[A-Z]?\s*\d+/i).exec(title);
    if (sig) {
      lyr.eachLayer(l => {
        if (l.getBounds && l.getBounds().isValid())
          addLabel(l.getBounds().getCenter(), sig[0].toUpperCase(), 'rod-label');
      });
    }
    zoomGlobal();
  } catch (e) { console.error('KMZ', file, e); }
});

/* ─────────── localizar Km ─────────── */
function localizarKm() {
  const rod = document.getElementById('selRod').value;
  const km = parseFloat(document.getElementById('kmAlvo').value);
  if (!rod || isNaN(km)) { alert('Escolha rodovia e Km'); return; }

  const meta = metaRod[rod];
  if (!meta || km < meta.kmIni || km > meta.kmFim) {
    alert(`KM fora do intervalo!\nVálido: ${meta.kmIni} – ${meta.kmFim}`); return;
  }
  const lyr = rodLayers[rod];
  if (!lyr) { alert('Camada não carregada'); return; }
  const lines = lyr.toGeoJSON().features.filter(f => f.geometry.type === 'LineString');

  let restante = km - meta.kmIni, pt = null;
  for (const ln of lines) {
    const len = turf.length(ln, { units: 'kilometers' });
    if (restante <= len) { pt = turf.along(ln, restante, { units: 'kilometers' }); break; }
    restante -= len;
  }
  if (!pt) { const ln = lines.at(-1); pt = turf.along(ln, turf.length(ln, { units: 'kilometers' }), { units: 'kilometers' }); }

  const [lon, lat] = pt.geometry.coordinates;
  L.popup().setLatLng([lat, lon])
    .setContent(`<b>${rod}</b><br>KM ${km.toFixed(3)}`)
    .openOn(mapa);
  mapa.setView([lat, lon], 15);
}

/* ─────────── KML → GeoJSON (LineString) ─────────── */
function kmlToGeoJSON(txt) {
  const dom = new DOMParser().parseFromString(txt, 'text/xml');
  const feats = [];
  [...dom.getElementsByTagName('Placemark')].forEach(pm => {
    const line = pm.getElementsByTagName('LineString')[0];
    if (line) {
      const coords = line.getElementsByTagName('coordinates')[0].textContent.trim()
        .split(/\s+/).map(s => s.split(',').map(Number).slice(0, 2));
      if (coords.length > 1)
        feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
    }
  });
  return { type: 'FeatureCollection', features: feats };
}
