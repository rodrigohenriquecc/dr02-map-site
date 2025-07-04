/* global L, JSZip, shp, turf, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// ──────────────────── 0) Firebase (compat)
let db=null, col=null, online=false;
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

// ──────────────────── 1) Mapa + panes
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
const zoomGlobal=()=>{
  const g=L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...pontosLayer.getLayers()
  ]);
  const b=g.getBounds(); if(b.isValid()) mapa.fitBounds(b);
};

// ──────────────────── 2) Globals
const metaRod={}, rcLayers={}, rodLayers={};
const pontosLayer=L.layerGroup([], {pane:"overlayPane"}).addTo(mapa);
let heatLayer=null, lineLayer=null;

// visibilidade
let pointsVisible=true, heatVisible=true, linesVisible=true;
const refreshLayerVisibility=()=>{
  (pointsVisible)?mapa.addLayer(pontosLayer):mapa.removeLayer(pontosLayer);
  if(heatLayer)  (heatVisible)?mapa.addLayer(heatLayer):mapa.removeLayer(heatLayer);
  if(lineLayer)  (linesVisible)?mapa.addLayer(lineLayer):mapa.removeLayer(lineLayer);
};

// ──────────────────── 3) URLs CSV
const SHEETS={
  meta  :"https://docs.google.com/spreadsheets/d/1-vQJbINXlmAzhf-XItfu0pOp31WtaG9Md0MLVAJ2uAs/export?format=csv&gid=411284139",
  points:"https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat  :"https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
  lines :"https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/export?format=csv"
};

// ──────────────────── 4) metaRod → base
Papa.parse(SHEETS.meta,{
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      const kmIni=parseFloat(r.kmIni.replace(",","."));
      const kmFim=parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon]=r.LatLonIni.split(",").map(Number);
      const [fimLat,fimLon]=r.LatLonFim.split(",").map(Number);
      metaRod[r.id]={kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarBase();
  }
});

// ──────────────────── 5) Shapefiles RC & KMZ rodovias
async function carregarBase(){

  // RC
  for(const p of [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ]){
    try{
      const geo=await shp(p);
      const name=p.match(/RC_[\d._]+/)[0].replace("_"," ");
      rcLayers[name]=L.geoJSON(geo,{
        pane:"shapefilePane",
        style:{color:"#000",weight:2.5,fill:false}
      }).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(),name,"rc-label");
    }catch(e){console.error("RC falhou",p,e);}
  }

  // KMZ
  if(typeof toGeoJSON==="undefined"){alert("toGeoJSON não carregou");return;}
  for(const id of Object.keys(metaRod)){
    try{
      const r=await fetch(`data/${id}.kmz`);
      if(!r.ok) continue;
      const zip = await JSZip.loadAsync(await r.arrayBuffer());
      const kml = Object.keys(zip.files).find(f=>f.toLowerCase().endsWith(".kml"));
      const geo = toGeoJSON.kml(
        new DOMParser().parseFromString(await zip.file(kml).async("string"),"text/xml")
      );
      rodLayers[id]=L.geoJSON(geo,{
        pane:"rodoviasPane",
        filter:f=>f.geometry &&
          (f.geometry.type==="LineString"||f.geometry.type==="MultiLineString"),
        style:{color:"#555",weight:3,opacity:0.9}
      }).addTo(mapa);
      addLabel(rodLayers[id].getBounds().getCenter(),id.split("_")[1],"rod-label");
    }catch(e){console.error("KMZ falhou",id,e);}
  }

  // filtro rodovias
  const sel=document.getElementById("selRod");
  sel.innerHTML='<option value="">(todas)</option>'+
    Object.keys(rodLayers).sort()
      .map(id=>`<option value="${id}">${id.split("_")[1]}</option>`).join("");
  sel.onchange=()=>{
    const v=sel.value;
    Object.entries(rodLayers)
      .forEach(([id,lyr])=> (v===""||id===v)?mapa.addLayer(lyr):mapa.removeLayer(lyr));
  };

  reloadSheets();
  refreshLayerVisibility();
  zoomGlobal();
}

// ──────────────────── 6) Recarrega as 3 planilhas
function reloadSheets(){
  pontosLayer.clearLayers();
  if(heatLayer) mapa.removeLayer(heatLayer), heatLayer=null;
  if(lineLayer) mapa.removeLayer(lineLayer), lineLayer=null;
  loadPoints(); loadHeat(); loadLines();
}

// botão ⟳ e controles
document.addEventListener("DOMContentLoaded",()=>{
  btnCSV.onclick=reloadSheets;

  chkPoints.onchange=e=>{pointsVisible=e.target.checked; refreshLayerVisibility();};
  chkHeat  .onchange=e=>{heatVisible  =e.target.checked; refreshLayerVisibility();};
  chkLines .onchange=e=>{linesVisible =e.target.checked; refreshLayerVisibility();};

  btnClrPoints.onclick=()=>{pontosLayer.clearLayers();};
  btnClrHeat  .onclick=()=>{if(heatLayer) mapa.removeLayer(heatLayer), heatLayer=null;};
  btnClrLines .onclick=()=>{if(lineLayer) mapa.removeLayer(lineLayer), lineLayer=null;};
});

// ──────────────────── 7) Pontos
function loadPoints(){
  Papa.parse(SHEETS.points,{
    download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      data.forEach(d=>{
        let key=d.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers).find(k=>k.endsWith("_"+d.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key], km=parseFloat(d.KM.replace(",","."));
        if(!seg||!m||isNaN(km)||km<m.kmIni||km>m.kmFim) return;
        const rel=km-m.kmIni,
          line=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString"),
          pt=turf.along(line,rel,{units:"kilometers"});
        L.circleMarker([pt.geometry.coordinates[1],pt.geometry.coordinates[0]],{
          pane:"overlayPane",
          radius:parseFloat(d.Raio)||6,
          color:d.Cor||"#1976d2", weight:2,
          fillColor:d.Cor||"#1976d2", fillOpacity:1
        }).bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs||""}`)
          .addTo(pontosLayer);
      });
      if(!pointsVisible) mapa.removeLayer(pontosLayer);
    }
  });
}

// ──────────────────── 8) Heatmap
function loadHeat(){
  Papa.parse(SHEETS.heat,{
    download:true, header:true, skipEmptyLines:true,
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
        if(!seg||!m||isNaN(km0)||isNaN(km1)) return;
        const rel0=km0-m.kmIni, rel1=km1-m.kmIni,
          line=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString"),
          p0=turf.along(line,rel0,{units:"kilometers"}),
          p1=turf.along(line,rel1,{units:"kilometers"}),
          slice=turf.lineSlice(p0,p1,line),
          len=turf.length(slice,{units:"kilometers"}),
          n  =Math.ceil(len*5)+1;
        for(let i=0;i<=n;i++){
          const p=turf.along(slice,(len*i)/n,{units:"kilometers"});
          pts.push([p.geometry.coordinates[1],p.geometry.coordinates[0],1]);
        }
      });
      heatLayer=L.heatLayer(pts,{radius:25,blur:15}).addTo(mapa);
      if(!heatVisible) mapa.removeLayer(heatLayer);
    }
  });
}

// ──────────────────── 9) Linhas
function loadLines(){
  Papa.parse(SHEETS.lines,{
    download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      const grp=L.layerGroup([], {pane:"rodoviasPane"}).addTo(mapa);
      data.forEach(rw=>{
        let key=rw.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers).find(k=>k.endsWith("_"+rw.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key],
          km0=parseFloat(rw["Km Inicial"].replace(",","."));
        const km1=parseFloat(rw["Km Final" ].replace(",","."));
        if(!seg||!m||isNaN(km0)||isNaN(km1)) return;
        const feat=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
        if(!feat) return;
        const p0=turf.along(feat, km0-m.kmIni,{units:"kilometers"}),
              p1=turf.along(feat, km1-m.kmIni,{units:"kilometers"}),
              slice=turf.lineSlice(p0,p1,feat);
        L.geoJSON(slice,{
          pane:"rodoviasPane",
          style:{
            color:rw.Cor||"#f00",
            weight:parseFloat(rw.Espessura)||4
          }
        }).bindPopup(
          `<b>${key}</b><br>Km ${km0.toFixed(3)}–${km1.toFixed(3)}<br>${rw.Obs||""}`
        ).addTo(grp);
      });
      lineLayer=grp;
      if(!linesVisible) mapa.removeLayer(lineLayer);
    }
  });
}
