/* global L, XLSX, shp */

const LIMITE_METROS = 2000;
let mapa, layerControl;
const rcOverlays={}, rcLabels={}, rodOverlays={}, rodLabels={}, rodoviaDados={};
let linhaRecorte=null;

document.addEventListener('DOMContentLoaded', async()=>{
  mapa=L.map('map')
        .addLayer(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {maxZoom:19,attribution:'&copy; OpenStreetMap'}));

  layerControl=L.control.layers(null,{},
    {position:'topright',collapsed:window.innerWidth<=600}).addTo(mapa);

  await carregarRCs();
  await carregarRodovias();
  aplicarMascaraRC();
  criarPainelKm();
});

/* ---------- RCs (contorno + rótulo) ----------------------- */
async function carregarRCs(){
  const arq=[{n:'RC 2.1',f:'data/RC_2.1.zip'},{n:'RC 2.2',f:'data/RC_2.2.zip'},
             {n:'RC 2.4',f:'data/RC_2.4.zip'},{n:'RC 2.5',f:'data/RC_2.5.zip'},
             {n:'RC 2.6 + 2.8',f:'data/RC_2.6_2.8.zip'},{n:'RC 2.7',f:'data/RC_2.7.zip'}];
  for(const {n,f} of arq){
    try{
      const geo=await shp(f);
      rcOverlays[n]=L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                      .bindPopup(`<b>${n}</b>`).addTo(mapa);
      const c=rcOverlays[n].getBounds().getCenter();
      rcLabels[n]=L.marker(c,{
        icon:L.divIcon({className:'rc-label',html:n,iconSize:null}),interactive:false
      }).addTo(mapa);
    }catch(e){console.error('RC',f,e);}
  }
  if(Object.keys(rcOverlays).length){
    mapa.fitBounds(L.featureGroup(Object.values(rcOverlays)).getBounds());
  }
}

/* ---------- Rodovias + rótulo ----------------------------- */
async function carregarRodovias(){
  const buf=await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
  const wb = XLSX.read(buf,{type:'array'});
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],
                                     {header:1,blankrows:false});
  if(!raw.length) return;

  const H=raw[0].map(s=>String(s).trim().toUpperCase()), i=h=>H.indexOf(h);
  let rc=i('RC'),
      sp=[i('SP'), i('RODOVIA'), i('ROD.')].find(x=>x!==-1), // <-- ajuste
      km=i('KM'), la=i('LAT'), lo=i('LON');
  const latlon=i('LAT,LON');
  if((la===-1||lo===-1)&&latlon!==-1){
    H.splice(latlon,1,'LAT','LON');
    for(let r=1;r<raw.length;r++){
      const [y,x]=String(raw[r][latlon]).split(/[,; ]+/);
      raw[r].splice(latlon,1,+y,+x);
    }
    la=latlon; lo=latlon+1;
  }
  if([sp,km,la,lo].includes(-1)){alert('Cabeçalhos SP/RODOVIA, KM, LAT, LON ausentes');return;}

  raw.slice(1).forEach(r=>{
    const chave=`${r[rc]||''} | ${r[sp]}`.trim();
    (rodoviaDados[chave]??=[]).push({
      km:+r[km],lat:+r[la],lon:+r[lo],sig:String(r[sp]).trim()});
  });

  for(const [rot,pts] of Object.entries(rodoviaDados)){
    pts.sort((a,b)=>a.km-b.km);
    const seg=[[]];
    for(let j=0;j<pts.length;j++){
      if(j){
        const a=pts[j-1],b=pts[j];
        if(dist(a.lat,a.lon,b.lat,b.lon)>LIMITE_METROS) seg.push([]);
      }
      seg.at(-1).push([pts[j].lat,pts[j].lon]);
    }
    const grp=L.featureGroup();
    seg.forEach(c=>L.polyline(c,{color:'#555',weight:3,opacity:.9})
                 .bindPopup(`<b>${rot}</b>`).addTo(grp));
    grp.addTo(mapa); rodOverlays[rot]=grp; layerControl.addOverlay(grp,rot);

    const m=pts[Math.floor(pts.length/2)];
    rodLabels[rot]=L.marker([m.lat,m.lon],{
      icon:L.divIcon({className:'rod-label',html:pts[0].sig,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  }
}

/* ---------- Máscara RC ------------------------------------ */
function aplicarMascaraRC(){
  const g=L.featureGroup(Object.values(rcOverlays));
  if(!g.getLayers().length) return;
  const b=g.getBounds(),[[S,W],[N,E]]=[[b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]];
  layerControl.addOverlay(
    L.geoJSON({type:'Feature',geometry:{type:'Polygon',coordinates:[
      [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]],
      [[W,S],[W,N],[E,N],[E,S],[W,S]]]}},
      {stroke:false,fillColor:'#000',fillOpacity:.4,interactive:false}).addTo(mapa),
    '⛶ Área RC');
}

/* ---------- Painel Km ------------------------------------- */
function criarPainelKm(){
  const btn=L.DomUtil.create('button','toggle-btn',document.body);btn.textContent='≡';
  const card=L.DomUtil.create('div','rodovia-card',document.body);
  const opts=Object.keys(rodoviaDados).sort().map(r=>`<option>${r}</option>`).join('');
  card.innerHTML=`
    <label>Rodovia:</label><select id="selRod"><option value="">(todas)</option>${opts}</select>
    <label>Km inicial:</label><input id="kmIni" type="number" placeholder="vazio = 0">
    <label>Km final:</label><input id="kmFim" type="number" placeholder="∞">`;
  L.DomEvent.disableClickPropagation(card);
  let open=true;btn.onclick=()=>{open=!open;card.style.display=open?'block':'none';};
  ['change','input','input'].forEach((ev,j)=>
    document.getElementById(['selRod','kmIni','kmFim'][j]).addEventListener(ev,filtrarKm));
}

/* ---------- Filtro Km ------------------------------------- */
function filtrarKm(){
  const rod=document.getElementById('selRod').value;
  const ki=parseFloat(document.getElementById('kmIni').value);
  const kf=parseFloat(document.getElementById('kmFim').value);
  if(linhaRecorte){mapa.removeLayer(linhaRecorte);linhaRecorte=null;}
  if(rod&&(!isNaN(ki)||!isNaN(kf))){
    const pts=rodoviaDados[rod].filter(p=>(isNaN(ki)||p.km>=ki)&&(isNaN(kf)||p.km<=kf));
    if(pts.length){
      linhaRecorte=L.polyline(pts.sort((a,b)=>a.km-b.km).map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}).addTo(mapa);
      mapa.fitBounds(linhaRecorte.getBounds(),{maxZoom:14});
    }
  }
}

/* ---------- Util ------------------------------------------ */
function dist(a,b,c,d){
  const R=6371000,t=Math.PI/180,p=(c-a)*t,q=(d-b)*t,
        h=Math.sin(p/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(q/2)**2;
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
