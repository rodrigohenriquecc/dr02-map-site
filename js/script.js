/* global L, JSZip, shp, turf, Papa, firebase */

/* ── Firebase -------------------------------------------------- */
const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId:             "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();                 // Cloud Firestore
const col = db.collection("pontos");             // coleção fixa

/* ── Arquivos RC / KMZ ---------------------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];
const KMZ_FILES = [
  'data/RC2.2_SP127.kmz','data/RC2.2_SP165.kmz','data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz','data/RC2.2_SP250.kmz','data/RC2.2_SPA294.250.kmz'
];

/* ── Meta-dados, mapa, layers --------------------------------- */
const metaRod={}, rcLayers={}, rodLayers={};
const isMobile = matchMedia('(max-width:600px)').matches;

const mapa=L.map('map').setView([-23.8,-48.5],7);   // ← mapa criado ANTES de usar
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);

L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

const pontosLayer=L.layerGroup().addTo(mapa);

fetch('data/rodovias_meta.json')
  .then(r=>r.json())
  .then(arr=>arr.forEach(m=>metaRod[m.id]=m));

/* ── helpers --------------------------------------------------- */
const addLabel=(p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),
    interactive:false}).addTo(mapa);
function zoomGlobal(){
  const b=L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ]).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ── Painel KM visibilidade ----------------------------------- */
const kmCard=document.getElementById('kmCard');
document.getElementById('btnToggle').onclick=()=>{
  kmCard.style.display = kmCard.style.display==='block' ? 'none':'block';
};
if(!isMobile) kmCard.style.display='block';

/* ── Painel KM lógica ----------------------------------------- */
document.getElementById('btnKm').onclick=localizarKm;
document.getElementById('selRod').onchange=e=>{
  const m=metaRod[e.target.value];
  document.getElementById('infoKm').textContent =
    m?`Km ${m.kmIni} – ${m.kmFim}`:'';
};
function atualizarSelect(){
  const sel=document.getElementById('selRod');
  const old=sel.value;
  sel.innerHTML='<option value="">(selecione)</option>'+
    Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join('');
  sel.value=old; sel.onchange({target:sel});
}

/* ── RC shapefiles -------------------------------------------- */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo=await shp(zip);
    const nome=zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const lyr=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                .addTo(mapa);
    rcLayers[nome]=lyr;
    addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
  }catch(e){console.error('RC',zip,e);}
})).then(zoomGlobal);

/* ── KMZ rodovias (LineString) -------------------------------- */
KMZ_FILES.forEach(async file=>{
  try{
    const resp=await fetch(encodeURI(file));
    if(!resp.ok){console.error('404',file);return;}
    const buf=await resp.arrayBuffer();
    const zip=await JSZip.loadAsync(buf);
    const kml=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kml){console.warn('KMZ sem KML',file);return;}

    const geo=kmlToGeoJSON(await zip.file(kml).async('string'));
    const title=file.split('/').pop().replace('.kmz','');

    const lyr=L.geoJSON(geo,{
      style:{color:'#555',weight:3,opacity:.9},
      filter:f=>f.geometry.type==='LineString'
    }).addTo(mapa);

    rodLayers[title]=lyr; atualizarSelect();

    const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
    if(sig){
      lyr.eachLayer(l=>{
        if(l.getBounds&&l.getBounds().isValid())
          addLabel(l.getBounds().getCenter(),
                   sig[0].toUpperCase(),'rod-label');
      });
    }
    zoomGlobal();
  }catch(e){console.error('KMZ',file,e);}
});

/* ── CSV / drag&drop ------------------------------------------ */
document.getElementById('btnCSV').onclick=()=>csvInput.click();
const csvInput=document.getElementById('csvInput');
csvInput.onchange=e=>e.target.files[0]&&processCSV(e.target.files[0]);
mapa.getContainer().addEventListener('dragover',e=>{
  e.preventDefault();e.dataTransfer.dropEffect='copy';});
mapa.getContainer().addEventListener('drop',e=>{
  e.preventDefault();const f=e.dataTransfer.files[0];
  if(f&&f.name.endsWith('.csv'))processCSV(f);});

/* ── Botão Salvar --------------------------------------------- */
document.getElementById('btnSave').onclick=async ()=>{
  const pts=Object.values(pontosLayer._layers);
  if(!pts.length){alert('Nenhum ponto para salvar');return;}

  /* remove todos docs atuais */
  const snap=await col.get();
  const batchDel=db.batch();
  snap.forEach(d=>batchDel.delete(d.ref));
  await batchDel.commit();

  /* adiciona de novo */
  const batch=db.batch();
  pts.forEach((m,i)=>batch.set(col.doc(String(i)),m.options.meta));
  await batch.commit();
  alert('Pontos salvos!');
};

/* ── Carregar pontos já salvos -------------------------------- */
col.get().then(snap=>{
  snap.forEach(d=>addPontoLinha(d.data()));
  if(Object.keys(pontosLayer._layers).length)
    mapa.fitBounds(pontosLayer.getBounds());
});

/* ── Funções -------------------------------------------------- */
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
  const kmVal=parseFloat(KM),meta=metaRod[Rodovia];
  if(!meta||isNaN(kmVal)||kmVal<meta.kmIni||kmVal>meta.kmFim) return;

  const line=lyr.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
  const pt=turf.along(line,kmVal-meta.kmIni,{units:'kilometers'});
  const [lon,lat]=pt.geometry.coordinates;

  const marker=L.circleMarker([lat,lon],{
    radius:parseFloat(Raio)||6,
    color:Cor||'#1976d2',weight:2,
    fillColor:Cor||'#1976d2',fillOpacity:1
  }).bindPopup(`<b>${Rodovia}</b> Km ${KM}<br>${Obs||''}`)
    .addTo(pontosLayer);

  marker.options.meta = {Rodovia,KM,Obs,Cor,Raio};
}
function localizarKm(){ /* … igual à versão anterior … */ }
function kmlToGeoJSON(txt){ /* … igual … */ }
