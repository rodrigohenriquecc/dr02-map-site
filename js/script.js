/* global L, JSZip, shp, turf, Papa, firebase */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ───── 0. Firebase config  ───── */
/* preencha com as chaves do seu projeto */
const firebaseConfig = {
  apiKey: "AIzaSyC3cndupgSd9EayJP6edzQcrYBgZMG8F2s",
  authDomain: "consorciolh-8b5bc.firebaseapp.com",
  projectId: "consorciolh-8b5bc",
  storageBucket: "consorciolh-8b5bc.firebasestorage.app",
  messagingSenderId: "128910789036",
  appId: "1:128910789036:web:d0c0b945f0bcd8ab2b1209"
};
const app   = initializeApp(firebaseConfig);
const db    = getFirestore(app);
const colPt = collection(db, "pontos");

/* ───── 1. listas RC / KMZ (mesmo conteúdo) ───── */
const RC_ZIPS = [/* … */];
const KMZ_FILES = [/* … */];

/* ───── 2. meta-dados, mapa, UI  (idênticos ao último script) ───── */
const metaRod={}, rcLayers={}, rodLayers={}, pontosLayer=L.layerGroup();
 /* ... todo o código que já existia ... */

/* ───── 3. CSV p/ pontos  (funções addPontoLinha & processCSV mantidas) ───── */

/* ───── 4. ↘ carregar pontos salvos no Firestore ao iniciar ───── */
getDocs(colPt).then(q=>{
  q.forEach(d=>{
    addPontoLinha(d.data());             // estrutura já bate com função
  });
  if(Object.keys(pontosLayer._layers).length)
    mapa.fitBounds(pontosLayer.getBounds());
});

/* ───── 5. salvar pontos atuais no Firestore  ───── */
document.getElementById('btnSave').onclick = async ()=>{
  /* sobrescreve coleção inteira (até 500 docs gratuitos) */
  const pts = Object.values(pontosLayer._layers);
  if(!pts.length){ alert('Nenhum ponto para salvar'); return; }

  /* remove tudo e grava de novo */
  const snap = await getDocs(colPt);
  await Promise.all(snap.docs.map(d=>firebase.firestore().deleteDoc(d.ref)));

  await Promise.all(pts.map((m,i)=>{
    const d=m.getLatLng();
    const data={
      Rodovia : m.options.title.split('|')[0],
      KM      : m.options.title.split('|')[1],
      Obs     : m.getPopup().getContent().split('<br>')[1],
      Cor     : m.options.color,
      Raio    : m.options.radius,
      LAT     : d.lat,
      LON     : d.lng
    };
    return setDoc(doc(colPt,String(i)), data);
  }));
  alert('Pontos salvos!');
};
