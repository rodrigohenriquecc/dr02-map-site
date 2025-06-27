/* global L, XLSX, shp */

/* ---------- CONFIG ---------- */
const LIMITE_METROS = 2000;

/* ---------- VARS ------------ */
let mapa, layerControl;
const rcOverlays  = {}, rcLabels  = {};
const rodOverlays = {}, rodLabels = {};
const rodoviaDados = {};
let   linhaRecorte = null;

/* ---------- START ----------- */
document.addEventListener('DOMContentLoaded', async () => {
  mapa = L.map('map')
           .setView([-23.8,-48.5],8)
           .addLayer(L.tileLayer(
             'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
             { maxZoom:19, attribution:'&copy; OpenStreetMap' }));

  layerControl = L.control.layers(null, {},
    { position:'topright', collapsed:window.innerWidth<=600 }).addTo(mapa);

  await carregarRCs();
  await carregarRodovias();

  aplicarMascaraRC();
  criarPainelKm();

  mapa.fitBounds(
    L.featureGroup(Object.values({...rcOverlays,...rodOverlays})).getBounds());
});

/* ---------- RCs -------------------------------------------------- */
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
      const centro=rcOverlays[n].getBounds().getCenter();
      rcLabels[n]=L.marker(centro,{
        icon:L.divIcon({className:'rc-label',html:n,iconSize:null}),
        interactive:false
      }).addTo(mapa);
    }catch(e){console.error('RC',f,e);}
  }
}

/* ---------- RODOVIAS -------------------------------------------- */
async function carregarRodovias(){
  const buf=await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
  const wb = XLSX.read(buf,{type:'array'});
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],
                                     {header:1,blankrows:false});
  if(!raw.length) return;

  const H=raw[0].map(s=>String(s).trim().toUpperCase()), idx=h=>H.indexOf(h);
  let rc=idx('RC'), sp=idx('SP'), km=idx('KM'), la=idx('LAT'), lo=idx('LON');
  const latlon=idx('LAT,LON');
  if((la===-1||lo===-1)&&latlon!==-1){
    H.splice(latlon,1,'LAT','LON');
    for(let r=1;r<raw.length;r++){
      const [y,x]=String(raw[r][latlon]).split(/[,; ]+/);
      raw[r].splice(latlon,1,+y,+x);
    }
    la=latlon; lo=latlon+1;
  }
  if([rc,sp,km,la,lo].includes(-1)){alert('Cabeçalhos ausentes');return;}

  /* ---- agrupa por rodovia (chave completa) ---- */
  raw.slice(1).forEach(r=>{
    const rotCompleto=`${r[rc]} | ${r[sp]}`.trim();   // painel / dados
    (rodoviaDados[rotCompleto]??=[]).push({
      km:+r[km], lat:+r[la], lon:+r[lo],
      rodSigla:String(r[sp]).trim()                   // só “SP 250”
    });
  });

  /* ---- desenha cada rodovia ---- */
  for(const [rotCompleto,pts] of Object.entries(rodoviaDados)){
    pts.sort((a,b)=>a.km-b.km);

    const seg=[[]];
    for(let i=0;i<pts.length;i++){
      if(i){
        const a=pts[i-1], b=pts[i];
        if(dist(a.lat,a.lon,b.lat,b.lon)>LIMITE_METROS) seg.push([]);
      }
      seg.at(-1).push([pts[i].lat,pts[i].lon]);
    }

    const grp=L.featureGroup();
    seg.forEach(c=>L.polyline(c,{color:'#555',weight:3,opacity:.9})
                 .bindPopup(`<b>${rotCompleto}</b>`).addTo(grp));
    grp.addTo(mapa); rodOverlays[rotCompleto]=grp;
    layerControl.addOverlay(grp,rotCompleto);      // aparece no filtro

    /* rótulo com apenas a sigla rodoviária */
    const mid = pts[Math.floor(pts.length/2)];
    const sig = pts[0].rodSigla;                   // mesmo para toda a rodovia
    rodLabels[rotCompleto]=L.marker([mid.lat,mid.lon],{
      icon:L.divIcon({className:'rod-label',html:sig,iconSize:null}),
      interactive:false
    }).addTo(mapa);                                // não filtrável
  }
}

/* ---------- Máscara fora da área RC ----------------------- */
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

/* ---------- Cartão filtro Km ------------------------------ */
function criarPainelKm(){
  const btn=L.DomUtil.create('button','toggle-btn',document.body);btn.textContent='≡';
  const card=L.DomUtil.create('div','rodovia-card',document.body);
  const opts=Object.keys(rodoviaDados).sort().map(r=>`<option>${r}</option>`).join('');
  card.innerHTML=`
    <label>Rodovia:</label><select id="selRod"><option value="">(todas)</option>${opts}</select>
    <label>Km inicial:</label><input id="kmIni" type="number" placeholder="vazio = 0">
    <label>Km final:</label><input id="kmFim" type="number" placeholder="∞">`;
  L.DomEvent.disableClickPropagation(card);

  let open=true;
  btn.onclick=()=>{open=!open;card.style.display=open?'block':'none';};

  ['change','input','input'].forEach((ev,j)=>
    document.getElementById(['selRod','kmIni','kmFim'][j])
            .addEventListener(ev,filtrarKm));
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
