/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// ═══════════════════════ 0) Firebase (compat)
let db=null,col=null,online=false;
try{
  firebase.initializeApp({
    apiKey:"AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:"consorciolh-8b5bc.firebaseapp.com",
    projectId:"consorciolh-8b5bc",
    storageBucket:"consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId:"128910789036",
    appId:"1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  });
  db=firebase.firestore(); col=db.collection("pontos"); online=true;
}catch(e){console.warn("Firestore off:",e);}

// ═══════════════════════ 1) Mapa e panes
const mapa=L.map("map").setView([-23.8,-48.5],7);
["shapefilePane","rodoviasPane","overlayPane"].forEach((p,i)=>{
  mapa.createPane(p).style.zIndex=400+i*50;
  if(i<2) mapa.getPane(p).style.pointerEvents="none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:"© OpenStreetMap"}).addTo(mapa);

// ═══════════════════════ helpers
const rodLabels=[];   // ← guarda todos os markers-rótulo (rodovias)
const addLabel=(latlng,txt,cls)=>{
  const mk = L.marker(latlng,{
    pane:"overlayPane",
    icon:L.divIcon({className:cls,html:txt,iconSize:null}),
    interactive:false
  }).addTo(mapa);
  if(cls==="rod-label") rodLabels.push(mk);
  return mk;
};

// anti-sobreposição
function updateRodLabels(){
  const used=[];
  rodLabels.forEach(m=>{
    const el=m.getElement(); if(!el) return;
    const p = mapa.latLngToLayerPoint(m.getLatLng());
    let ok=true;
    used.forEach(u=>{
      if(Math.abs(p.x-u.x)<50 && Math.abs(p.y-u.y)<18) ok=false;
    });
    el.style.display = ok ? "" : "none";
    if(ok) used.push(p);
  });
}
mapa.on("zoomend moveend",updateRodLabels);

// ═══════════════════════ 2) Dados globais
const metaRod={}, rcLayers={}, rodLayers={};
const pontosLayer=L.layerGroup([], {pane:"overlayPane"}).addTo(mapa);
let heatLayer=null, lineLayer=null, kmzQueue=new Set();

// visibilidade
let pointsVisible=true, heatVisible=true, linesVisible=true;
const refreshVis=()=>{
  pointsVisible ? mapa.addLayer(pontosLayer) : mapa.removeLayer(pontosLayer);
  if(heatLayer) (heatVisible?mapa.addLayer(heatLayer):mapa.removeLayer(heatLayer));
  if(lineLayer) (linesVisible?mapa.addLayer(lineLayer):mapa.removeLayer(lineLayer));
};

// ═══════════════════════ 3) CSV URLs
const SHEETS={
  meta  :"https://docs.google.com/spreadsheets/d/e/2PACX-1vQFlIqR8uJswhy2cU0CdaPyjbJE0G-j4dN8Yjh_2vdaLd6e0fUKHjgVf7Attyf_AA/pub?output=csv",
  points:"https://docs.google.com/spreadsheets/d/e/2PACX-1vS2BwPeGD29Q2UaBvdZY0e4lkiIZcYWgv_aVTQKKHbpTaRMcU9DNO9Pkx1SCYZJzQ/pub?output=csv",
  heat  :"https://docs.google.com/spreadsheets/d/e/2PACX-1vRUcP1W7JKWQcLXA25FiwsUu_qMljBHo9XYU26SlUHORak9k7bgx2LdDYZB122m0g/pub?output=csv",
  lines :"https://docs.google.com/spreadsheets/d/e/2PACX-1vS2BwPeGD29Q2UaBvdZY0e4lkiIZcYWgv_aVTQKKHbpTaRMcU9DNO9Pkx1SCYZJzQ/pub?output=csv"
};

// ═══════════════════════ 4) metaRod → base
Papa.parse(SHEETS.meta,{
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      metaRod[r.id]={
        kmIni:parseFloat(r.kmIni.replace(",","."))
       ,kmFim:parseFloat(r.kmFim.replace(",","."))
       ,iniLat:+r.LatLonIni.split(",")[0], iniLon:+r.LatLonIni.split(",")[1]
       ,fimLat:+r.LatLonFim.split(",")[0], fimLon:+r.LatLonFim.split(",")[1]
      };
    });
    carregarRC();
  }
});

// ═══════════════════════ 5) RC shapefiles (uma única vez)
async function carregarRC(){
  for(const p of [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ]){
    try{
      const geo=await shp(p);
      const name=p.match(/RC_[\d._]+/)[0].replace("_"," ");
      rcLayers[name]=L.geoJSON(geo,{pane:"shapefilePane",
        style:{color:"#6e6d6d",weight:2.5,fill:false}}).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(),name,"rc-label");
    }catch(e){console.error("RC falhou",p,e);}
  }
  lazyLoadKMZ();
  mapa.on("moveend",lazyLoadKMZ);

  reloadSheets(); refreshVis(); updateRodLabels();
}

// ═══════════════════════ 6) Lazy-load KMZ + simplificar
async function lazyLoadKMZ(){
  const pad=1.5, b=mapa.getBounds();
  const latMin=b.getSouth()-pad, latMax=b.getNorth()+pad;
  const lonMin=b.getWest()-pad , lonMax=b.getEast()+pad;

  for(const id of Object.keys(metaRod)){
    if(rodLayers[id]||kmzQueue.has(id)) continue;
    const m=metaRod[id];
    const inView=
      (m.iniLat>latMin&&m.iniLat<latMax&&m.iniLon>lonMin&&m.iniLon<lonMax)||
      (m.fimLat>latMin&&m.fimLat<latMax&&m.fimLon>lonMin&&m.fimLon<lonMax);
    if(!inView) continue;

    kmzQueue.add(id);
    try{
      const resp=await fetch(`data/${id}.kmz`);
      if(!resp.ok){kmzQueue.delete(id);continue;}
      const zip=await JSZip.loadAsync(await resp.arrayBuffer());
      const kml=Object.keys(zip.files).find(f=>f.toLowerCase().endsWith(".kml"));
      const xml=await zip.file(kml).async("string");
      const raw=toGeoJSON.kml(new DOMParser().parseFromString(xml,"text/xml"));

      raw.features=raw.features.map(f=>{
        if(f.geometry.type==="LineString"||f.geometry.type==="MultiLineString")
          return turf.simplify(f,{tolerance:0.00005});
        return f;
      });
      const geo={type:"FeatureCollection",
        features:raw.features.filter(f=>f.geometry&&(
          f.geometry.type==="LineString"||f.geometry.type==="MultiLineString"))};

      rodLayers[id]=L.geoJSON(geo,{pane:"rodoviasPane",
        style:{color:"#000000",weight:3,opacity:0.9}}).addTo(mapa);
      addLabel(rodLayers[id].getBounds().getCenter(),id.split("_")[1],"rod-label");
      refreshVis(); updateRodLabels();
    }catch(e){console.error("KMZ falhou",id,e);}
    finally{kmzQueue.delete(id);}
  }
}

// ═══════════════════════ 7) Recarrega CSV dinâmicos
function reloadSheets(){
  pontosLayer.clearLayers();
  if(heatLayer) mapa.removeLayer(heatLayer), heatLayer=null;
  if(lineLayer) mapa.removeLayer(lineLayer), lineLayer=null;
  loadPoints(); loadHeat(); loadLines();
}

// …  (resto do código — loadPoints, loadHeat, loadLines, controles UI) …
