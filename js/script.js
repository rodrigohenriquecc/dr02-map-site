/* global L, JSZip, toGeoJSON, shp */

const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];

/* ↘︎  usar grafia EXATA que aparece na URL raw do GitHub Pages */
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ------------- mapa ------------- */
const mapa = L.map('map').setView([-23.8, -48.5], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);

const painel=L.control.layers(null,null,{collapsed:false}).addTo(mapa);
const rcLayers={}, rodLayers={};

/* helper toast */
function toast(msg){
  const d=document.createElement('div');
  d.style.cssText='position:fixed;top:10px;right:10px;background:#d33;color:#fff;padding:8px 12px;border-radius:4px;z-index:9999;font:14px sans-serif';
  d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),6000);
}

/* helper rótulo */
function addLabel(latlng,html,cls){
  L.marker(latlng,{
    icon:L.divIcon({className:cls,html,iconSize:null}),interactive:false
  }).addTo(mapa);
}

/* reajusta zoom global */
function zoomAll(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ------------- RC ---------------- */
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

/* ------------- KMZ --------------- */
KMZ_FILES.forEach(async file=>{
  try{
    const url=encodeURI(file);
    const r=await fetch(url);
    console.log(r.ok?`✔ 200 ${url}`:`❌ 404 ${url}`);
    if(!r.ok){toast(`404 – ${url}`);return;}

    const zipBuf=await r.arrayBuffer();
    const zip=await JSZip.loadAsync(zipBuf);
    const kmlFn=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlFn){toast(`KMZ sem KML: ${file}`);return;}

    const kml=await zip.file(kmlFn).async('string');
    const gj=toGeoJSON.kml(new DOMParser().parseFromString(kml,'text/xml'));
    console.log(`→ ${file}: ${gj.features.length} features`);

    const title=file.split('/').pop().replace('.kmz','');
    const lyr=L.geoJSON(gj,{style:{color:'#555',weight:3,opacity:.9}})
               .addTo(mapa);
    rodLayers[title]=lyr; painel.addOverlay(lyr,'📄 '+title);

    const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
    if(sig){
      lyr.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid()){
          addLabel(l.getBounds().getCenter(),
                   sig[0].toUpperCase(),'rod-label');
        }
      });
    }
    zoomAll();
  }catch(e){
    console.error('Falha KMZ',file,e);
    toast(`Falha lendo ${file}`);
  }
});
