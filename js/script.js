/* global L, JSZip, shp, turf, Papa, firebase */

/* ---------- Firebase ---------- */
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
const col = db.collection("pontos");

/* ---------- listas ---------- */
const RC_ZIPS=[/* … */];
const KMZ_FILES=[/* … */];

/* ---------- mapa ---------- */
const isMobile = matchMedia('(max-width:600px)').matches;
const mapa=L.map('map').setView([-23.8,-48.5],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);
L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

const rcLayers={}, rodLayers={}, metaRod={}, pontosLayer=L.layerGroup().addTo(mapa);

/* ---------- util ---------- */
function addLabel(p,txt,cls){
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),
              interactive:false}).addTo(mapa);
}
function zoomGlobal(){
  const b=L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ]).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ---------- carregamento sequencial ---------- */
(async()=>{
  /* meta-dados */
  const metaArr=await fetch('data/rodovias_meta.json').then(r=>r.json());
  metaArr.forEach(m=>metaRod[m.id]=m);

  /* RC */
  for(const zip of RC_ZIPS){
    try{
      const geo=await shp(zip);
      const nome=zip.match(/RC_[\d._]+/)[0].replace('_',' ');
      const lyr=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}}).addTo(mapa);
      rcLayers[nome]=lyr;
      addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
    }catch(e){console.error('RC',zip,e);}
  }

  /* Rodovias */
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
      const lyr=L.geoJSON(geo,{
        style:{color:'#555',weight:3,opacity:.9},
        filter:f=>f.geometry.type==='LineString'
      }).addTo(mapa);
      rodLayers[title]=lyr;

      const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
      if(sig){
        addLabel(lyr.getBounds().getCenter(),sig[0].toUpperCase(),'rod-label');
      }
    }catch(e){console.error('KMZ',file,e);}
  }

  zoomGlobal();
  initUI();                 // só inicializa interface quando tudo pronto
  carregarFirestore();      // busca pontos gravados
})();

/* ---------- UI ---------- */
function initUI(){
  const kmCard=document.getElementById('kmCard');
  if(!isMobile) kmCard.style.display='block';
  document.getElementById('btnToggle').onclick=()=>{
    kmCard.style.display = kmCard.style.display==='block' ? 'none':'block';
  };

  const selRod=document.getElementById('selRod');
  selRod.innerHTML='<option value="">(selecione)</option>'+
    Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join('');
  selRod.onchange=e=>{
    const m=metaRod[e.target.value];
    document.getElementById('infoKm').textContent =
      m?`Km ${m.kmIni} – ${m.kmFim}`:'';
  };

  document.getElementById('btnKm').onclick=localizarKm;
  document.getElementById('btnCSV').onclick=()=>csvInput.click();
  const csvInput=document.getElementById('csvInput');
  csvInput.onchange=e=>e.target.files[0]&&processCSV(e.target.files[0]);
  mapa.getContainer().addEventListener('dragover',e=>{
    e.preventDefault();e.dataTransfer.dropEffect='copy';});
  mapa.getContainer().addEventListener('drop',e=>{
    e.preventDefault();const f=e.dataTransfer.files[0];
    if(f&&f.name.endsWith('.csv'))processCSV(f);});

  document.getElementById('btnSave').onclick=salvarFirestore;
}

/* ---------- localizar Km  (inalterado) ---------- */
function localizarKm(){ /* igual à versão anterior */ }

/* ---------- CSV ---------- */
function processCSV(file){
  Papa.parse(file,{
    header:true,skipEmptyLines:true,
    complete:res=>{
      pontosLayer.clearLayers();
      res.data.forEach(addPonto);
      if(Object.keys(pontosLayer._layers).length)
        mapa.fitBounds(pontosLayer.getBounds());
    },
    error:err=>alert('Erro CSV: '+err.message)
  });
}

/* ---------- adicionar ponto ---------- */
function addPonto(d){
  let {Rodovia,KM,Obs,Cor,Raio,LAT,LON}=d;
  KM=String(KM).trim();
  const raio=parseFloat(Raio)||6;
  const cor =Cor||'#1976d2';

  let lat=LAT, lon=LON;
  if(lat==null||lon==null){
    const lyr=rodLayers[Rodovia]; if(!lyr) return;
    const meta=metaRod[Rodovia]; const kmVal=parseFloat(KM);
    if(!meta||isNaN(kmVal)||kmVal<meta.kmIni||kmVal>meta.kmFim) return;
    const line=lyr.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
    const pt=turf.along(line,kmVal-meta.kmIni,{units:'kilometers'});
    [lon,lat]=pt.geometry.coordinates;
  }

  const m=L.circleMarker([lat,lon],{
    radius:raio,color:cor,weight:2,fillColor:cor,fillOpacity:1
  }).bindPopup(`<b>${Rodovia}</b> Km ${KM}<br>${Obs||''}`).addTo(pontosLayer);

  m.options.meta = {Rodovia,KM,Obs,Cor,Raio:raio,LAT:lat,LON:lon};
}

/* ---------- Firestore: carregar ---------- */
function carregarFirestore(){
  col.get().then(snap=>{
    snap.forEach(d=>addPonto(d.data()));
    zoomGlobal();
  }).catch(e=>{
    console.warn('Firestore offline',e);
  });
}

/* ---------- Firestore: salvar ---------- */
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
    alert('Falha ao salvar.\nConfira regras Firestore e domínio autorizado.');
  }
}

/* ---------- KML → GeoJSON ---------- */
function kmlToGeoJSON(txt){ /* igual */ }
