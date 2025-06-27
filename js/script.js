/* global L, JSZip, toGeoJSON, shp */

/* ---------------- ARQUIVOS LOCAIS ------------------- */
/* shapefiles das regiões (zip) */
const RC_ZIPS = [
  'data/RC_2.1.zip',
  'data/RC_2.2.zip',
  'data/RC_2.4.zip',
  'data/RC_2.5.zip',
  'data/RC_2.6_2.8.zip',
  'data/RC_2.7.zip'
];

/* rodovias em KMZ – todos em minúsculas                  */
const KMZ_FILES = [
  'data/rc2.2_sp127.kmz',
  'data/rc2.2_sp165.kmz',
  'data/rc2.2_sp181.kmz',
  'data/rc2.2_sp249.kmz',
  'data/rc2.2_sp250.kmz',
  'data/rc2.2_spa294.250.kmz'
];

/* ---------------- MAPA BASE --------------------------- */
const mapa = L.map('map').setView([-23.8, -48.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom : 19,
  attribution : '&copy; OpenStreetMap'
}).addTo(mapa);

const painel = L.control.layers(null, null, { collapsed: false }).addTo(mapa);
const rcLayers  = {};
const rodLayers = {};

/* ---------------- CARREGA RCS (ZIP) ------------------- */
Promise.all(RC_ZIPS.map(async zip => {
  try {
    const geo  = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_', ' ');
    const lyr  = L.geoJSON(geo, { style:{color:'#000',weight:2.5,fill:false} })
                    .bindPopup(nome).addTo(mapa);
    rcLayers[nome] = lyr;
    painel.addOverlay(lyr, '🗺️ ' + nome);

    L.marker(lyr.getBounds().getCenter(), { icon:
      L.divIcon({className:'rc-label',html:nome,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  } catch (e) { console.error('Erro RC', zip, e); }
})).then(ajustarZoom);

/* ---------------- CARREGA KMZ ------------------------- */
KMZ_FILES.forEach(async file => {
  try {
    const buf   = await fetch(file).then(r => r.arrayBuffer());
    const zip   = await JSZip.loadAsync(buf);
    const kmlFn = Object.keys(zip.files)
                   .find(n => n.toLowerCase().endsWith('.kml'));
    if (!kmlFn) { console.warn('KMZ sem KML:', file); return; }

    const kmlText = await zip.file(kmlFn).async('string');
    const kmlDom  = new DOMParser().parseFromString(kmlText, 'text/xml');
    const geojson = toGeoJSON.kml(kmlDom);

    const title = file.split('/').pop().replace('.kmz','');
    const lyr   = L.geoJSON(geojson,
                   { style:{color:'#555',weight:3,opacity:.9} })
                   .addTo(mapa);
    rodLayers[title] = lyr;
    painel.addOverlay(lyr, '📄 ' + title);

    const sig = (/SP[A-Z]?\s*\d+/i).exec(title);
    if (sig) {
      lyr.eachLayer(l => {
        if (l.getBounds && l.getBounds().isValid()) {
          L.marker(l.getBounds().getCenter(), { icon:
            L.divIcon({className:'rod-label',
              html:sig[0].toUpperCase(),iconSize:null}),
            interactive:false
          }).addTo(mapa);
        }
      });
    }
    ajustarZoom();
  } catch (e) { console.error('Falha KMZ', file, e); }
});

/* ---------------- FUNÇÃO AJUSTAR ZOOM ------------------ */
function ajustarZoom() {
  const todas = {...rcLayers, ...rodLayers};
  if (!Object.keys(todas).length) return;
  const b = L.featureGroup(Object.values(todas)).getBounds();
  if (b.isValid()) mapa.fitBounds(b);
}
