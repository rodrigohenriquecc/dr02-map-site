/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// ── 0) Firebase (compat) ───────────────────────────────────
let db=null, col=null, online=false;
try {
  firebase.initializeApp({
    apiKey:"AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:"consorciolh-8b5bc.firebaseapp.com",
    projectId:"consorciolh-8b5bc",
    storageBucket:"consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId:"128910789036",
    appId:"1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  });
  db  = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch(e){
  console.warn("Firestore não configurado:",e);
}

// ── 1) Mapa + panes ───────────────────────────────────────
const mapa = L.map("map").setView([-23.8,-48.5],7);
["shapefilePane","rodoviasPane","overlayPane"].forEach((p,i)=>{
  mapa.createPane(p).style.zIndex = 400 + i*50;
  if(i<2) mapa.getPane(p).style.pointerEvents = "none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:"© OpenStreetMap"}).addTo(mapa);

// helpers
function addLabel(latlng, txt, cls){
  try{
    L.marker(latlng,{
      pane:"overlayPane",
      icon:L.divIcon({className:cls,html:txt,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  }catch(e){ console.warn("Label falhou:",txt,e); }
}
function zoomGlobal(){
  const g=L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodoviasLayers),
    ...pontosLayer.getLayers()
  ]);
  const b=g.getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

// ── 2) dados globais ───────────────────────────────────────
const metaRod={}, rcLayers={}, rodoviasLayers={};
const pontosLayer=L.layerGroup([], {pane:"overlayPane"}).addTo(mapa);
let heatLayer=null, lineLayer=null;

// ── 3) Planilhas (CSV) ─────────────────────────────────────
const META_URL ="https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139";
Papa.parse(META_URL,{
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      const kmIni=parseFloat(r.kmIni.replace(",","."));
      const kmFim=parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon]=r.LatLonIni.split(",").map(Number);
      const [fimLat,fimLon]=r.LatLonFim.split(",").map(Number);
      metaRod[r.id]={kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarData();
  }
});

// ── 4) Shapefiles RC  +  KMZ rodovias ──────────────────────
async function carregarData(){

  // 4-A  RC
  for(const p of [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ]){
    try{
      const geoRC = await shp(p);
      const name  = p.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyrRC = L.geoJSON(geoRC,{
        pane:"shapefilePane",
        style:{color:"#000",weight:2.5,fill:false}
      }).addTo(mapa);
      rcLayers[name]=lyrRC;
      addLabel(lyrRC.getBounds().getCenter(), name, "rc-label");  // ← voltou
    }catch(e){ console.error("RC falhou:",p,e); }
  }

  // 4-B  KMZ (apenas linhas)
  if(typeof toGeoJSON==="undefined"){
    alert("Biblioteca toGeoJSON não carregou.");
    return;
  }
  for(const id of Object.keys(metaRod)){
    try{
      const resp=await fetch(`data/${id}.kmz`);
      if(!resp.ok) continue;
      const zip=await JSZip.loadAsync(await resp.arrayBuffer());
      const kml=Object.keys(zip.files).find(f=>f.toLowerCase().endsWith(".kml"));
      const geoKMZ=toGeoJSON.kml(
        new DOMParser().parseFromString(await zip.file(kml).async("string"),"text/xml")
      );
      const lyrRod=L.geoJSON(geoKMZ,{
        pane:"rodoviasPane",
        filter:f=>f.geometry &&
                 (f.geometry.type==="LineString"||f.geometry.type==="MultiLineString"),
        style:{color:"#555",weight:3,opacity:0.9}
      }).addTo(mapa);
      rodoviasLayers[id]=lyrRod;
      addLabel(lyrRod.getBounds().getCenter(), id.split("_")[1], "rod-label"); // ← voltou
    }catch(e){ console.error("KMZ falhou:",id,e); }
  }

  zoomGlobal();   // … (resto do fluxo: pontos, heat, linhas)
}
