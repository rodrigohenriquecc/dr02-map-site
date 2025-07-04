/* global L, JSZip, shp, turf, XLSX, Papa, toGeoJSON, firebase */

console.log("script.js carregado");

// 0) Firebase compat
let db=null, col=null, online=false;
try {
  const cfg={ apiKey:"AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
              authDomain:"consorciolh-8b5bc.firebaseapp.com",
              projectId:"consorciolh-8b5bc",
              storageBucket:"consorciolh-8b5bc.firebasestorage.app",
              messagingSenderId:"128910789036",
              appId:"1:128910789036:web:d0c0b945f0bcd8ab2b1209" };
  firebase.initializeApp(cfg);
  db  = firebase.firestore();
  col = db.collection("pontos");
  online = true;
} catch(e) {
  console.warn("Firestore não configurado:", e);
}

// 1) Mapa + Panes
const isMobile=matchMedia("(max-width:600px)").matches;
const mapa=L.map("map").setView([-23.8,-48.5],7);
mapa.createPane("shapefilePane").style.zIndex=400;
mapa.getPane("shapefilePane").style.pointerEvents="none";
mapa.createPane("rodoviasPane").style.zIndex=450;
mapa.getPane("rodoviasPane").style.pointerEvents="none";
mapa.createPane("overlayPane").style.zIndex=500;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom:19, attribution:"© OpenStreetMap"
}).addTo(mapa);

L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

// 2) Globals & Helpers
const metaRod={}, rcLayers={}, rodLayers={};
const pontosLayer=L.layerGroup([], {pane:"overlayPane"}).addTo(mapa);
let heatLayer=null, lineLayer=null;

function addLabel(latlng,txt,cls){
  try {
    L.marker(latlng, {
      pane:"overlayPane",
      icon:L.divIcon({className:cls,html:txt,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  } catch(e){
    console.warn("label falhou:",txt,e);
  }
}

function zoomGlobal(){
  const all=[
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...pontosLayer.getLayers()
  ];
  const b=L.featureGroup(all).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

// 3) URLs CSV online
const POINTS_URL="https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv";
const HEAT_URL  ="https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv";
const LINE_URL  ="https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/export?format=csv";

// 4) Carrega metaRod
const META_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(META_URL, {
  download:true, header:true, skipEmptyLines:true,
  complete:({data})=>{
    data.forEach(r=>{
      const kmIni=parseFloat(r.kmIni.replace(",",".")),
            kmFim=parseFloat(r.kmFim.replace(",","."));
      const [iniLat,iniLon]=r.LatLonIni.split(",").map(Number),
            [fimLat,fimLon]=r.LatLonFim.split(",").map(Number);
      metaRod[r.id]={kmIni,iniLat,iniLon,kmFim,fimLat,fimLon};
    });
    carregarData();
  },
  error:err=>console.error("metaRod falhou:",err)
});

// 5) Carrega dados
async function carregarData(){
  // 5.1) RC shapefiles
  const rcZips=[
    "data/RC_2.1.zip","data/RC_2.2.zip","data/RC_2.4.zip",
    "data/RC_2.5.zip","data/RC_2.6_2.8.zip","data/RC_2.7.zip"
  ];
  for(const p of rcZips){
    try {
      const geo=await shp(p),
            name=p.match(/RC_[\d._]+/)[0].replace("_"," ");
      const lyr=L.geoJSON(geo, {
        pane:"shapefilePane",
        style:{color:"#000",weight:2.5,fill:false}
      }).addTo(mapa);
      rcLayers[name]=lyr;
      try { addLabel(lyr.getBounds().getCenter(),name,"rc-label"); } catch(_) {}
    } catch(e){
      console.error("RC falhou",p,e);
    }
  }

  // 5.2) KMZ rodovias
  for(const id of Object.keys(metaRod)){
    try {
      const resp=await fetch(`data/${id}.kmz`);
      if(!resp.ok) continue;
      const buf=await resp.arrayBuffer();
      const zip=await JSZip.loadAsync(buf);
      const kmlName=Object.keys(zip.files)
        .find(f=>f.toLowerCase().endsWith(".kml"));
      const kmlText=await zip.file(kmlName).async("string");
      const dom=new DOMParser().parseFromString(kmlText,"text/xml");
      const geo=toGeoJSON.kml(dom);
      const lyr=L.geoJSON(geo, {
        pane:"rodoviasPane",
        style:{color:"#555",weight:3,opacity:0.9}
      }).addTo(mapa);
      rodLayers[id]=lyr;
      try{ addLabel(lyr.getBounds().getCenter(),id.split("_")[1],"rod-label"); }catch(_) {}
    } catch(e){
      console.error("KMZ falhou",id,e);
    }
  }

  // 5.3) Filtro rodovias
  const sel=document.getElementById("selRod");
  sel.innerHTML='<option value="">(todas)</option>'
    +Object.keys(rodLayers).sort()
      .map(id=>`<option value="${id}">${id.split("_")[1]}</option>`)
      .join("");
  sel.onchange=()=>{
    const v=sel.value;
    Object.entries(rodLayers).forEach(([id,lyr])=>{
      if(!v||id===v) mapa.addLayer(lyr);
      else mapa.removeLayer(lyr);
    });
  };

  // 5.4) Carrega online
  loadPoints(); loadHeat(); loadLines();

  // recarregar
  document.getElementById("btnCSV").onclick=()=>{
    pontosLayer.clearLayers();
    if(heatLayer) mapa.removeLayer(heatLayer);
    if(lineLayer) mapa.removeLayer(lineLayer);
    carregarData();
  };

  zoomGlobal();
}

// 6) Pontos
function loadPoints(){
  Papa.parse(POINTS_URL, {
    download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      data.forEach(d=>{
        let key=d.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers)
            .find(k=>k.endsWith("_"+d.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key], km=parseFloat(d.KM.replace(",","."));
        if(!seg||!m||isNaN(km)||km<m.kmIni||km>m.kmFim) return;
        const rel=km-m.kmIni,
              line=seg.toGeoJSON().features
                     .find(f=>f.geometry.type==="LineString"),
              pt=turf.along(line,rel,{units:"kilometers"}),
              [lon,lat]=pt.geometry.coordinates;
        L.circleMarker([lat,lon], {
          pane:"overlayPane",
          radius:parseFloat(d.Raio)||6,
          color:d.Cor||"#1976d2",
          weight:2, fillColor:d.Cor||"#1976d2", fillOpacity:1
        }).bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs||""}`)
         .addTo(pontosLayer);
      });
      zoomGlobal();
    },
    error:err=>console.warn("pontos falhou:",err)
  });
}

// 7) Heatmap
function loadHeat(){
  Papa.parse(HEAT_URL, {
    download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      if(heatLayer) mapa.removeLayer(heatLayer);
      const pts=[];
      data.forEach(r=>{
        let key=r.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers)
            .find(k=>k.endsWith("_"+r.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key],
              km0=parseFloat(r["Km Inicial"].replace(",",".")),
              km1=parseFloat(r["Km Final"].replace(",","."));
        if(!seg||!m||isNaN(km0)||isNaN(km1)) return;
        const rel0=km0-m.kmIni, rel1=km1-m.kmIni,
              line=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString"),
              p0=turf.along(line,rel0,{units:"kilometers"}),
              p1=turf.along(line,rel1,{units:"kilometers"}),
              slice=turf.lineSlice(p0,p1,line),
              Ls=turf.length(slice,{units:"kilometers"}),
              samples=Math.ceil(Ls*5)+1;
        for(let i=0;i<=samples;i++){
          const p=turf.along(slice,(Ls*i)/samples,{units:"kilometers"});
          pts.push([p.geometry.coordinates[1],p.geometry.coordinates[0],1]);
        }
      });
      heatLayer=L.heatLayer(pts,{radius:25,blur:15}).addTo(mapa);
      zoomGlobal();
    },
    error:err=>console.warn("heat falhou:",err)
  });
}

// 8) Linhas por trecho
function loadLines(){
  Papa.parse(LINE_URL, {
    download:true, header:true, skipEmptyLines:true,
    complete:({data})=>{
      if(lineLayer) mapa.removeLayer(lineLayer);
      const grp=L.layerGroup([], {pane:"rodoviasPane"}).addTo(mapa);
      data.forEach(rw=>{
        let key=rw.Rodovia, seg=rodLayers[key];
        if(!seg){
          const mk=Object.keys(rodLayers)
            .find(k=>k.endsWith("_"+rw.Rodovia));
          if(mk) seg=rodLayers[mk], key=mk;
        }
        const m=metaRod[key],
              km0=parseFloat(rw["Km Inicial"].replace(",",".")),
              km1=parseFloat(rw["Km Final"].replace(",","."));
        if(!seg||!m||isNaN(km0)||isNaN(km1)) return;
        const domParser=new DOMParser(),
              geom=kmlToGeoJSON(rw.kmlText), // caso queira usar KML direto
              feat=seg.toGeoJSON().features.find(f=>f.geometry.type==="LineString");
        // slice
        const p0=turf.along(feat, km0-m.kmIni,{units:"kilometers"}),
              p1=turf.along(feat, km1-m.kmIni,{units:"kilometers"}),
              slice=turf.lineSlice(p0,p1,feat);
        L.geoJSON(slice,{
          pane:"rodoviasPane",
          style:{ color:rw.Cor||"#f00", weight:parseFloat(rw.Espessura)||4 }
        }).bindPopup(
          `<b>${key}</b><br>Km ${km0.toFixed(3)}–${km1.toFixed(3)}<br>${rw.Obs||""}`
        ).addTo(grp);
      });
      lineLayer=grp;
      zoomGlobal();
    },
    error:err=>console.warn("lines falhou:",err)
  });
}

// 9) helper kml→geojson (não mais usado)
function kmlToGeoJSON(xml){
  const dom=new DOMParser().parseFromString(xml,"text/xml"),
        feats=[];
  Array.from(dom.getElementsByTagName("Placemark")).forEach(pm=>{
    const ls=pm.getElementsByTagName("LineString")[0];
    if(!ls) return;
    const coords=ls.getElementsByTagName("coordinates")[0].textContent
      .trim().split(/\s+/).map(s=>s.split(",").map(Number).slice(0,2));
    if(coords.length>1) feats.push({
      type:"Feature",
      geometry:{type:"LineString",coordinates:coords}
    });
  });
  return {type:"FeatureCollection",features:feats};
}
