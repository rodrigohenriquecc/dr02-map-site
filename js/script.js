/* global L, JSZip, shp, turf, XLSX, Papa, firebase */

// Debug
console.log("script.js carregado");

// 0) Firebase compat
let db = null, col = null, online = false;
try {
  const firebaseConfig = {
    apiKey:            "AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
    authDomain:        "consorciolh-8b5bc.firebaseapp.com",
    projectId:         "consorciolh-8b5bc",
    storageBucket:     "consorciolh-8b5bc.firebasestorage.app",
    messagingSenderId: "128910789036",
    appId:             "1:128910789036:web:d0c0b945f0bcd8ab2b1209"
  };
  firebase.initializeApp(firebaseConfig);
  db  = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch(e) {
  console.warn("Firestore não configurado:", e);
}

// 1) Globais e mapa
const isMobile    = matchMedia("(max-width:600px)").matches;
const mapa        = L.map("map").setView([-23.8, -48.5], 7);
// pane de destaque
mapa.createPane("highlightPane");
mapa.getPane("highlightPane").style.zIndex = 650;

const metaRod     = {};    // id→{kmIni,iniLat,iniLon,kmFim,fimLat,fimLon}
const rcLayers    = {}, rodLayers = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer     = null, lineLayer = null;
const rodLabels   = [];

// base tiles + controle
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom:19, attribution:"© OpenStreetMap" }
).addTo(mapa);
L.control.layers(null, null, { collapsed:isMobile }).addTo(mapa);

// 2) Helpers
function addLabel(latlng,text,cls){
  const m = L.marker(latlng,{
    icon:L.divIcon({className:cls,html:text,iconSize:null}),
    interactive:false
  }).addTo(mapa);
  if(cls==="rod-label") rodLabels.push(m);
}
function zoomGlobal(){
  const all = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ];
  const b = L.featureGroup(all).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}
function updateRodLabels(){
  const used=[];
  rodLabels.forEach(m=>{
    const el=m.getElement(); if(!el) return;
    const p=mapa.latLngToLayerPoint(m.getLatLng());
    let ok=true;
    used.forEach(u=>{
      if(Math.abs(p.x-u.x)<50&&Math.abs(p.y-u.y)<50) ok=false;
    });
    el.style.display = ok?"":"none";
    if(ok) used.push(p);
  });
}

// 3) Carrega metaRod (Google Sheets CSV)
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_URL, {
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    console.log("metaRod linhas:",data.length);
    data.forEach(r=>{
      const kmIni=parseFloat(r.kmIni.replace(",",".")),
            kmFim=parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon]=r.LatLonIni.split(",").map(Number);
      const [fimLat,fimLon]=r.LatLonFim.split(",").map(Number);
      metaRod[r.id]={kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarData();
  },
  error:err=>console.error("Erro metaRod:",err)
});

// 4) Carrega shapefiles e KMZ
async function carregarData(){
  console.log("carregarData()");
  // 4.1) RC shapefiles
  const rcZips=[
    "data/RC_2.1.zip",
    "data/RC_2.2.zip",
    "data/RC_2.4.zip",
    "data/RC_2.5.zip",
    "data/RC_2.6_2.8.zip",
    "data/RC_2.7.zip"
  ];
  for(const p of rcZips){
    try{
      const geo=await shp(p);
      const name=p.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyr=L.geoJSON(geo,{
        style:{color:"#000",weight:2.5,fill:false}
      }).addTo(mapa);
      rcLayers[name]=lyr;
      addLabel(lyr.getBounds().getCenter(),name,"rc-label");
      console.log("RC carregado:",name);
    } catch(e){
      console.error("Erro RC",p,e);
    }
  }

  // 4.2) KMZ rodovias
  for(const id of Object.keys(metaRod)){
    const url=`data/${id}.kmz`;
    console.log("Tentando KMZ:",url);
    try{
      const resp=await fetch(url);
      if(!resp.ok){ console.warn("404 KMZ",url); continue; }
      const buf=await resp.arrayBuffer();
      const zip=await JSZip.loadAsync(buf);
      const kml=Object.keys(zip.files).find(f=>
        f.toLowerCase().endsWith(".kml")
      );
      const txt=await zip.file(kml).async("string");
      const geo=kmlToGeoJSON(txt);
      const lyr=L.geoJSON(geo,{
        pane:"highlightPane",
        style:{color:"#555",weight:3,opacity:0.9},
        filter:f=>f.geometry.type==="LineString"
      }).addTo(mapa);
      rodLayers[id]=lyr;
      const lbl=id.split("_")[1]||id;
      addLabel(lyr.getBounds().getCenter(),lbl,"rod-label");
      console.log("KMZ carregado:",id);
    } catch(e){
      console.error("Erro KMZ",url,e);
    }
  }

  zoomGlobal();
  mapa.on("zoomend",updateRodLabels);
  initUI();
}

// 5) UI e handlers
function initUI(){
  console.log("initUI()");
  document.getElementById("btnToggle").onclick=()=>{
    const c=document.getElementById("kmCard");
    c.style.display=c.style.display==="block"?"none":"block";
  };
  const menu=document.getElementById("uploadMenu");
  document.getElementById("btnCSV").onclick=()=> {
    menu.style.display=menu.style.display==="block"?"none":"block";
  };
  menu.querySelectorAll("button").forEach(btn=>{
    btn.onclick=()=>{
      const m=btn.dataset.mode;
      menu.style.display="none";
      document.getElementById(
        m==="points" ?"csvPointsInput":
        m==="heatmap"?"csvHeatInput":
        m==="line"   ?"csvLineInput":""
      ).click();
    };
  });
  document.getElementById("csvLineInput").onchange = e=>{
    console.log("csvLineInput onchange");
    if(e.target.files[0]) processLineExcel(e.target.files[0]);
  };
}

// 6) Process Excel – Linhas por trecho
function processLineExcel(file){
  console.log("processLineExcel:",file.name);
  const reader=new FileReader();
  reader.onload=e=>{
    const buf=new Uint8Array(e.target.result);
    const wb=XLSX.read(buf,{type:"array"});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
    if(lineLayer){ mapa.removeLayer(lineLayer); lineLayer=null; }
    const grp=L.layerGroup().addTo(mapa);

    rows.forEach(rw=>{
      let key=rw.Rodovia, seg=rodLayers[key];
      if(!seg){
        const mk=Object.keys(rodLayers).find(k=>
          k.endsWith("_"+rw.Rodovia)
        );
        if(mk){ seg=rodLayers[mk]; key=mk; }
      }
      const m   = metaRod[key];
      const km0 = parseFloat(String(rw["Km Inicial"]).replace(",","."));
      const km1 = parseFloat(String(rw["Km Final"]).replace(",","."));
      if(!seg||!m||isNaN(km0)||isNaN(km1)) return;

      // extrai linear ou achata multi
      const gj=seg.toGeoJSON();
      let feat=null;
      gj.features.forEach(f=>{
        if(!feat && f.geometry.type==="LineString") feat=f;
        if(!feat && f.geometry.type==="MultiLineString"){
          feat={type:"Feature",
                geometry:{
                  type:"LineString",
                  coordinates:f.geometry.coordinates.flat()
                }};
        }
      });
      if(!feat||!feat.geometry||feat.geometry.coordinates.length<2){
        console.warn("Sem geomet ria válida:",key);
        return;
      }

      const rel0=km0-m.kmIni, rel1=km1-m.kmIni;
      const p0  = turf.along(feat, rel0, {units:"kilometers"});
      const p1  = turf.along(feat, rel1, {units:"kilometers"});
      const slice = turf.lineSlice(p0,p1,feat);

      L.geoJSON(slice,{
        pane:"highlightPane",
        style:{
          color: rw.Cor||"#f00",
          weight: parseFloat(rw.Espessura)||4
        }
      })
      .bindPopup(
        `<b>${key}</b><br>Km ${km0.toFixed(3)}–${km1.toFixed(3)}<br>${rw.Obs||""}`
      )
      .addTo(grp);
    });

    lineLayer=grp;
    zoomGlobal();
  };
  reader.readAsArrayBuffer(file);
}

// 7) KML → GeoJSON helper
function kmlToGeoJSON(xmlStr){
  const dom=new DOMParser().parseFromString(xmlStr,"text/xml");
  const feats=[];
  Array.from(dom.getElementsByTagName("Placemark")).forEach(pm=>{
    const ls=pm.getElementsByTagName("LineString")[0];
    if(!ls) return;
    const coords=ls.getElementsByTagName("coordinates")[0].textContent
      .trim().split(/\s+/)
      .map(s=>s.split(",").map(Number).slice(0,2));
    if(coords.length>1) feats.push({
      type:"Feature",
      geometry:{type:"LineString",coordinates}
    });
  });
  return {type:"FeatureCollection",features:feats};
}
