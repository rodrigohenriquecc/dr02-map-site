/* global L, XLSX, shp */

/* ---------- CONFIG ---------- */
const LIMITE_METROS = 2000;

/* ---------- VARS ------------ */
let mapa, layerControl;
const rcOverlays   = {};
const rodOverlays  = {};
const rodoviaDatas = {};
let   camadaRecorte = null;

/* ---------- START ----------- */
document.addEventListener('DOMContentLoaded', async () => {
  mapa = L.map('map').setView([-23.8,-48.5],8)
          .addLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
            maxZoom:19, attribution:'&copy; OpenStreetMap'
          }));

  await carregarRCs();
  await carregarRodovias();

  const isMobile = window.innerWidth <= 600;
  layerControl   = L.control.layers(
      null, {...rodOverlays, ...rcOverlays},
      {position:'topright', collapsed:isMobile}
  ).addTo(mapa);

  aplicarMascaraRC();
  criarPainelRodovia();

  const all = L.featureGroup(Object.values({...rcOverlays, ...rodOverlays}));
  if (all.getLayers().length) mapa.fitBounds(all.getBounds());
});

/* ---------- RCs ------------- */
async function carregarRCs(){
  const files=[
    {n:'RC 2.1',f:'data/RC_2.1.zip'},
    {n:'RC 2.2',f:'data/RC_2.2.zip'},
    {n:'RC 2.4',f:'data/RC_2.4.zip'},
    {n:'RC 2.5',f:'data/RC_2.5.zip'},
    {n:'RC 2.6 + 2.8',f:'data/RC_2.6_2.8.zip'},
    {n:'RC 2.7',f:'data/RC_2.7.zip'}
  ];
  for(const {n,f} of files){
    try{
      const g = await shp(f);
      const c = corAleatoria();
      rcOverlays[n] = L.geoJSON(g,{style:{color:c,weight:1,fillColor:c,fillOpacity:.25}})
                        .bindPopup(`<b>${n}</b>`).addTo(mapa);
    }catch(e){console.error('Erro RC',f,e);}
  }
}

/* ---------- Rodovias -------- */
async function carregarRodovias(){
  const buf=await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
  const wb = XLSX.read(buf,{type:'array'});
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,blankrows:false});
  if(!raw.length) return;

  const H=raw[0].map(s=>String(s).trim().toUpperCase()), idx=t=>H.indexOf(t);
  let rc=idx('RC'), sp=idx('SP'), km=idx('KM'), lat=idx('LAT'), lon=idx('LON');
  const latlon=idx('LAT,LON');
  if((lat===-1||lon===-1)&&latlon!==-1){
    H.splice(latlon,1,'LAT','LON');
    for(let i=1;i<raw.length;i++){
      const [la,lo]=String(raw[i][latlon]).split(/[,; ]+/);
      raw[i].splice(latlon,1,parseFloat(la),parseFloat(lo));
    }
    lat=latlon; lon=latlon+1;
  }
  if([rc,sp,km,lat,lon].includes(-1)){alert('Cabeçalhos ausentes');return;}

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
    L.circleMarker([i.lat,i.lon],{radius:6,color:'#090',fillColor:'#0f0',fillOpacity:.9})
      .bindTooltip(`Início Km ${i.km}`,{direction:'top'}).addTo(grp);
    L.circleMarker([f.lat,f.lon],{radius:6,color:'#900',fillColor:'#f00',fillOpacity:.9})
      .bindTooltip(`Final Km ${f.km}`,{direction:'top'}).addTo(grp);

    grp.addTo(mapa);
    rodOverlays[rot]=grp;
  });
}

/* ---------- Máscara área RC ---- */
function aplicarMascaraRC(){
  const g=L.featureGroup(Object.values(rcOverlays));
  if(!g.getLayers().length) return;
  const b=g.getBounds(), [[S,W],[N,E]]=[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]];
  const mask=L.geoJSON({
    type:'Feature',
    geometry:{type:'Polygon',coordinates:[
      [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]],
      [[W,S],[W,N],[E,N],[E,S],[W,S]]
    ]}
  },{stroke:false,fillColor:'#000',fillOpacity:.4,interactive:false}).addTo(mapa);
  layerControl.addOverlay(mask,'⛶ Área RC');
}

/* ---------- Cartão (≡) -------- */
function criarPainelRodovia(){
  const btn=L.DomUtil.create('button','toggle-btn',document.body); btn.textContent='≡';
  const card=L.DomUtil.create('div','rodovia-card',document.body);
  const opts=Object.keys(rodoviaDatas).sort().map(r=>`<option>${r}</option>`).join('');
  card.innerHTML=`
    <label>Rodovia:</label><select id="selRod"><option value="">(todas)</option>${opts}</select>
    <label>Km inicial:</label><input id="kmIni" type="number" placeholder="vazio = 0">
    <label>Km final:</label><input id="kmFim" type="number" placeholder="∞">`;
  L.DomEvent.disableClickPropagation(card);
  let open=true; btn.onclick=()=>{open=!open;card.style.display=open?'block':'none';};
  ['change','input','input'].forEach((ev,i)=>
    document.getElementById(['selRod','kmIni','kmFim'][i]).addEventListener(ev,aplicarFiltroKm));
}

/* ---------- Filtro Km -------- */
function aplicarFiltroKm(){
  const rod=document.getElementById('selRod').value;
  const ki=parseFloat(document.getElementById('kmIni').value);
  const kf=parseFloat(document.getElementById('kmFim').value);
  if(camadaRecorte){mapa.removeLayer(camadaRecorte);camadaRecorte=null;}
  if(rod && (!isNaN(ki)||!isNaN(kf))){
    const pts=rodoviaDatas[rod].filter(p=>(isNaN(ki)||p.km>=ki)&&(isNaN(kf)||p.km<=kf));
    if(pts.length){
      camadaRecorte=L.polyline(pts.sort((a,b)=>a.km-b.km).map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}).addTo(mapa);
      mapa.fitBounds(camadaRecorte.getBounds(),{maxZoom:14});
    }
  }
}

/* ---------- Util ------------- */
function distanciaMetros(lat1,lon1,lat2,lon2){
  const R=6371000,d=Math.PI/180;
  const p=(lat2-lat1)*d,q=(lon2-lon1)*d;
  const h=Math.sin(p/2)**2+Math.cos(lat1*d)*Math.cos(lat2*d)*Math.sin(q/2)**2;
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
const corAleatoria=()=>`hsl(${Math.random()*360},70%,60%)`;
