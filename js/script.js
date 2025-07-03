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
const metaRod     = {};      // id → {kmIni,iniLat,iniLon,kmFim,fimLat,fimLon}
const rcLayers    = {};
const rodLayers   = {};
const pontosLayer = L.layerGroup().addTo(mapa);
let heatLayer, lineLayer;
const rodLabelMarkers = []; // armazena marcadores de rodovias

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19, attribution:"&copy; OpenStreetMap"
}).addTo(mapa);
L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

// ─── Helpers ─────────────────────────────────────────────────
function addLabel(latlng, text, cls) {
  const marker = L.marker(latlng, {
    icon: L.divIcon({className:cls, html:text, iconSize:null}),
    interactive: false
  }).addTo(mapa);
  if (cls === 'rod-label') rodLabelMarkers.push(marker);
  return marker;
}

function zoomGlobal() {
  const group = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ];
  const bounds = L.featureGroup(group).getBounds();
  if (bounds.isValid()) mapa.fitBounds(bounds);
}

// evita sobreposição de rótulos de rodovia
function updateRodLabels() {
  const threshold = 50; // pixels de distância mínima
  const used = [];
  rodLabelMarkers.forEach(marker => {
    const el = marker.getElement();
    if (!el) return;
    const p = mapa.latLngToLayerPoint(marker.getLatLng());
    let ok = true;
    for (const u of used) {
      if (Math.abs(p.x-u.x) < threshold && Math.abs(p.y-u.y) < threshold) { ok = false; break; }
    }
    el.style.display = ok ? '' : 'none';
    if (ok) used.push(p);
  });
}

// 2) Carrega metaRod via Google Sheets
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv";
Papa.parse(SHEET_CSV_URL, {
  download:true, header:true, skipEmptyLines:true,
  complete: ({data}) => {
    data.forEach(r => {
      const kmIni = parseFloat(r.kmIni.replace(',', '.'));
      const kmFim = parseFloat(r.kmFim.replace(',', '.'));
      const [iniLat,iniLon] = r.LatLonIni.split(',').map(Number);
      const [fimLat,fimLon] = r.LatLonFim.split(',').map(Number);
      metaRod[r.id] = {kmIni, iniLat, iniLon, kmFim, fimLat, fimLon};
    });
    carregarData();
  },
  error: err => alert('Erro ao carregar planilha:\n'+err.message)
});

// 3) Carrega RC e rodovias KMZ
async function carregarData() {
  const RC_ZIPS = [
    'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
    'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
  ];
  for (const zip of RC_ZIPS) {
    try {
      const geo = await shp(zip);
      const name = zip.match(/RC_[\d._]+/)[0].replace('_',' ');
      const lyr = L.geoJSON(geo, {style:{color:'#000',weight:2.5,fill:false}}).addTo(mapa);
      rcLayers[name] = lyr;
      addLabel(lyr.getBounds().getCenter(), name, 'rc-label');
    } catch(e) { console.error('RC', zip, e); }
  }
  for (const id of Object.keys(metaRod)) {
    const path = `data/${id}.kmz`;
    try {
      const resp = await fetch(path);
      if (!resp.ok) { console.warn('KMZ não encontrado:', path); continue; }
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const kml = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.kml'));
      if (!kml) { console.warn('KMZ sem KML:', path); continue; }
      const txt = await zip.file(kml).async('string');
      const geo = kmlToGeoJSON(txt);
      const lyr = L.geoJSON(geo, {
        style:{color:'#555',weight:3,opacity:0.9},
        filter:f=>f.geometry.type==='LineString'
      }).addTo(mapa);
      rodLayers[id] = lyr;
      const label = id.includes('_')? id.split('_')[1] : id;
      addLabel(lyr.getBounds().getCenter(), label, 'rod-label');
    } catch(e) { console.error('KMZ', path, e); }
  }
  zoomGlobal();
  mapa.on('zoomend', updateRodLabels);
  initUI();
  if (online) carregarFirestore();
}

// 4) Monta UI & handlers
function initUI() {
  document.getElementById('btnToggle').onclick = () => {
    const kmCard = document.getElementById('kmCard');
    kmCard.style.display = kmCard.style.display==='block'?'none':'block';
  };
  const menu = document.getElementById('uploadMenu');
  document.getElementById('btnCSV').onclick = () => {
    menu.style.display = menu.style.display==='block'?'none':'block';
  };
  menu.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      menu.style.display = 'none';
      if (mode) document.getElementById(
        mode==='points'?'csvPointsInput':
        mode==='heatmap'?'csvHeatInput':
        mode==='line'?'csvLineInput':''
      ).click();
    };
  });
  document.getElementById('btnClearPoints').onclick = () => pontosLayer.clearLayers();
  document.getElementById('btnClearHeatmap').onclick = () => { if (heatLayer) mapa.removeLayer(heatLayer), heatLayer=null; };
  document.getElementById('btnClearLines').onclick = () => { if (lineLayer) mapa.removeLayer(lineLayer), lineLayer=null; };
  document.getElementById('csvPointsInput').onchange = e => e.target.files[0] && processPointsCSV(e.target.files[0]);
  document.getElementById('csvHeatInput').onchange   = e => e.target.files[0] && processHeatCSV(e.target.files[0]);
  document.getElementById('csvLineInput').onchange   = e => e.target.files[0] && processLineCSV(e.target.files[0]);
  document.getElementById('btnKm').onclick = localizarKm;
  document.getElementById('btnSave').onclick = salvarFirestore;
}

// 5) Pontos de interesse
function processPointsCSV(file){
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
    pontosLayer.clearLayers();
    data.forEach(d=>{
      // fallback match rodovia key
      let key = d.Rodovia;
      let seg = rodLayers[key];
      if(!seg){
        const matchKey = Object.keys(rodLayers).find(k=>k.endsWith("_"+d.Rodovia));
        if(matchKey){ seg = rodLayers[matchKey]; key = matchKey; }
      }
      const m = metaRod[key];
      const km = parseFloat(d.KM.replace(",","."));
      if(!seg||!m||isNaN(km)||km < m.kmIni||km > m.kmFim) return;
      const rel = km - m.kmIni;
      const line = seg.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
      const pt = turf.along(line, rel, {units:'kilometers'});
      const [lon,lat] = pt.geometry.coordinates;
      L.circleMarker([lat,lon],{
        radius:parseFloat(d.Raio)||6,
        color:d.Cor||'#1976d2', weight:2,
        fillColor:d.Cor||'#1976d2', fillOpacity:1
      }).bindPopup(`<b>${key}</b><br>Km ${d.KM}<br>${d.Obs||''}`)
        .addTo(pontosLayer);
    });
    if(Object.keys(pontosLayer._layers).length) mapa.fitBounds(pontosLayer.getBounds());
  }});
}

// 6) Mapa de Calor
function processHeatCSV(file){
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
    if(heatLayer) mapa.removeLayer(heatLayer);
    const pts=[];
    data.forEach(r=>{
      let key = r.Rodovia;
      let seg = rodLayers[key];
      if(!seg){
        const matchKey = Object.keys(rodLayers).find(k=>k.endsWith("_"+r.Rodovia));
        if(matchKey){ seg = rodLayers[matchKey]; key = matchKey; }
      }
      const m = metaRod[key];
      if(!seg||!m) return;
      const km0=parseFloat(r['Km Inicial'].replace(',','.'));
      const km1=parseFloat(r['Km Final'].replace(',','.'));
      if(isNaN(km0)||isNaN(km1)) return;
      const rel0 = km0 - m.kmIni;
      const rel1 = km1 - m.kmIni;
      const line = seg.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
      const p0 = turf.along(line, rel0, {units:'kilometers'});
      const p1 = turf.along(line, rel1, {units:'kilometers'});
      const slice = turf.lineSlice(p0,p1,line);
      const Ls = turf.length(slice,{units:'kilometers'});
      const samples = Math.ceil(Ls*5)+1;
      for(let i=0;i<=samples;i++){
        const p = turf.along(slice, Ls*(i/samples), {units:'kilometers'});
        pts.push([p.geometry.coordinates[1],p.geometry.coordinates[0],1]);
      }
    });
    heatLayer = L.heatLayer(pts,{radius:25,blur:15}).addTo(mapa);
    zoomGlobal();
  }});
}

// 7) Linhas por trecho
function processLineCSV(file){
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
    if(lineLayer) mapa.removeLayer(lineLayer);
    const grp = L.layerGroup().addTo(mapa);
    data.forEach(r=>{
      let key = r.Rodovia;
      let seg = rodLayers[key];
      if(!seg){
        const matchKey = Object.keys(rodLayers).find(k=>k.endsWith("_"+r.Rodovia));
        if(matchKey){ seg = rodLayers[matchKey]; key = matchKey; }
      }
      const m = metaRod[key];
      if(!seg||!m) return;
      const km0=parseFloat(r['Km Inicial'].replace(',','.'));
      const km1=parseFloat(r['Km Final'].replace(',','.'));
      if(isNaN(km0)||isNaN(km1)) return;
      const rel0=km0 - m.kmIni;
      const rel1=km1 - m.kmIni;
      const lineFeat = seg.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
      const p0 = turf.along(lineFeat, rel0, {units:'kilometers'});
      const p1 = turf.along(lineFeat, rel1, {units:'kilometers'});
      const slice = turf.lineSlice(p0,p1,lineFeat);
      L.geoJSON(slice,{style:{color:r.Cor||'#f00',weight:parseFloat(r.Espessura)||4}})
        .bindPopup(`<b>${key}</b><br>Km ${km0}–${km1}<br>${r.Obs||''}`)
        .addTo(grp);
    });
    lineLayer = grp;
    zoomGlobal();
  }});
}
function processHeatCSV(file) {
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
    if (heatLayer) mapa.removeLayer(heatLayer);
    const pts = [];
    data.forEach(r=>{
      const seg=rodLayers[r.Rodovia], m=metaRod[r.Rodovia]; if(!seg||!m) return;
      const km0=parseFloat(r['Km Inicial'].replace(',','.')),
            km1=parseFloat(r['Km Final'].replace(',','.'));
      const rel0=km0-m.kmIni, rel1=km1-m.kmIni;
      const line=seg.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
      const p0=turf.along(line,rel0,{units:'kilometers'});
      const p1=turf.along(line,rel1,{units:'kilometers'});
      const slice=turf.lineSlice(p0,p1,line);
      const Ls=turf.length(slice,{units:'kilometers'});
      const samples=Math.ceil(Ls*5)+1;
      for(let i=0;i<=samples;i++){
        const p=turf.along(slice,(Ls*i)/samples,{units:'kilometers'});
        pts.push([p.geometry.coordinates[1],p.geometry.coordinates[0],1]);
      }
    });
    heatLayer=L.heatLayer(pts,{radius:25,blur:15}).addTo(mapa);
    zoomGlobal();
  }});
}

// 7) Linhas por trecho
function processLineCSV(file) {
  Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>{
    if (lineLayer) mapa.removeLayer(lineLayer);
    const grp=L.layerGroup().addTo(mapa);
    data.forEach(r=>{
      const seg=rodLayers[r.Rodovia], m=metaRod[r.Rodovia]; if(!seg||!m) return;
      const km0=parseFloat(r['Km Inicial'].replace(',','.')),
            km1=parseFloat(r['Km Final'].replace(',','.'));
      const rel0=km0-m.kmIni, rel1=km1-m.kmIni;
      const lineFeat=seg.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
      const p0=turf.along(lineFeat,rel0,{units:'kilometers'});
      const p1=turf.along(lineFeat,rel1,{units:'kilometers'});
      const slice=turf.lineSlice(p0,p1,lineFeat);
      L.geoJSON(slice,{style:{color:r.Cor||'#f00',weight:parseFloat(r.Espessura)||4}})
        .bindPopup(`<b>${r.Rodovia}</b><br>Km ${km0}–${km1}<br>${r.Obs||''}`)
        .addTo(grp);
    });
    lineLayer=grp; zoomGlobal();
  }});
}

// 8) Localizar KM
function localizarKm(){
  const rod=document.getElementById('selRod').value;
  const km=parseFloat(document.getElementById('kmAlvo').value.replace(',','.'));
  const m=metaRod[rod]; if(!rod||isNaN(km)||!m||km<m.kmIni||km>m.kmFim) return alert('Informe rodovia válida e Km dentro do intervalo.');
  const line=rodLayers[rod].toGeoJSON().features.find(f=>f.geometry.type==='LineString');
  const pt=turf.along(line,km-m.kmIni,{units:'kilometers'});
  const [lon,lat]=pt.geometry.coordinates;
  L.popup().setLatLng([lat,lon]).setContent(`<b>${rod}</b><br>KM ${km.toFixed(3)}`).openOn(mapa);
  mapa.setView([lat,lon],15);
}

// 9) Firestore
function carregarFirestore(){ col.get().then(snap=>{ snap.forEach(doc=>addPonto(doc.data())); zoomGlobal(); }).catch(e=>console.warn('Firestore off-line:',e.message)); }
async function salvarFirestore(){
  if(!online) return alert('Firestore off-line ou não configurado.');
  const pts=Object.values(pontosLayer._layers);
  if(!pts.length) return alert('Nenhum ponto para salvar.');
  try{
    const snap=await col.get();
    const bd=db.batch(); snap.forEach(doc=>bd.delete(doc.ref)); await bd.commit();
    const ba=db.batch(); pts.forEach((m,i)=>ba.set(col.doc(String(i)),m.options.meta)); await ba.commit();
    alert('✅ Dados salvos com sucesso!');
  }catch(e){ console.error(e); alert('Erro ao salvar.'); }
}

// 10) KML→GeoJSON
function kmlToGeoJSON(xmlStr){
  const dom=new DOMParser().parseFromString(xmlStr,'text/xml');
  const feats=[];
  Array.from(dom.getElementsByTagName('Placemark')).forEach(pm=>{
    const ls=pm.getElementsByTagName('LineString')[0]; if(!ls) return;
    const coords=ls.getElementsByTagName('coordinates')[0].textContent.trim()
      .split(/\s+/).map(s=>s.split(',').map(Number).slice(0,2));
    if(coords.length>1) feats.push({type:'Feature',geometry:{type:'LineString',coordinates:coords}});
  });
  return {type:'FeatureCollection',features:feats};
}
