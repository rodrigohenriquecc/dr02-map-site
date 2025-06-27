/* global L, JSZip, shp, turf */

/* ────────── ARQUIVOS ────────── */
const RC_ZIPS = [
  'data/RC_2.1.zip',
  'data/RC_2.2.zip',
  'data/RC_2.4.zip',
  'data/RC_2.5.zip',
  'data/RC_2.6_2.8.zip',
  'data/RC_2.7.zip'
];

const KMZ_FILES = [
  'data/RC2.2_SP127.kmz',
  'data/RC2.2_SP165.kmz',
  'data/RC2.2_SP181.kmz',
  'data/RC2.2_SP249.kmz',
  'data/RC2.2_SP250.kmz',
  'data/RC2.2_SPA294.250.kmz'
];

/* ────────── META-DADOS Km ────────── */
const metaRod = {};       // id → objeto com kmIni/kmFim/coords
fetch('data/rodovias_meta.json')
  .then(r => r.json())
  .then(arr => arr.forEach(m => metaRod[m.id] = m));

/* ────────── MAPA ────────── */
const mapa = L.map('map').setView([-23.8,-48.5],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);

const painel   = L.control.layers(null,null,{collapsed:false}).addTo(mapa);
const rcLayers = {};
const rodLayers= {};

/* utilidades */
const addLabel = (p,txt,cls)=>
  L.marker(p,{icon:L.divIcon({className:cls,html:txt,iconSize:null}),
              interactive:false}).addTo(mapa);

function zoomGlobal(){
  const all={...rcLayers,...rodLayers};
  if(!Object.keys(all).length) return;
  const b=L.featureGroup(Object.values(all)).getBounds();
  if(b.isValid()) mapa.fitBounds(b);
}

/* ────────── UI Localizar Km ────────── */
document.getElementById('btnKm').addEventListener('click', localizarKm);
function atualizarSelect(){
  const sel=document.getElementById('selRod');
  const vAnt = sel.value;
  sel.innerHTML='<option value="">(selecione)</option>'+
    Object.keys(rodLayers).sort().map(r=>`<option>${r}</option>`).join('');
  sel.value=vAnt;
  sel.dispatchEvent(new Event('change'));
}
document.getElementById('selRod').addEventListener('change', e=>{
  const m = metaRod[e.target.value];
  document.getElementById('infoKm').textContent =
    m ? `Km ${m.kmIni} – ${m.kmFim}` : '';
});

/* ────────── Carrega RC (shp.zip) ────────── */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo = await shp(zip);
    const nome= zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const lyr = L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                  .addTo(mapa).bindPopup(nome);
    rcLayers[nome]=lyr; painel.addOverlay(lyr,'🗺️ '+nome);
    addLabel(lyr.getBounds().getCenter(),nome,'rc-label');
  }catch(e){console.error('RC',zip,e);}
})).then(zoomGlobal);

/* ────────── Carrega cada KMZ ────────── */
KMZ_FILES.forEach(async file=>{
  try{
    const resp=await fetch(encodeURI(file));
    if(!resp.ok){console.error('404',file);return;}
    const buf =await resp.arrayBuffer();
    const zip =await JSZip.loadAsync(buf);
    const kml =Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kml){console.warn('KMZ sem KML',file);return;}

    const kmlText=await zip.file(kml).async('string');
    const geo = kmlToGeoJSON(kmlText);

    const title=file.split('/').pop().replace('.kmz','');
    const lyr  = L.geoJSON(geo,{style:{color:'#555',weight:3,opacity:.9}})
                   .addTo(mapa);
    rodLayers[title]=lyr;
    painel.addOverlay(lyr,'📄 '+title);
    atualizarSelect();

    /* rótulo SP ### */
    const sig = (/SP[A-Z]?\s*\d+/i).exec(title);
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

/* ────────── Localizar Km ────────── */
function localizarKm(){
  const rod   = document.getElementById('selRod').value;
  const kmVal = parseFloat(document.getElementById('kmAlvo').value);
  if(!rod || isNaN(kmVal)){ alert('Escolha rodovia e Km'); return; }

  const meta = metaRod[rod];
  if(!meta){ alert('Rodovia sem meta-dados'); return; }
  if(kmVal < meta.kmIni || kmVal > meta.kmFim){
    alert(`KM fora do intervalo!\nVálido: ${meta.kmIni} – ${meta.kmFim}`);
    return;
  }
  const kmRel = kmVal - meta.kmIni;

  const lyr   = rodLayers[rod];
  if(!lyr){ alert('Camada não carregada'); return; }
  const lines = lyr.toGeoJSON().features.filter(f=>f.geometry.type==='LineString');
  if(!lines.length){ alert('Linha não encontrada'); return; }

  /* percorre segmentos sequencialmente */
  let restante=kmRel, pt=null;
  for(const ln of lines){
    const len=turf.length(ln,{units:'kilometers'});
    if(restante <= len){
      pt=turf.along(ln, restante,{units:'kilometers'}); break;
    }
    restante-=len;
  }
  if(!pt){                 // km exatamente no final da soma
    const ln=lines.at(-1);
    pt=turf.along(ln, turf.length(ln,{units:'kilometers'}), {units:'kilometers'});
  }

  const [lon,lat]=pt.geometry.coordinates;
  L.marker([lat,lon]).bindPopup(
    `<b>${rod}</b><br>KM ${kmVal.toFixed(3)}`).addTo(mapa).openPopup();
  mapa.setView([lat,lon],15);
}

/* ────────── KML → GeoJSON (LineString & Point) ────────── */
function kmlToGeoJSON(kmlText){
  const dom=new DOMParser().parseFromString(kmlText,'text/xml');
  const feats=[];
  [...dom.getElementsByTagName('Placemark')].forEach(p=>{
    const name=(p.getElementsByTagName('name')[0]||{}).textContent||'';
    const line=p.getElementsByTagName('LineString')[0];
    const point=p.getElementsByTagName('Point')[0];
    if(line){
      const coords=line.getElementsByTagName('coordinates')[0]
                       .textContent.trim().split(/\s+/)
                       .map(s=>s.split(',').map(Number).slice(0,2));
      if(coords.length>1)
        feats.push({type:'Feature',properties:{name},
                    geometry:{type:'LineString',coordinates:coords}});
    }else if(point){
      const [lon,lat]=point.getElementsByTagName('coordinates')[0]
                       .textContent.trim().split(',').map(Number);
      feats.push({type:'Feature',properties:{name},
                  geometry:{type:'Point',coordinates:[lon,lat]}});
    }
  });
  return {type:'FeatureCollection',features:feats};
}
