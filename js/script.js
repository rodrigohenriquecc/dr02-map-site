/* global L, JSZip, shp, turf, Papa, firebase */

/* ---------- 0. Firebase (compat) ---------- */
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

/* ---------- 1. Listas RC / KMZ ---------- */
const RC_ZIPS = [/* … */];
const KMZ_FILES = [/* … */];

/* ---------- 2. Meta, mapa, UI (mesmo código) ---------- */
const metaRod={}, rcLayers={}, rodLayers={}, pontosLayer=L.layerGroup().addTo(mapa);
// ... todo o código de mapa, painéis, CSV e localização KM permanece ...

/* ---------- 3. Carregar pontos existentes ---------- */
col.get().then(snap=>{
  snap.forEach(doc=>addPontoLinha(doc.data()));
  if(Object.keys(pontosLayer._layers).length)
    mapa.fitBounds(pontosLayer.getBounds());
});

/* ---------- 4. Salvar pontos ---------- */
document.getElementById('btnSave').onclick = async ()=>{
  const pts = Object.values(pontosLayer._layers);
  if(!pts.length){ alert('Nenhum ponto para salvar'); return; }

  /* apaga coleção e regrava */
  const snap = await col.get();
  const batchDel = db.batch();
  snap.forEach(d=>batchDel.delete(d.ref));
  await batchDel.commit();

  const batchAdd = db.batch();
  pts.forEach((m,i)=>{
    const meta = m.options.meta;              // guardado na criação
    batchAdd.set(col.doc(String(i)), meta);
  });
  await batchAdd.commit();
  alert('Pontos salvos!');
};

/* ---------- 5. CSV -> pontos ---------- */
function addPontoLinha(l){
  const {Rodovia,KM,Obs,Cor,Raio} = l;
  const lyr = rodLayers[Rodovia];
  if(!lyr) return;

  const kmVal=parseFloat(KM), meta=metaRod[Rodovia];
  if(!meta||isNaN(kmVal)||kmVal<meta.kmIni||kmVal>meta.kmFim) return;

  const line = lyr.toGeoJSON().features.find(f=>f.geometry.type==='LineString');
  const pt   = turf.along(line, kmVal-meta.kmIni, {units:'kilometers'});
  const [lon,lat]=pt.geometry.coordinates;

  const marker = L.circleMarker([lat,lon],{
    radius: parseFloat(Raio)||6,
    color:  Cor||'#1976d2', weight:2,
    fillColor: Cor||'#1976d2', fillOpacity:1
  }).bindPopup(`<b>${Rodovia}</b> Km ${KM}<br>${Obs||''}`)
    .addTo(pontosLayer);

  /* guarda meta para salvar depois */
  marker.options.meta = {Rodovia,KM,Obs,Cor,Raio};
}
/* resto do código (processCSV, drag-and-drop, kmlToGeoJSON, etc.) permanece igual */
