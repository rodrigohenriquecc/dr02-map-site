/* global L, JSZip, shp */

/* ------------ LISTA DE ARQUIVOS ------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];

const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ------------ CARREGA toGeoJSON UMA ÚNICA VEZ ----------- */
let tgj = null;
async function getTGJ(){
  if (tgj) return tgj;
  tgj = await import('https://cdn.jsdelivr.net/npm/togeojson@0.16.0/dist/togeojson.umd.min.js');
  return tgj;
}

/* ------------ MAPA -------------------------------------- */
const mapa = L.map('map').setView([-23.8,-48.5],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);

const painel=L.control.layers(null,null,{collapsed:false}).addTo(mapa);
const rcLayers={}, rodLayers={};

const addLabel=(p,txt,cls)=>L.marker(p,{
  icon:L.divIcon({className:cls,html:txt,iconSize:null}),
  interactive:false}).addTo(mapa);

function zoomAll(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ------------ REGIÕES (ZIP) ----------------------------- */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const g=await shp(zip);
    const n=zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const lyr=L.geoJSON(g,{style:{color:'#000',weight:2.5,fill:false}})
                .addTo(mapa).bindPopup(n);
    rcLayers[n]=lyr; painel.addOverlay(lyr,'🗺️ '+n);
    addLabel(lyr.getBounds().getCenter(),n,'rc-label');
  }catch(e){console.error('RC',zip,e);}
})).then(zoomAll);

/* ------------ RODOVIAS (KMZ) ---------------------------- */
KMZ_FILES.forEach(async file=>{
  try{
    const resp=await fetch(encodeURI(file));
    if(!resp.ok){console.error('404',file);return;}
    const buf =await resp.arrayBuffer();
    const zip =await JSZip.loadAsync(buf);
    const kml =Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kml){console.warn('KMZ sem KML:',file);return;}

    const kmlText=await zip.file(kml).async('string');
    const {kml:parseKML}=await getTGJ();  // <-- garante toGeoJSON
    const geo=parseKML(new DOMParser().parseFromString(kmlText,'text/xml'));

    const title=file.split('/').pop().replace('.kmz','');
    const lyr=L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9}})
                .addTo(mapa);
    rodLayers[title]=lyr; painel.addOverlay(lyr,'📄 '+title);

    const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
    if(sig){
      lyr.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid())
          addLabel(l.getBounds().getCenter(),
                   sig[0].toUpperCase(),'rod-label');
      });
    }
    zoomAll();
  }catch(e){console.error('KMZ',file,e);}
});
