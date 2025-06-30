/* global L, JSZip, shp, turf, Papa, firebase */

//════════ 0. Configuração Firebase (compat) ════════
let db = null, col = null, online = false;
try {
  // ⚠️ Cole aqui suas chaves reais:
  const firebaseConfig = {
    apiKey:            "SUA_API_KEY",
    authDomain:        "SEU_PROJETO.firebaseapp.com",
    projectId:         "SEU_PROJETO",
    storageBucket:     "SEU_PROJETO.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId:             "APP_ID"
  };
  firebase.initializeApp(firebaseConfig);
  db   = firebase.firestore();
  col  = db.collection("pontos");
  online = true;
} catch (e) {
  console.warn('Firestore off-line ou sem configuração — modo local.');
}

//════════ 1. URL da planilha Google Sheets como CSV ════════
const SHEET_CSV_URL = 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?gid=411284139&single=true&output=csv';

//════════ 2. Mapas, camadas e variáveis globais ════════
const isMobile     = matchMedia('(max-width:600px)').matches;
const mapa         = L.map('map').setView([-23.8,-48.5],7);
const metaRod      = {};    // id → {kmIni,iniLat,iniLon,kmFim,fimLat,fimLon}
const rcLayers     = {};
const rodLayers    = {};
const pontosLayer  = L.layerGroup().addTo(mapa);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,attribution:'&copy; OpenStreetMap'
}).addTo(mapa);

L.control.layers(null,null,{collapsed:isMobile}).addTo(mapa);

const addLabel=(p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),interactive:false})
   .addTo(mapa);

function zoomGlobal(){
  const grp = [
    ...Object.values(rcLayers),
    ...Object.values(rodLayers),
    ...Object.values(pontosLayer._layers)
  ];
  const b = L.featureGroup(grp).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

//════════ 3. Carrega metaRodda de Google Sheets ════════
Papa.parse(SHEET_CSV_URL,{
  download: true,
  header:   true,
  skipEmptyLines: true,
  complete: ({data}) => {
    data.forEach(r => {
      // kmIni e kmFim podem vir como "350,000"
      const kmIni = parseFloat(String(r.kmIni).replace(',','.'));
      const kmFim = parseFloat(String(r.kmFim).replace(',','.'));
      // LatLonIni: "-23.92249,-48.18115"
      const [iniLat, iniLon] = r.LatLonIni.split(',').map(Number);
      const [fimLat, fimLon] = r.LatLonFim.split(',').map(Number);
      metaRod[r.id] = { kmIni, iniLat, iniLon, kmFim, fimLat, fimLon };
    });
    // só depois de meta carregado
    carregarData();
  },
  error: err => alert('Falha ao carregar planilha:\n'+err.message)
});

//════════ 4. Função principal: RC + KMZ + UI + Firestore ════════
async function carregarData(){
  // 4.1 contornos RC
  const RC_ZIPS = [
    'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
    'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
  ];
  for(const zip of RC_ZIPS){
    try{
      const geo = await shp(zip);
      const nome= zip.match(/RC_[\d._]+/)[0].replace('_',' ');
      const lyr = L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                    .addTo(mapa);
      rcLayers[nome]=lyr;
      addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
    }catch(e){console.error('RC',zip,e);}
  }

  // 4.2 rodovias KMZ
  const KMZ_FILES = [
    'data/RC2.2_SP127.kmz','data/RC2.2_SP165.kmz','data/RC2.2_SP181.kmz',
    'data/RC2.2_SP249.kmz','data/RC2.2_SP250.kmz','data/RC2.2_SPA294.250.kmz'
  ];
  for(const file of KMZ_FILES){
    try{
      const resp = await fetch(encodeURI(file));
      if(!resp.ok){console.error('404',file); continue;}
      const buf  = await resp.arrayBuffer();
      const zip  = await JSZip.loadAsync(buf);
      const kml  = Object.keys(zip.files)
                        .find(n=>n.toLowerCase().endsWith('.kml'));
      if(!kml){console.warn('KMZ sem KML',file);continue;}

      const geo   = kmlToGeoJSON(await zip.file(kml).async('string'));
      const title = file.split('/').pop().replace('.kmz','');
      const lyr   = L.geoJSON(geo,{
                        style:{color:'#555',weight:3,opacity:.9},
                        filter:f=>f.geometry.type==='LineString'
                      }).addTo(mapa);
      rodLayers[title]=lyr;
      const sig = (/SP[A-Z]?\s*\d+/i).exec(title);
      if(sig) addLabel(lyr.getBounds().getCenter(),sig[0].toUpperCase(),'rod-label');
    }catch(e){console.error('KMZ',file,e);}
  }

  zoomGlobal();      // ajusta view
  initUI();          // habilita botões e select
  if(online) carregarFirestore();
}

//════════ 5. Interface do usuário ════════
function initUI(){
  const kmCard = document.getElementById('kmCard');
  if(!isMobile) kmCard.style.display='block';
  document.getElementById('btnToggle').onclick = ()=>
    kmCard.style.display = kmCard.style.display==='block' ? 'none' : 'block';

  // select rodovia
  const selRod = document.getElementById('selRod');
  selRod.innerHTML = '<option value="">(selecione)</option>' +
    Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join('');
  selRod.onchange = e=>{
    const m = metaRod[e.target.value];
    document.getElementById('infoKm').textContent =
      m ? `Km ${m.kmIni} – ${m.kmFim}` : '';
  };

  // localizar Km
  document.getElementById('btnKm').onclick = localizarKm;

  // importar CSV de pontos
  const csvInput = document.getElementById('csvInput');
  document.getElementById('btnCSV').onclick = () => csvInput.click();
  csvInput.onchange = e => e.target.files[0] && processCSV(e.target.files[0]);
  mapa.getContainer().addEventListener('dragover',e=>{
    e.preventDefault(); e.dataTransfer.dropEffect='copy';
  });
  mapa.getContainer().addEventListener('drop',e=>{
    e.preventDefault(); const f=e.dataTransfer.files[0];
    if(f&&f.name.endsWith('.csv')) processCSV(f);
  });

  // salvar pontos
  document.getElementById('btnSave').onclick = salvarFirestore;
}

//════════ 6. Funções auxiliares ════════
function localizarKm(){
  const rod = document.getElementById('selRod').value;
  const km  = parseFloat(String(document.getElementById('kmAlvo').value)
                 .replace(',','.'));
  const meta = metaRod[rod];
  if(!rod||isNaN(km)||!meta||km<meta.kmIni||km>meta.kmFim){
    alert('Informe rodovia válida e Km dentro do intervalo.'); return;
  }
  const line = rodLayers[rod].toGeoJSON().features
                 .find(f=>f.geometry.type==='LineString');
  const pt   = turf.along(line, km-meta.kmIni, {units:'kilometers'});
  const [lon,lat] = pt.geometry.coordinates;
  L.popup().setLatLng([lat,lon])
           .setContent(`<b>${rod}</b><br>KM ${km.toFixed(3)}`)
           .openOn(mapa);
  mapa.setView([lat,lon],15);
}

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

function addPonto(d){
  let {Rodovia,KM,Obs,Cor,Raio,LAT,LON} = d;
  const cor  = Cor||'#1976d2';
  const raio = parseFloat(String(Raio).replace(',','.'))||6;
  // separa KM
  const kmVal = parseFloat(String(KM).replace(',','.'));
  // se não tiver LAT/LON, calcula
  let lat = LAT, lon = LON;
  if(lat==null||lon==null){
    const meta = metaRod[Rodovia];
    if(!meta||isNaN(kmVal)||kmVal<meta.kmIni||kmVal>meta.kmFim) return;
    const line = rodLayers[Rodovia].toGeoJSON().features
                   .find(f=>f.geometry.type==='LineString');
    const pt   = turf.along(line, kmVal-meta.kmIni, {units:'kilometers'});
    [lon,lat] = pt.geometry.coordinates;
  }
  const m = L.circleMarker([lat,lon],{
    radius:raio,color:cor,weight:2,fillColor:cor,fillOpacity:1
  }).bindPopup(`<b>${Rodovia}</b> Km ${KM}<br>${Obs||''}`)
    .addTo(pontosLayer);

  m.options.meta = {Rodovia,KM,Obs,Cor,Raio,LAT:lat,LON:lon};
}

function carregarFirestore(){
  col.get().then(snap=>{
    snap.forEach(d=>addPonto(d.data()));
    zoomGlobal();
  }).catch(e=>{
    console.warn('Firestore off-line:',e.message);
  });
}

async function salvarFirestore(){
  if(!online){ alert('Firestore off-line ou não configurado.'); return; }
  const pts = Object.values(pontosLayer._layers);
  if(!pts.length){ alert('Nenhum ponto para salvar.'); return; }
  try{
    // apaga antigos
    const snap = await col.get();
    const bd   = db.batch();
    snap.forEach(d=>bd.delete(d.ref));
    await bd.commit();
    // grava novos
    const ba = db.batch();
    pts.forEach((m,i)=>ba.set(col.doc(String(i)),m.options.meta));
    await ba.commit();
    alert('✅ Dados salvos com sucesso!');
  }catch(e){
    console.error(e);
    alert('Falha ao salvar. Confira domínio e regras Firestore.');
  }
}

function kmlToGeoJSON(txt){
  const dom = new DOMParser().parseFromString(txt,'text/xml');
  const feats = [];
  [...dom.getElementsByTagName('Placemark')].forEach(pm=>{
    const line = pm.getElementsByTagName('LineString')[0];
    if(line){
      const coords = line.getElementsByTagName('coordinates')[0].textContent.trim()
                       .split(/\s+/).map(s=>s.split(',').map(Number).slice(0,2));
      if(coords.length>1) feats.push({
        type:'Feature',
        geometry:{type:'LineString',coordinates:coords}
      });
    }
  });
  return {type:'FeatureCollection',features:feats};
}
