/* global L, XLSX, shp */

/* ---------- CONFIG --------- */
const LIMITE_METROS = 2000;

/* ---------- VARS ----------- */
let mapa, layerControl;
const rcOverlays   = {};
const rcLabels     = {};
const rodOverlays  = {};
const rodLabels    = {};
const rodoviaDatas = {};
let   camadaRecorte=null;

/* ---------- START ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  mapa=L.map('map').setView([-23.8,-48.5],8)
       .addLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
         maxZoom:19, attribution:'&copy; OpenStreetMap'
       }));

  await carregarRCs();
  await carregarRodovias();

  const mobile=window.innerWidth<=600;
  layerControl=L.control.layers(null, {}, {position:'topright',collapsed:mobile})
                 .addTo(mapa);

  aplicarMascaraRC();
  criarPainelKm();

  mapa.fitBounds(L.featureGroup(Object.values({...rcOverlays,...rodOverlays}))
                 .getBounds());
});

/* ---------- RCs (contorno + label) ---- */
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
      const geo=await shp(f);
      rcOverlays[n]=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                      .bindPopup(`<b>${n}</b>`).addTo(mapa);
      const center=rcOverlays[n].getBounds().getCenter();
      rcLabels[n]=L.marker(center,{
        icon:L.divIcon({className:'rc-label',html:n,iconSize:null}),
        interactive:false
      }).addTo(mapa);
    }catch(e){console.error('Erro RC',f,e);}
  }
}

/* ---------- Rodovias + rótulo -------- */
async function carregarRodovias(){
  const buf=await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
  const wb = XLSX.read(buf,{type:'array'});
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,blankrows:false});
  if(!raw.length) return;

  const H=raw[0].map(s=>String(s).trim().toUpperCase()), ix=t=>H.indexOf(t);
  let rc=ix('RC'),sp=ix('SP'),km=ix('KM'),la=ix('LAT'),lo=ix('LON');
  const latlon=ix('LAT,LON');
  if((la===-1||lo===-1)&&latlon!==-1){
    H.splice(latlon,1,'LAT','LON');
    for(let r=1;r<raw.length;r++){
      const [y,x]=String(raw[r][latlon]).split(/[,; ]+/);
      raw[r].splice(latlon,1,parseFloat(y),parseFloat(x));
    }
    la=latlon;lo=latlon+1;
  }
  if([rc,sp,km,la,lo].includes(-1)){alert('Cabeçalhos ausentes');return;}

  raw.slice(1).forEach(r=>{
    const rot=`${r[rc]} | ${r[sp]}`;
    (rodoviaDatas[rot]??=[]).push({km:+r[km],lat:+r[la],lon:+r[lo]});
  });

  Object.entries(rodoviaDatas).forEach(([rot,pts])=>{
    pts.sort((a,b)=>a.km-b.km);

    const seg=[[]];
    for(let i=0;i<pts.length;i++){
      if(i){
        const a=pts[i-1],b=pts[i];
        if(dist(a.lat,a.lon,b.lat,b.lon)>LIMITE_METROS) seg.push([]);
      }
      seg.at(-1).push([pts[i].lat,pts[i].lon]);
    }

    const grp=L.featureGroup();
    seg.forEach(c=>L.polyline(c,{color:'#555',weight:3,opacity:.9})
                 .bindPopup(`<b>${rot}</b>`).addTo(grp));
    grp.addTo(mapa); rodOverlays[rot]=grp;
    layerControl.addOverlay(grp,rot);

    const mid=pts[Math.floor(pts.length/2)];
    rodLabels[rot]=L.marker([mid.lat,mid.lon],{
      icon:L.divIcon({className:'rod-label',html:rot,iconSize:null}),
      interactive:false
    }).addTo(mapa);
    layerControl.addOverlay(rodLabels[rot],rot+' (rótulo)');
  });
}

/* ---------- Máscara área RC ----------- */
function aplicarMascaraRC(){
  const g=L.featureGroup(Object.values(rcOverlays));
  if(!g.getLayers().length) return;
  const b=g.getBounds(),[[S,W],[N,E]]=[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]];
  const mask=L.geoJSON({
    type:'Feature',
    geometry:{type:'Polygon',coordinates:[
      [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]],
      [[W,S],[W,N],[E,N],[E,S],[W,S]]
    ]}
  },{stroke:false,fillColor:'#000',fillOpacity:.4,interactive:false}).addTo(mapa);
  layerControl.addOverlay(mask,'⛶ Área RC');
}

/* ---------- Cartão filtro Km --------- */
function criarPainelKm(){
  const btn=L.DomUtil.create('button','toggle-btn',document.body);btn.textContent='≡';
  const card=L.DomUtil.create('div','rodovia-card',document.body);
  const opts=Object.keys(rodoviaDatas).sort().map(r=>`<option>${r}</option>`).join('');
  card.innerHTML=`
    <label>Rodovia:</label><select id="selRod"><option value="">(todas)</option>${opts}</select>
    <label>Km inicial:</label><input id="kmIni" type="number" placeholder="vazio = 0">
    <label>Km final:</label><input id="kmFim" type="number" placeholder="∞">`;
  L.DomEvent.disableClickPropagation(card);
  let open=true;btn.onclick=()=>{open=!open;card.style.display=open?'block':'none';};
  ['change','input','input'].forEach((ev,i)=>
    document.getElementById(['selRod','kmIni','kmFim'][i]).addEventListener(ev,filtrarKm));
}

/* ---------- Filtro Km -------------- */
function filtrarKm(){
  const rod=document.getElementById('selRod').value;
  const ki=parseFloat(document.getElementById('kmIni').value);
  const kf=parseFloat(document.getElementById('kmFim').value);
  if(camadaRecorte){mapa.removeLayer(camadaRecorte);camadaRecorte=null;}
  if(rod&&(!isNaN(ki)||!isNaN(kf))){
    const pts=rodoviaDatas[rod].filter(p=>(isNaN(ki)||p.km>=ki)&&(isNaN(kf)||p.km<=kf));
    if(pts.length){
      camadaRecorte=L.polyline(pts.sort((a,b)=>a.km-b.km).map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}).addTo(mapa);
      mapa.fitBounds(camadaRecorte.getBounds(),{maxZoom:14});
    }
  }
}

/* ---------- Util ------------------- */
function dist(a,b,c,d){
  const R=6371000,q=Math.PI/180,p=(c-a)*q,u=(d-b)*q,
        h=Math.sin(p/2)**2+Math.cos(a*q)*Math.cos(c*q)*Math.sin(u/2)**2;
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
