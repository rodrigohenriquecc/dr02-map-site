/* global L, XLSX, shp */

/* -------------------------------------------------------------- */
/* CONFIG                                                         */
/* -------------------------------------------------------------- */
const LIMITE_METROS = 2000;        // novo segmento se salto > 2 km

/* -------------------------------------------------------------- */
/* VARIÁVEIS GLOBAIS                                              */
/* -------------------------------------------------------------- */
let mapa, layerControl;
const rcOverlays     = {};         // RC   → camada
const rodOverlays    = {};         // rod  → camada
const rodoviaDatas   = {};         // { rotulo: [ {km,lat,lon} … ] }
let   camadaRecorte  = null;       // polilinha vermelha (filtro Km)

/* -------------------------------------------------------------- */
/* INÍCIO                                                          */
/* -------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  mapa = criarMapaBase();

  await carregarRCs();             // preenche rcOverlays
  await carregarRodovias();        // preenche rodOverlays

  /* painel principal de camadas */
  layerControl = L.control.layers(
      null,
      { ...rodOverlays, ...rcOverlays },   // todas como overlay
      { position:'topright', collapsed:false }
  ).addTo(mapa);

  aplicarMascaraRC();              // destaca só área dos shapefiles
  criarPainelRodovia();            // cartão flutuante (≡)

  const todos = L.featureGroup(Object.values({...rcOverlays, ...rodOverlays}));
  if (todos.getLayers().length) mapa.fitBounds(todos.getBounds());
});

/* -------------------------------------------------------------- */
/* MAPA BASE                                                      */
/* -------------------------------------------------------------- */
function criarMapaBase(){
  return L.map('map').setView([-23.8,-48.5],8)
    .addLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19, attribution:'&copy; OpenStreetMap'
    }));
}

/* -------------------------------------------------------------- */
/* 1. REGIÕES (RC)                                                */
/* -------------------------------------------------------------- */
async function carregarRCs(){
  const files=[
    {nome:'RC 2.1',arquivo:'data/RC_2.1.zip'},
    {nome:'RC 2.2',arquivo:'data/RC_2.2.zip'},
    {nome:'RC 2.4',arquivo:'data/RC_2.4.zip'},
    {nome:'RC 2.5',arquivo:'data/RC_2.5.zip'},
    {nome:'RC 2.6 + 2.8',arquivo:'data/RC_2.6_2.8.zip'},
    {nome:'RC 2.7',arquivo:'data/RC_2.7.zip'}
  ];
  for(const {nome,arquivo} of files){
    try{
      const geo = await shp(arquivo);
      const cor = corAleatoria();
      rcOverlays[nome] = L.geoJSON(geo,{
        style:{color:cor,weight:1,fillColor:cor,fillOpacity:.25}
      }).bindPopup(`<b>${nome}</b>`).addTo(mapa);      // começa ligado
    }catch(e){console.error('Erro RC',arquivo,e)}
  }
}

/* -------------------------------------------------------------- */
/* 2. PLANILHA → RODOVIAS                                         */
/* -------------------------------------------------------------- */
async function carregarRodovias(){
  const buf = await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
  const wb  = XLSX.read(buf,{type:'array'});
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet,{header:1,blankrows:false});
  if(!raw.length) return;

  const H=raw[0].map(s=>String(s).trim().toUpperCase()), ix=t=>H.indexOf(t);
  let rc=ix('RC'), sp=ix('SP'), km=ix('KM'), lat=ix('LAT'), lon=ix('LON');
  const latlon=ix('LAT,LON');
  if((lat===-1||lon===-1)&&latlon!==-1){
    H.splice(latlon,1,'LAT','LON');
    for(let i=1;i<raw.length;i++){
      const [la,lo]=String(raw[i][latlon]).split(/[,; ]+/);
      raw[i].splice(latlon,1,parseFloat(la),parseFloat(lo));
    }
    lat=latlon; lon=latlon+1;
  }
  if([rc,sp,km,lat,lon].includes(-1)){
    alert('Cabeçalhos RC, SP, KM, LAT, LON não encontrados.');return;
  }

  raw.slice(1).forEach(r=>{
    const rot=`${r[rc]} | ${r[sp]}`;
    (rodoviaDatas[rot]??=[]).push({km:+r[km],lat:+r[lat],lon:+r[lon]});
  });

  Object.entries(rodoviaDatas).forEach(([rot,pts])=>{
    pts.sort((a,b)=>a.km-b.km);

    const seg=[[]];
    for(let i=0;i<pts.length;i++){
      if(i){
        const a=pts[i-1], b=pts[i];
        if(distanciaMetros(a.lat,a.lon,b.lat,b.lon) > LIMITE_METROS) seg.push([]);
      }
      seg.at(-1).push([pts[i].lat,pts[i].lon]);
    }

    const grp=L.featureGroup();
    seg.forEach(c=>L.polyline(c,{color:'#555',weight:3,opacity:.9})
                 .bindPopup(`<b>${rot}</b>`).addTo(grp));
    const i=pts[0], f=pts.at(-1);
    L.circleMarker([i.lat,i.lon],{radius:6,color:'#090',fillColor:'#0f0',
      fillOpacity:.9}).bindTooltip(`Início Km ${i.km}`,{direction:'top'}).addTo(grp);
    L.circleMarker([f.lat,f.lon],{radius:6,color:'#900',fillColor:'#f00',
      fillOpacity:.9}).bindTooltip(`Final Km ${f.km}`,{direction:'top'}).addTo(grp);

    grp.addTo(mapa);
    rodOverlays[rot]=grp;
  });
}

/* -------------------------------------------------------------- */
/* 3. MÁSCARA – DESTACAR APENAS ÁREA DOS SHAPEFILES               */
/* -------------------------------------------------------------- */
function aplicarMascaraRC(){
  const grupo = L.featureGroup(Object.values(rcOverlays));
  if(!grupo.getLayers().length) return;

  const b = grupo.getBounds();
  const [[S,W],[N,E]] = [[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]];

  /* polígonos: mundo horário + furo anti-horário */
  const maskFeature = {
    type:'Feature',
    geometry:{type:'Polygon',coordinates:[
      [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]],   // mundo
      [[W,S],[W,N],[E,N],[E,S],[W,S]]                         // furo (área RC)
    ]}
  };
  const mask = L.geoJSON(maskFeature,{
    stroke:false, fillColor:'#000', fillOpacity:.4, interactive:false
  }).addTo(mapa);

  layerControl.addOverlay(mask,'⛶ Área RC');   // pode ligar/desligar
}

/* -------------------------------------------------------------- */
/* 4. CARTÃO  (filtro Km)                                         */
/* -------------------------------------------------------------- */
function criarPainelRodovia(){
  const btn=L.DomUtil.create('button','toggle-btn',document.body);
  btn.textContent='≡';

  const card=L.DomUtil.create('div','rodovia-card',document.body);
  card.style.cssText+=';position:absolute;left:10px;bottom:50px;';

  const opts=Object.keys(rodoviaDatas).sort()
               .map(r=>`<option>${r}</option>`).join('');
  card.innerHTML=`
    <label>Rodovia:</label>
    <select id="selRod"><option value="">(todas)</option>${opts}</select>
    <label>Km inicial:</label>
    <input id="kmIni" type="number" placeholder="vazio = 0">
    <label>Km final:</label>
    <input id="kmFim" type="number" placeholder="∞">
  `;
  L.DomEvent.disableClickPropagation(card);

  let open=true; btn.onclick=()=>{open=!open;card.style.display=open?'block':'none';};

  document.getElementById('selRod').addEventListener('change', aplicarFiltroKm);
  document.getElementById('kmIni').addEventListener('input', aplicarFiltroKm);
  document.getElementById('kmFim').addEventListener('input', aplicarFiltroKm);
}

/* -------------------------------------------------------------- */
/* 5. FILTRO POR KM                                               */
/* -------------------------------------------------------------- */
function aplicarFiltroKm(){
  const rod=document.getElementById('selRod').value;
  const ki=parseFloat(document.getElementById('kmIni').value);
  const kf=parseFloat(document.getElementById('kmFim').value);

  if(camadaRecorte){mapa.removeLayer(camadaRecorte);camadaRecorte=null;}

  if(rod && (!isNaN(ki)||!isNaN(kf))){
    const pts=rodoviaDatas[rod].filter(p=>
      (isNaN(ki)||p.km>=ki)&&(isNaN(kf)||p.km<=kf));
    if(pts.length){
      camadaRecorte=L.polyline(
        pts.sort((a,b)=>a.km-b.km).map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}).addTo(mapa);
      mapa.fitBounds(camadaRecorte.getBounds(),{maxZoom:14});
    }
  }
}

/* -------------------------------------------------------------- */
/* UTILITÁRIAS                                                    */
/* -------------------------------------------------------------- */
function distanciaMetros(lat1,lon1,lat2,lon2){
  const R=6371000,d=Math.PI/180;
  const dLat=(lat2-lat1)*d, dLon=(lon2-lon1)*d;
  const a=Math.sin(dLat/2)**2+
          Math.cos(lat1*d)*Math.cos(lat2*d)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const corAleatoria=()=>`hsl(${Math.random()*360},70%,60%)`;
