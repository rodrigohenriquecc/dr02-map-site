/* global L, JSZip, shp, turf, Papa, firebase */

// 0) Firebase compat
let db=null, col=null, online=false;
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
} catch(e){
  console.warn("Firestore off-line ou não configurado.", e);
}

// 1) Globais e mapa
const isMobile    = matchMedia("(max-width:600px)").matches;
const mapa        = L.map("map").setView([-23.8,-48.5],7);
const metaRod     = {};  // id→{kmIni,iniLat,iniLon,kmFim,fimLat,fimLon}
const rcLayers    = {}, rodLayers = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer, lineLayer;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19, attribution:"&copy; OpenStreetMap"
}).addTo(mapa);
L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

// helpers
const addLabel=(p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),interactive:false})
   .addTo(mapa);
function zoomGlobal(){
  const grp=[...Object.values(rcLayers),...Object.values(rodLayers),...Object.values(pontosLayer._layers)];
  const b=L.featureGroup(grp).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

// 2) Carrega metaRod via Google Sheets CSV
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_CSV_URL,{
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      const kmIni = parseFloat(r.kmIni.replace(",","."));
      const kmFim = parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon] = r.LatLonIni.split(",").map(Number);
      const [fimLat,fimLon] = r.LatLonFim.split(",").map(Number);
      metaRod[r.id] = {kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarData();
  },
  error:err=>alert("Erro ao carregar planilha:\n"+err.message)
});

// 3) Carrega RC e KMZ
async function carregarData(){
  const RC_ZIPS=["data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip","data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"];
  for(const zipPath of RC_ZIPS){
    try{
      const geo=await shp(zipPath);
      const rc=zipPath.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyr=L.geoJSON(geo,{style:{color:"#000",weight:2.5,fill:false}}).addTo(mapa);
      rcLayers[rc]=lyr;
      addLabel(lyr.getBounds().getCenter(),rc,"rc-label");
    }catch(e){console.error("RC",zipPath,e);}
  }
  for(const id of Object.keys(metaRod)){
    const path=`data/${id}.kmz`;
    try{
      const resp=await fetch(path);
      if(!resp.ok){console.warn("KMZ não encontrado:",path);continue;}
      const buf=await resp.arrayBuffer();
      const zip=await JSZip.loadAsync(buf);
      const kml=Object.keys(zip.files).find(f=>f.toLowerCase().endsWith(".kml"));
      if(!kml){console.warn("KMZ sem KML:",path);continue;}
      const txt=await zip.file(kml).async("string");
      const geo=kmlToGeoJSON(txt);
      const lyr=L.geoJSON(geo,{
        style:{color:"#555",weight:3,opacity:0.9},
        filter:f=>f.geometry.type==="LineString"
      }).addTo(mapa);
      rodLayers[id]=lyr;
      const label=id.includes("_")?id.split("_")[1]:id;
      addLabel(lyr.getBounds().getCenter(),label,"rod-label");
    }catch(e){console.error("KMZ",path,e);}
  }
  zoomGlobal();
  initUI();
  if(online) carregarFirestore();
}

// 4) UI e handlers
function initUI(){
  document.getElementById("btnToggle").onclick=()=>{
    const kmCard=document.getElementById("kmCard");
    kmCard.style.display=kmCard.style.display==="block"?"none":"block";
  };
  const menu=document.getElementById("uploadMenu");
  document.getElementById("btnCSV").onclick=()=>{
    menu.style.display=menu.style.display==="block"?"none":"block";
  };
  menu.querySelectorAll("button").forEach(btn=>{
    btn.onclick=()=>{
      const mode=btn.dataset.mode;
      menu.style.display="none";
      document.getElementById(
        mode==="points"?"csvPointsInput":
        mode==="heatmap"?"csvHeatInput":"csvLineInput"
      ).click();
    };
  });
  // clear buttons
  document.getElementById("btnClearPoints").onclick=()=>pontosLayer.clearLayers();
  document.getElementById("btnClearHeatmap").onclick=()=>{
    if(heatLayer) mapa.removeLayer(heatLayer),heatLayer=null;
  };
  document.getElementById("btnClearLines").onclick=()=>{
    if(lineLayer) mapa.removeLayer(lineLayer),lineLayer=null;
  };

  // file inputs
  document.getElementById("csvPointsInput").onchange=e=>e.target.files[0]&&processPointsCSV(e.target.files[0]);
  document.getElementById("csvHeatInput").onchange  =e=>e.target.files[0]&&processHeatCSV(e.target.files[0]);
  document.getElementById("csvLineInput").onchange  =e=>e.target.files[0]&&processLineCSV(e.target.files[0]);

  // select rodovia
  const sel=document.getElementById("selRod");
  sel.innerHTML='<option value="">(selecione)</option>'+Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join("");
  document.getElementById("btnKm").onclick=localizarKm;

  // save
  document.getElementById("btnSave").onclick=salvarFirestore;
}

// 5) Pontos
function processPointsCSV(file){
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:res=>{
    pontosLayer.clearLayers();
    res.data.forEach(addPonto);
    if(Object.keys(pontosLayer._layers).length) mapa.fitBounds(pontosLayer.getBounds());
  }});
}
function addPonto(d){
  const km=parseFloat(d.KM.replace(",",".")), seg=rodLayers[d.Rodovia],m=metaRod[d.Rodovia];
  if(!seg||!m||isNaN(km)||km<m.kmIni||km>m.kmFim) return;
  const rel=km-m.kmIni, line=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
  const pt=turf.along(line,rel,{units:"kilometers"}),[lon,lat]=pt.geometry.coordinates;
  L.circleMarker([lat,lon],{radius:parseFloat(d.Raio)||6,color:d.Cor||"#1976d2",weight:2,fillColor:d.Cor||"#1976d2",fillOpacity:1})
    .bindPopup(`<b>${d.Rodovia}</b><br>Km ${d.KM}<br>${d.Obs||""}`)
    .addTo(pontosLayer);
}

// ... heatmap, lines, locateKm, firestore, kmlToGeoJSON (sem alterações) ...
