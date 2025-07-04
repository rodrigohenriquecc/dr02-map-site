/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// ═══════════════════════ 0) Firebase (compat)
let db=null,col=null,online=false;
try{
  firebase.initializeApp({apiKey:"AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:"consorciolh-8b5bc.firebaseapp.com",
    projectId:"consorciolh-8b5bc",storageBucket:"consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId:"128910789036",
    appId:"1:128910789036:web:d0c0b945f0bcd8ab2b1209"});
  db=firebase.firestore(); col=db.collection("pontos"); online=true;
}catch(e){console.warn("Firestore off:",e);}

// ═══════════════════════ 1) Mapa
const mapa=L.map("map").setView([-23.8,-48.5],7);
["shapefilePane","rodoviasPane","overlayPane"].forEach((p,i)=>{
  mapa.createPane(p).style.zIndex=400+i*50;
  if(i<2) mapa.getPane(p).style.pointerEvents="none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {maxZoom:19,attribution:"© OpenStreetMap"}).addTo(mapa);

// helpers
const addLabel=(latlng,txt,cls)=>
  L.marker(latlng,{pane:"overlayPane",
    icon:L.divIcon({className:cls,html:txt,iconSize:null}),
    interactive:false}).addTo(mapa);

// ═══════════════════════ 2) Dados globais
const metaRod={}, rcLayers={}, rodLayers={};
const pontosLayer=L.layerGroup([], {pane:"overlayPane"}).addTo(mapa);
let heatLayer=null, lineLayer=null, kmzQueue=new Set();

// visibilidade
let pointsVisible=true, heatVisible=true, linesVisible=true;
const refreshVis=()=>{
  (pointsVisible)?mapa.addLayer(pontosLayer):mapa.removeLayer(pontosLayer);
  if(heatLayer)  (heatVisible)?mapa.addLayer(heatLayer):mapa.removeLayer(heatLayer);
  if(lineLayer)  (linesVisible)?mapa.addLayer(lineLayer):mapa.removeLayer(lineLayer);
};

// ═══════════════════════ 3) CSV URLs
const SHEETS={
  meta  :"https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139",
  points:"https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat  :"https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
  lines :"https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/export?format=csv"
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

// ═══════════════════════ 5) RC shapefiles (só uma vez)
async function carregarRC(){
  for(const p of [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ]){
    try{
      const geo=await shp(p);
      const name=p.match(/RC_[\d._]+/)[0].replace("_"," ");
      rcLayers[name]=L.geoJSON(geo,{pane:"shapefilePane",
        style:{color:"#000",weight:2.5,fill:false}}).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(),name,"rc-label");
    }catch(e){console.error("RC falhou",p,e);}
  }
  lazyLoadKMZ();          // primeiro lote
  mapa.on("moveend",lazyLoadKMZ); // load conforme navegação

  reloadSheets(); refreshVis();
}

// ═══════════════════════ 6) Lazy-load KMZ
async function lazyLoadKMZ(){
  const pad=1.5;                                 // “folga” em graus
  const b=mapa.getBounds();
  const latMin=b.getSouth()-pad, latMax=b.getNorth()+pad;
  const lonMin=b.getWest()-pad , lonMax=b.getEast()+pad;

  for(const id of Object.keys(metaRod)){
    if(rodLayers[id]||kmzQueue.has(id)) continue;       // já feito / em fila
    const m=metaRod[id];
    // simples teste bounding-box
    const inView = (
      (m.iniLat>latMin && m.iniLat<latMax && m.iniLon>lonMin && m.iniLon<lonMax) ||
      (m.fimLat>latMin && m.fimLat<latMax && m.fimLon>lonMin && m.fimLon<lonMax)
    );
    if(!inView) continue;

    kmzQueue.add(id);
    try{
      const resp=await fetch(`data/${id}.kmz`);
      if(!resp.ok){kmzQueue.delete(id);continue;}
      const zip=await JSZip.loadAsync(await resp.arrayBuffer());
      const kmlName=Object.keys(zip.files).find(f=>f.toLowerCase().endsWith(".kml"));
      const xml=await zip.file(kmlName).async("string");
      const geoRaw=toGeoJSON.kml(new DOMParser().parseFromString(xml,"text/xml"));

      // simplifica cada feature
      geoRaw.features=geoRaw.features.map(f=>{
        if(f.geometry.type==="LineString"||f.geometry.type==="MultiLineString"){
          return turf.simplify(f,{tolerance:0.00005,highQuality:false});
        }
        return f; });
      // mantém só linhas
      const geo={type:"FeatureCollection",
        features:geoRaw.features.filter(f=>
          f.geometry&&(f.geometry.type==="LineString"||f.geometry.type==="MultiLineString"))};

      rodLayers[id]=L.geoJSON(geo,{
        pane:"rodoviasPane",
        style:{color:"#555",weight:3,opacity:0.9}
      }).addTo(mapa);
      addLabel(rodLayers[id].getBounds().getCenter(),id.split("_")[1],"rod-label");
      refreshVis();
    }catch(e){console.error("KMZ falhou",id,e);}
    finally{kmzQueue.delete(id);}
  }
}

// ═══════════════════════ 7) CSV dinâmicos
function reloadSheets(){
  pontosLayer.clearLayers();
  if(heatLayer) mapa.removeLayer(heatLayer), heatLayer=null;
  if(lineLayer) mapa.removeLayer(lineLayer), lineLayer=null;
  loadPoints(); loadHeat(); loadLines();
}

// pontos
function loadPoints(){
  Papa.parse(SHEETS.points,{download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      data.forEach(d=>{
        let key=d.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers).find(k=>k.endsWith("_"+d.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key], km=parseFloat(d.KM.replace(",","."));
        if(!seg||!m||!km||km<m.kmIni||km>m.kmFim) return;
        const rel=km-m.kmIni,
          line=seg.toGeoJSON().features[0],
          pt=turf.along(line,rel,{units:"kilometers"});
        L.circleMarker([pt.geometry.coordinates[1],pt.geometry.coordinates[0]],{
          pane:"overlayPane",
          radius:+d.Raio||6, color:d.Cor||"#1976d2",
          weight:2, fillColor:d.Cor||"#1976d2", fillOpacity:1
        }).bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs||""}`)
          .addTo(pontosLayer);
      });
      if(!pointsVisible) mapa.removeLayer(pontosLayer);
    }});
}

// heatmap (menos pontos → 20 % mais leve)
function loadHeat(){
  Papa.parse(SHEETS.heat,{download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      const pts=[];
      data.forEach(r=>{
        let key=r.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers).find(k=>k.endsWith("_"+r.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key],
          km0=parseFloat(r["Km Inicial"].replace(",","."));
        const km1=parseFloat(r["Km Final" ].replace(",","."));
        if(!seg||!m||!km0||!km1) return;
        const rel0=km0-m.kmIni, rel1=km1-m.kmIni,
          line=seg.toGeoJSON().features[0],
          p0=turf.along(line,rel0,{units:"kilometers"}),
          p1=turf.along(line,rel1,{units:"kilometers"}),
          slice=turf.lineSlice(p0,p1,line),
          len=turf.length(slice,{units:"kilometers"}),
          n=Math.ceil(len*4)+1;           // ← 20 % menos pontos

        for(let i=0;i<=n;i++){
          const p=turf.along(slice,(len*i)/n,{units:"kilometers"});
          pts.push([p.geometry.coordinates[1],p.geometry.coordinates[0],1]);
        }
      });
      heatLayer=L.heatLayer(pts,{radius:25,blur:15}).addTo(mapa);
      if(!heatVisible) mapa.removeLayer(heatLayer);
    }});
}

// linhas
function loadLines(){
  Papa.parse(SHEETS.lines,{download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      const grp=L.layerGroup([], {pane:"rodoviasPane"}).addTo(mapa);
      data.forEach(r=>{
        let key=r.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers).find(k=>k.endsWith("_"+r.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key],
          km0=parseFloat(r["Km Inicial"].replace(",","."));
        const km1=parseFloat(r["Km Final" ].replace(",","."));
        if(!seg||!m||!km0||!km1) return;
        const feat=seg.toGeoJSON().features[0];
        const p0=turf.along(feat, km0-m.kmIni,{units:"kilometers"}),
          p1=turf.along(feat, km1-m.kmIni,{units:"kilometers"}),
          slice=turf.lineSlice(p0,p1,feat);
        L.geoJSON(slice,{
          pane:"rodoviasPane",
          style:{color:r.Cor||"#f00",weight:+r.Espessura||4}
        }).bindPopup(
          `<b>${key}</b><br>Km ${km0.toFixed(3)}–${km1.toFixed(3)}<br>${r.Obs||""}`
        ).addTo(grp);
      });
      lineLayer=grp;
      if(!linesVisible) mapa.removeLayer(lineLayer);
    }});
}

// ═══════════════════════ 8) Controles UI
document.addEventListener("DOMContentLoaded",()=>{
  btnCSV.onclick=reloadSheets;

  chkPoints.onchange=e=>{pointsVisible=e.target.checked; refreshVis();};
  chkHeat  .onchange=e=>{heatVisible  =e.target.checked; refreshVis();};
  chkLines .onchange=e=>{linesVisible =e.target.checked; refreshVis();};

  btnClrPoints.onclick=()=>{pontosLayer.clearLayers();};
  btnClrHeat  .onclick=()=>{if(heatLayer) mapa.removeLayer(heatLayer), heatLayer=null;};
  btnClrLines .onclick=()=>{if(lineLayer) mapa.removeLayer(lineLayer), lineLayer=null;};
});
