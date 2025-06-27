/* global L, JSZip, toGeoJSON, shp */

/* ---------- LISTAS DOS ARQUIVOS -------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];
const KMZ_FILES = [
  'data/SP 181 Separado.kmz',
  'data/SP 250 Separado.kmz'
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
    const resp = await fetch(encodeURI(file));
    const buf  = await resp.arrayBuffer();
    const zip  = await JSZip.loadAsync(buf);
    const kmlFile = Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlFile){console.warn('sem KML em',file);return;}
    const kmlText = await zip.file(kmlFile).async('string');
    const kmlDom  = new DOMParser().parseFromString(kmlText,'text/xml');
    const geojson = toGeoJSON.kml(kmlDom);

    const title = file.split('/').pop().replace('.kmz','');
    const layer = L.geoJSON(geojson,{
      style:{color:'#555',weight:3,opacity:.9}
    }).addTo(mapa);
    rodLayers[title]=layer;
    painel.addOverlay(layer,'📄 '+title);

    /* rótulos SP ### */
    layer.eachLayer(l=>{
      if(l.getBounds&&l.getBounds().isValid()){
        const sig = /SP\s*\d+/i.exec(title);
        if(sig){
          L.marker(l.getBounds().getCenter(),
            {icon:L.divIcon({className:'rod-label',html:sig[0],iconSize:null}),
             interactive:false}).addTo(mapa);
        }
      }
    });
    reenquadrar();
  }catch(e){
    console.error('Falha KMZ',file,e);
  }
});

/* ---------- AJUSTA ZOOM GLOBAL --------------------------- */
function reenquadrar(){
  const todas={...rcLayers,...rodLayers};
  if(!Object.keys(todas).length) return;
  const b=L.featureGroup(Object.values(todas)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}
