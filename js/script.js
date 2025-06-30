/* global L, JSZip, shp, turf, Papa, firebase */

/* ---------- Firebase (compat) ---------- */
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId:             "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const col = db.collection("pontos");   // coleção 'pontos'

/* ---------- Listas de arquivos ---------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz','data/RC2.2_SP165.kmz','data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz','data/RC2.2_SP250.kmz','data/RC2.2_SPA294.250.kmz'
];

/* ---------- mapa e camadas ---------- */
const isMobile = matchMedia('(max-width:600px)').matches;
const mapa = L.map('map').setView([-23.8,-48.5],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);
L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

const rcLayers={}, rodLayers={}, metaRod={}, pontosLayer=L.layerGroup().addTo(mapa);

/* ---------- helpers ---------- */
const addLabel=(p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),interactive:false}).addTo(mapa);

function zoomGlobal(){
  const b=L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ]).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ---------- painel KM visibilidade ---------- */
const kmCard=document.getElementById('kmCard');
document.getElementById('btnToggle').onclick=()=>{
  kmCard.style.display = kmCard.style.display==='block' ? 'none':'block';
};
if(!isMobile) kmCard.style.display='block';

/* ---------- fetch meta-dados, RC, KMZ ---------- */
Promise.all([
  fetch('data/rodovias_meta.json').then(r=>r.json())
]).then(([metaArr])=>{
  metaArr.forEach(m=>metaRod[m.id]=m);
  return carregarRCs();
}).then(()=>carregarKMZs())
  .then(()=>inicializarUI())
  .catch(err=>console.error(err));

/* ---------- carregar RC shapefiles ---------- */
async function carregarRCs(){
  for(const zip of RC_ZIPS){
    try{
      const geo=await shp(zip);
      const nome=zip.match(/RC_[\d._]+/)[0].replace('_',' ');
      const lyr=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}}).addTo(mapa);
      rcLayers[nome]=lyr;
      addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
    }catch(e){console.error('RC',zip,e);}
  }
}

/* ---------- carregar KMZ rodovias ---------- */
async function carregarKMZs(){
  for(const file of KMZ_FILES){
    try{
      const resp=await fetch(encodeURI(file));
      if(!resp.ok){console.error('404',file);continue;}
      const buf=await resp.arrayBuffer();
      const zip=await JSZip.loadAsync(buf);
      const kml=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
      if(!kml){console.warn('KMZ sem KML',file);continue;}

      const geo=kmlToGeoJSON(await zip.file(kml).async('string'));
      const title=file.split('/').pop().replace('.kmz','');

      const lyr=L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9},
                               filter:f=>f.geometry.type==='LineString'}).addTo(mapa);
      rodLayers[title]=lyr;

      const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
      if(sig){
        lyr.eachLayer(l=>{
          if(l.getBounds&&l.getBounds().isValid())
            addLabel(l.getBounds().getCenter(),sig[0].toUpperCase(),'rod-label');
        });
      }
    }catch(e){console.error('KMZ',file,e);}
  }
  zoomGlobal();
}

/* ---------- UI e botões só após rodovias prontas ---------- */
function inicializarUI(){
  /* → select rodovia */
  function atualizarSelect(){
    selRod.innerHTML='<option value="">(selecione)</option>'+
      Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join('');
  }
  const selRod=document.getElementById('selRod');
  atualizarSelect();
  selRod.onchange=e=>{
    const m=metaRod[e.target.value];
    document.getElementById('infoKm').textContent =
      m?`Km ${m.kmIni} – ${m.kmFim}`:'';
  };

  /* → localizar Km */
  document.getElementById('btnKm').onclick=localizarKm;

  /* → CSV */
  document.getElementById('btnCSV').onclick=()=>csvInput.click();
  const csvInput=document.getElementById('csvInput');
  csvInput.onchange=e=>e.target.files[0]&&processCSV(e.target.files[0]);
  mapa.getContainer().addEventListener('dragover',e=>{
    e.preventDefault();e.dataTransfer.dropEffect='copy';});
  mapa.getContainer().addEventListener('drop',e=>{
    e.preventDefault();const f=e.dataTransfer.files[0];
    if(f&&f.name.endsWith('.csv'))processCSV(f);});

  /* → salvar pontos */
  document.getElementById('btnSave').onclick=salvarFirestore;

  /* → carregar pontos Firestore */
  col.get().then(snap=>{ snap.forEach(d=>addPontoLinha(d.data())); zoomGlobal(); });
}

/* ---------- localizar Km ---------- */
function localizarKm(){
  const rod=document.getElementById('selRod').value;
  const km=parseFloat(document.getElementById('kmAlvo').value);
  const meta=metaRod[rod];
  if(!rod||isNaN(km)||!meta||km<meta.kmIni||km>meta.kmFim){alert('Entrada inválida');return;}
  const line=rodLayers[rod].toGeoJSON().features.find(f=>f.geometry.type==='LineString');
  const pt=turf.along(line,km-meta.kmIni,{units:'kilometers'});
  const [lon,lat]=pt.geometry.coordinates;
  L.popup().setLatLng([lat,lon])
           .setContent(`<b>${rod}</b><br>KM ${km.toFixed(3)}`)
           .openOn(mapa);
  mapa.setView([lat,lon],15);
}

/* ---------- CSV / pontos ---------- */
function processCSV(file){
  Papa.parse(file,{
    header:true,skipEmptyLines:true,
    complete:res=>{
      pontosLayer.clearLayers();
      res.data.forEach(addPontoLinha);
      if(Object.keys(pontosLayer._layers).length)
        mapa.fitBounds(pontosLayer.getBounds());
    },
    error:err=>alert('Erro CSV: '+err.message)
  });
}
function addPontoLinha(l){
  const {Rodovia,KM,Obs,Cor,Raio}=l;
  const lyr=rodLayers[Rodovia]; if(!lyr) return;
  const meta=metaRod[Rodovia], kmVal=parseFloat(KM);
  if(!meta||isNaN(kmVal)||kmVal<meta.kmIni||kmVal>meta.kmFim) return;
  const line=lyr.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
  const pt=turf.along(line,kmVal-meta.kmIni,{units:'kilometers'});
  const [lon,lat]=pt.geometry.coordinates;
  const marker=L.circleMarker([lat,lon],{
    radius:parseFloat(Raio)||6,
    color:Cor||'#1976d2',weight:2,fillColor:Cor||'#1976d2',fillOpacity:1
  }).bindPopup(`<b>${Rodovia}</b> Km ${KM}<br>${Obs||''}`)
    .addTo(pontosLayer);
  marker.options.meta = {Rodovia,KM,Obs,Cor,Raio};
}

/* ---------- salvar Firestore ---------- */
async function salvarFirestore(){
  const pts=Object.values(pontosLayer._layers);
  if(!pts.length){alert('Nenhum ponto para salvar');return;}

  try{
    const snap=await col.get();
    const batch=db.batch();
    snap.forEach(d=>batch.delete(d.ref));
    await batch.commit();

    const batch2=db.batch();
    pts.forEach((m,i)=>batch2.set(col.doc(String(i)),m.options.meta));
    await batch2.commit();
    alert('Pontos salvos!');
  }catch(e){
    console.error(e);
    alert('Falha ao salvar no Firestore.\nVerifique as chaves e o domínio autorizado.');
  }
}

/* ---------- KML -> GeoJSON ---------- */
function kmlToGeoJSON(txt){
  const dom=new DOMParser().parseFromString(txt,'text/xml');
  const feats=[];
  [...dom.getElementsByTagName('Placemark')].forEach(pm=>{
    const line=pm.getElementsByTagName('LineString')[0];
    if(line){
      const coords=line.getElementsByTagName('coordinates')[0].textContent.trim()
        .split(/\s+/).map(s=>s.split(',').map(Number).slice(0,2));
      if(coords.length>1) feats.push({type:'Feature',geometry:{type:'LineString',coordinates:coords}});
    }
  });
  return {type:'FeatureCollection',features:feats};
}
