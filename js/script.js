/* global L, JSZip, shp, toGeoJSON */

/* ───────────── LISTA DE ARQUIVOS ───────────── */
const RC_ZIPS = [
  'data/RC_2.1.zip',
  'data/RC_2.2.zip',
  'data/RC_2.4.zip',
  'data/RC_2.5.zip',
  'data/RC_2.6_2.8.zip',
  'data/RC_2.7.zip'
];

const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ───────────── MAPA BASE ────────────────────── */
const mapa = L.map('map').setView([-23.8,-48.5],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(mapa);

const painel  = L.control.layers(null,null,{collapsed:false}).addTo(mapa);
const rcLayers={}, rodLayers={};

/* helpers */
const addLabel = (p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),
              interactive:false}).addTo(mapa);

function zoomGlobal(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ───────────── REGIÕES (ZIP) ────────────────── */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo  = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const lyr  = L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                   .addTo(mapa).bindPopup(nome);
    rcLayers[nome]=lyr; painel.addOverlay(lyr,'🗺️ '+nome);
    addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
  }catch(e){console.error('RC',zip,e);}
})).then(zoomGlobal);

/* ───────────── RODOVIAS (KMZ) ───────────────── */
KMZ_FILES.forEach(async file=>{
  try{
    const resp = await fetch(encodeURI(file));
    if(!resp.ok){console.error('404',file);return;}

    const buf   = await resp.arrayBuffer();
    const zip   = await JSZip.loadAsync(buf);
    const kmlFn = Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlFn){console.warn('KMZ sem KML:',file);return;}

    const kmlTx = await zip.file(kmlFn).async('string');
    const geo   = toGeoJSON.kml(
                    new DOMParser().parseFromString(kmlTx,'text/xml'));

    const titulo=file.split('/').pop().replace('.kmz','');
    const lyr=L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9}})
               .addTo(mapa);
    rodLayers[titulo]=lyr; painel.addOverlay(lyr,'📄 '+titulo);

    const sig=(/SP[A-Z]?\s*\d+/i).exec(titulo);
    if(sig){
      lyr.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid())
          addLabel(l.getBounds().getCenter(),
                   sig[0].toUpperCase(),'rod-label');
      });
    }
    zoomGlobal();
  }catch(e){console.error('KMZ',file,e);}
});
