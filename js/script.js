/* global L, JSZip, shp, turf, XLSX, Papa, firebase */

console.log("script.js carregado");

// 0) Firebase compat
let db=null, col=null, online=false;
try {
  const cfg = {
    apiKey:"AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:"consorciolh-8b5bc.firebaseapp.com",
    projectId:"consorciolh-8b5bc",
    storageBucket:"consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId:"128910789036",
    appId:"1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  };
  firebase.initializeApp(cfg);
  db = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch(e){
  console.warn("Firestore não configurado:",e);
}

// 1) Mapa + Panes
const isMobile = matchMedia("(max-width:600px)").matches;
const mapa = L.map("map").setView([-23.8,-48.5],7);

mapa.createPane("shapefilePane");
mapa.getPane("shapefilePane").style.zIndex = 400;
mapa.getPane("shapefilePane").style.pointerEvents = "none";

mapa.createPane("rodoviasPane");
mapa.getPane("rodoviasPane").style.zIndex = 450;
mapa.getPane("rodoviasPane").style.pointerEvents = "none";

mapa.createPane("overlayPane");
mapa.getPane("overlayPane").style.zIndex = 500;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19, attribution:"© OpenStreetMap"
}).addTo(mapa);

L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

// 2) Globals & Helpers
const metaRod = {};       // id→{kmIni,iniLat,iniLon,kmFim,fimLat,fimLon}
const rcLayers={}, rodLayers={};
const pontosLayer = L.layerGroup([], { pane:"overlayPane" }).addTo(mapa);
let heatLayer=null, lineLayer=null;

function addLabel(latlng,txt,cls){
  try {
    L.marker(latlng,{
      pane:"overlayPane",
      icon:L.divIcon({className:cls,html:txt,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  } catch(e){
    console.warn("Não pôde adicionar label",txt,e);
  }
}
function zoomGlobal(){
  const all = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...pontosLayer.getLayers()
  ];
  const b = L.featureGroup(all).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

// 3) carrega meta via CSV (Google Sheets)
const SHEET_URL = 
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_URL,{
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      const kmIni = parseFloat(r.kmIni.replace(",",".")),
            kmFim = parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon]=r.LatLonIni.split(",").map(Number),
            [fimLat,fimLon]=r.LatLonFim.split(",").map(Number);
      metaRod[r.id]={kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarData();
  },
  error:err=>console.error("Erro metaRod:",err)
});

// 4) Carrega shapefiles e KMZ
async function carregarData(){
  // RC shapefiles
  const rcZips = [
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ];
  for(const p of rcZips){
    try {
      const geo = await shp(p);
      const name = p.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyr = L.geoJSON(geo,{
        pane:"shapefilePane",
        style:{color:"#000",weight:2.5,fill:false}
      }).addTo(mapa);
      rcLayers[name]=lyr;
      try {
        addLabel(lyr.getBounds().getCenter(), name, "rc-label");
      } catch(_){}
    } catch(e){
      console.error("Erro RC",p,e);
    }
  }
  // KMZ rodovias
  for(const id of Object.keys(metaRod)){
    const url = `data/${id}.kmz`;
    try {
      const resp = await fetch(url);
      if(!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const kml = Object.keys(zip.files)
        .find(f=>f.toLowerCase().endsWith(".kml"));
      const txt = await zip.file(kml).async("string");
      const geo = kmlToGeoJSON(txt);
      const lyr = L.geoJSON(geo,{
        pane:"rodoviasPane",
        style:{color:"#555",weight:3,opacity:0.9}
      }).addTo(mapa);
      rodLayers[id]=lyr;
      try {
        addLabel(lyr.getBounds().getCenter(), id.split("_")[1], "rod-label");
      } catch(_){}
    } catch(e){
      console.error("Erro KMZ",url,e);
    }
  }

  zoomGlobal();
  initUI();
}

// 5) UI init
function initUI(){
  // popula filtro
  const sel = document.getElementById("selRod");
  sel.innerHTML = '<option value="">(todas)</option>' +
    Object.keys(rodLayers).sort()
      .map(id=>`<option value="${id}">${id.split("_")[1]}</option>`)
      .join("");
  sel.onchange = ()=>{
    const v=sel.value;
    Object.entries(rodLayers).forEach(([id,lyr])=>{
      v===""?mapa.addLayer(lyr)
             : id===v?mapa.addLayer(lyr)
                     : mapa.removeLayer(lyr);
    });
  };

  // botão +
  document.getElementById("btnCSV").onclick = ()=>{
    const m=document.getElementById("uploadMenu");
    m.style.display = m.style.display==="block"?"none":"block";
  };

  // menu import
  document.querySelectorAll("#uploadMenu button").forEach(btn=>{
    btn.onclick = ()=>{
      const mode=btn.dataset.mode;
      document.getElementById({
        "points":"csvPointsInput",
        "heatmap":"csvHeatInput",
        "line":"csvLineInput"
      }[mode]).click();
      document.getElementById("uploadMenu").style.display="none";
    };
  });

  // change handlers
  document.getElementById("csvLineInput").onchange = e=>{
    if(e.target.files[0]) processLineExcel(e.target.files[0]);
  };
}

// 6) Linhas por trecho
function processLineExcel(file){
  const r=new FileReader();
  r.onload=e=>{
    const buf=new Uint8Array(e.target.result),
          wb=XLSX.read(buf,{type:"array"}),
          ws=wb.Sheets[wb.SheetNames[0]],
          rows=XLSX.utils.sheet_to_json(ws,{defval:""});
    if(lineLayer) mapa.removeLayer(lineLayer);
    const grp=L.layerGroup([], { pane:"rodoviasPane" }).addTo(mapa);
    rows.forEach(rw=>{
      let key=rw.Rodovia, seg=rodLayers[key];
      if(!seg){
        const mk=Object.keys(rodLayers)
          .find(k=>k.endsWith("_"+rw.Rodovia));
        if(mk) seg=rodLayers[mk], key=mk;
      }
      const m=metaRod[key],
            km0=parseFloat(String(rw["Km Inicial"]).replace(",",".")),
            km1=parseFloat(String(rw["Km Final"]).replace(",","."));
      if(!seg||!m||isNaN(km0)||isNaN(km1)) return;
      // extrai linha
      const gj=seg.toGeoJSON(),
            feat= gj.features.find(f=>f.geometry.type==="LineString")
                 || (()=>{
                     const ml=gj.features.find(f=>f.geometry.type==="MultiLineString");
                     return ml?{
                       type:"Feature",
                       geometry:{
                         type:"LineString",
                         coordinates:ml.geometry.coordinates.flat()
                       }
                     }:null;
                   })();
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
    zoomGlobal();
  };
  r.readAsArrayBuffer(file);
}

// 7) KML→GeoJSON
function kmlToGeoJSON(xml){
  const dom=new DOMParser().parseFromString(xml,"text/xml"),
        feats=[];
  Array.from(dom.getElementsByTagName("Placemark"))
    .forEach(pm=>{
      const ls=pm.getElementsByTagName("LineString")[0];
      if(!ls) return;
      const coords=ls.getElementsByTagName("coordinates")[0].textContent
        .trim().split(/\s+/)
        .map(s=>s.split(",").map(Number).slice(0,2));
      if(coords.length>1) feats.push({
        type:"Feature",
        geometry:{type:"LineString",coordinates:coords}
      });
    });
  return {type:"FeatureCollection",features:feats};
}
