/* global L, JSZip, toGeoJSON, shp */

/* ---------- REGIÕES RC (zip) ----------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip',
  'data/RC_2.2.zip',
  'data/RC_2.4.zip',
  'data/RC_2.5.zip',
  'data/RC_2.6_2.8.zip',
  'data/RC_2.7.zip'
];

/* ---------- RODOVIAS (KMZ – nomes exatos) ---------------- */
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ---------- MAPA BASE ------------------------------------ */
const mapa = L.map('map').setView([-23.8, -48.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom : 19, attribution : '&copy; OpenStreetMap'
}).addTo(mapa);

const painel   = L.control.layers(null,null,{collapsed:false}).addTo(mapa);
const rcLayers = {}, rodLayers = {};

/* ---------- CARREGA SHAPEFILES RC ------------------------ */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo  = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const lyr  = L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                   .addTo(mapa).bindPopup(nome);
    rcLayers[nome]=lyr; painel.addOverlay(lyr,'🗺️ '+nome);

    L.marker(lyr.getBounds().getCenter(),{
      icon:L.divIcon({className:'rc-label',html:nome,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  }catch(e){console.error('RC',zip,e);}
})).then(zoomGlobal);

/* ---------- CARREGA KMZ (JSZip + toGeoJSON) -------------- */
KMZ_FILES.forEach(async file=>{
  try{
    const arr  = await fetch(file).then(r=>r.arrayBuffer());
    const zip  = await JSZip.loadAsync(arr);
    const kmlN = Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlN){console.warn('sem KML em',file);return;}
    const kmlT = await zip.file(kmlN).async('string');
    const geo  = toGeoJSON.kml((new DOMParser()).parseFromString(kmlT,'text/xml'));

    const titulo = file.split('/').pop().replace('.kmz','');
    const lyr = L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9}})
                  .addTo(mapa);
    rodLayers[titulo]=lyr; painel.addOverlay(lyr,'📄 '+titulo);

    const sig = (/SP[A-Z]?\s*\d+/i).exec(titulo);
    if(sig){
      lyr.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid()){
          L.marker(l.getBounds().getCenter(),{
            icon:L.divIcon({className:'rod-label',
              html:sig[0].toUpperCase(),iconSize:null}),
            interactive:false
          }).addTo(mapa);
        }
      });
    }
    zoomGlobal();
  }catch(e){console.error('Falha KMZ',file,e);}
});

/* ---------- AJUSTA ZOOM GLOBAL --------------------------- */
function zoomGlobal(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}
