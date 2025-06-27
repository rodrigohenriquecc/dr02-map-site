/* global L, JSZip, toGeoJSON, shp */

/* ---------- LISTAS DE ARQUIVOS -------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];

/* ——— NOVOS KMZ enviados ——— */
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ---------- MAPA BASE ------------------------------------ */
const mapa = L.map('map')
  .addLayer(L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom:19, attribution:'&copy; OpenStreetMap' }));

const painel = L.control.layers(null,null,{collapsed:false}).addTo(mapa);

const rcLayers={}, rodLayers={};

/* ---------- REGIÕES RC (shapefile .zip) ------------------ */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const layer=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                 .addTo(mapa).bindPopup(nome);
    rcLayers[nome]=layer; painel.addOverlay(layer,'🗺️ '+nome);
    L.marker(layer.getBounds().getCenter(),
      {icon:L.divIcon({className:'rc-label',html:nome,iconSize:null}),
       interactive:false}).addTo(mapa);
  }catch(e){console.error('RC',zip,e);}
})).then(reenquadrar);

/* ---------- KMZ → GeoJSON → Leaflet ---------------------- */
KMZ_FILES.forEach(async file=>{
  try{
    const resp   = await fetch(encodeURI(file));
    const buf    = await resp.arrayBuffer();
    const zip    = await JSZip.loadAsync(buf);
    const kmlName= Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlName){console.warn('sem KML em',file);return;}
    const kmlTxt = await zip.file(kmlName).async('string');
    const kmlDom = new DOMParser().parseFromString(kmlTxt,'text/xml');
    const geo    = toGeoJSON.kml(kmlDom);

    const title = file.split('/').pop().replace('.kmz','');
    const layer = L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9}})
                    .addTo(mapa);
    rodLayers[title]=layer; painel.addOverlay(layer,'📄 '+title);

    /* rótulo “SP 127” etc. */
    const sigMatch = /SP[A-Z]?\s*\d+/i.exec(title);
    if(sigMatch){
      layer.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid()){
          L.marker(l.getBounds().getCenter(),{
            icon:L.divIcon({className:'rod-label',html:sigMatch[0].toUpperCase(),iconSize:null}),
            interactive:false
          }).addTo(mapa);
        }
      });
    }
    reenquadrar();
  }catch(e){console.error('Falha KMZ',file,e);}
});

/* ---------- ZOOM ----------------------------------------- */
function reenquadrar(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}
