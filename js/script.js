/* global L, XLSX, shp */

/* ---------------------------------------------------------- */
/* CONFIGURAÇÕES                                              */
/* ---------------------------------------------------------- */
const LIMITE_METROS = 2000;   // quebra a polilinha se pular > 2 km

/* ---------------------------------------------------------- */
/* VARIÁVEIS GLOBAIS                                          */
/* ---------------------------------------------------------- */
let mapa;
const rodoviaDatas  = {};     // { rotulo: [{km,lat,lon}, …] }
const gruposRodovia = {};     // rotulo → L.FeatureGroup
let camadaRecorte   = null;   // polilinha vermelha do filtro Km

/* ---------------------------------------------------------- */
/* INICIALIZAÇÃO                                              */
/* ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  mapa = criarMapaBase();

  const rcLayers = await carregarRCs(mapa);
  await carregarRodovias(mapa);
  criarPainelRodovia();

  L.control.layers(null, rcLayers, { position:'topright', collapsed:false })
    .addTo(mapa);

  const tudo = L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(gruposRodovia)
  ]);
  if (tudo.getLayers().length) mapa.fitBounds(tudo.getBounds());
});

/* ---------------------------------------------------------- */
/* MAPA BASE                                                  */
/* ---------------------------------------------------------- */
function criarMapaBase () {
  const map = L.map('map').setView([-23.8,-48.5], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  return map;
}

/* ---------------------------------------------------------- */
/* RCs (shapefile ou GeoJSON)                                 */
/* ---------------------------------------------------------- */
async function carregarRCs (map) {
  const arquivos = [
    { nome:'RC 2.1', arquivo:'data/RC_2.1.zip' },
    { nome:'RC 2.2', arquivo:'data/RC_2.2.zip' },
    { nome:'RC 2.4', arquivo:'data/RC_2.4.zip' },
    { nome:'RC 2.5', arquivo:'data/RC_2.5.zip' },
    { nome:'RC 2.6 + 2.8', arquivo:'data/RC_2.6_2.8.zip' },
    { nome:'RC 2.7', arquivo:'data/RC_2.7.zip' }
  ];

  const camadas = {};
  for (const { nome, arquivo } of arquivos) {
    try {
      const geo = await shp(arquivo);
      const cor = corAleatoria();
      const layer = L.geoJSON(geo, {
        style: { color:cor, weight:1, fillColor:cor, fillOpacity:0.25 }
      }).addTo(map);
      layer.bindPopup(`<b>${nome}</b>`);
      camadas[nome] = layer;
    } catch (e) {
      console.error(`Falha ao ler ${arquivo}`, e);
    }
  }
  return camadas;
}

/* ---------------------------------------------------------- */
/* PLANILHA → Rodovias                                        */
/* ---------------------------------------------------------- */
async function carregarRodovias (map) {
  const buf = await fetch('planilha.xlsx').then(r => r.arrayBuffer());
  const wb  = XLSX.read(buf, { type:'array' });
  const raw = XLSX.utils.sheet_to_json(
               wb.Sheets[wb.SheetNames[0]], { header:1, blankrows:false });

  if (!raw.length) return;

  const head = raw[0].map(s => String(s).trim().toUpperCase());
  const ix   = h => head.indexOf(h);
  let rc=ix('RC'), sp=ix('SP'), km=ix('KM'), lat=ix('LAT'), lon=ix('LON');
  const latlon = ix('LAT,LON');
  if ((lat===-1||lon===-1) && latlon!==-1) {
    head.splice(latlon,1,'LAT','LON');
    for (let i=1;i<raw.length;i++) {
      const [la,lo] = String(raw[i][latlon]).split(/[,; ]+/);
      raw[i].splice(latlon,1,parseFloat(la),parseFloat(lo));
    }
    lat = latlon; lon = latlon+1;
  }
  if ([rc,sp,km,lat,lon].includes(-1)) {
    alert('Cabeçalhos RC, SP, KM, LAT, LON ausentes.'); return;
  }

  /* agrupa por rodovia */
  raw.slice(1).forEach(l => {
    const rot = `${l[rc]} | ${l[sp]}`;
    (rodoviaDatas[rot] ||= [])
      .push({ km:+l[km], lat:+l[lat], lon:+l[lon] });
  });

  /* desenha cada rodovia com segmentação e marcadores */
  Object.entries(rodoviaDatas).forEach(([rot, pts]) => {
    pts.sort((a,b) => a.km - b.km);

    const segmentos = [[]];
    for (let i=0;i<pts.length;i++) {
      const p = pts[i];
      if (i>0) {
        const ant = pts[i-1];
        const dist = distanciaMetros(ant.lat, ant.lon, p.lat, p.lon);
        if (dist > LIMITE_METROS) segmentos.push([]);
      }
      segmentos.at(-1).push([p.lat, p.lon]);
    }

    const grp = L.featureGroup().addTo(map);
    segmentos.forEach(c =>
      L.polyline(c, {color:'#555',weight:3,opacity:0.9})
        .bindPopup(`<b>${rot}</b>`).addTo(grp)
    );

    const ini=pts[0], fim=pts.at(-1);
    L.circleMarker([ini.lat,ini.lon],{
      radius:6,color:'#090',fillColor:'#0f0',fillOpacity:0.85
    }).bindTooltip(`${rot} • Início Km ${ini.km}`,{direction:'top'})
      .addTo(grp);

    L.circleMarker([fim.lat,fim.lon],{
      radius:6,color:'#900',fillColor:'#f00',fillOpacity:0.85
    }).bindTooltip(`${rot} • Final Km ${fim.km}`,{direction:'top'})
      .addTo(grp);

    gruposRodovia[rot] = grp;
  });
}

/* ---------------------------------------------------------- */
/* PAINEL – Filtro Rodovia + Km                               */
/* ---------------------------------------------------------- */
function criarPainelRodovia () {
  const RodControl = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const div = L.DomUtil.create('div','leaflet-bar');
      div.style.cssText = 'background:#fff;padding:8px;min-width:160px;';
      const opts = Object.keys(rodoviaDatas)
        .sort()
        .map(r => '<option>'+r+'</option>')
        .join('');
      div.innerHTML = `
        <label style="font-weight:bold">Rodovia:</label><br>
        <select id="selRod" style="width:100%;margin-bottom:4px;">
          <option value="">(todas)</option>${opts}
        </select>
        <label style="font-weight:bold">Km inicial:</label>
        <input id="kmIni" type="number" style="width:100%;margin-bottom:4px;"
               placeholder="(vazio)">
        <label style="font-weight:bold">Km final:</label>
        <input id="kmFim" type="number" style="width:100%;">
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  mapa.addControl(new RodControl());

  document.getElementById('selRod').addEventListener('change', aplicarFiltro);
  document.getElementById('kmIni').addEventListener('input', aplicarFiltro);
  document.getElementById('kmFim').addEventListener('input', aplicarFiltro);
}

function aplicarFiltro(){
  const rodSel = document.getElementById('selRod').value;
  const kmIni  = parseFloat(document.getElementById('kmIni').value);
  const kmFim  = parseFloat(document.getElementById('kmFim').value);

  Object.entries(gruposRodovia).forEach(([rot,grp])=>{
    (!rodSel || rot===rodSel) ? grp.addTo(mapa) : mapa.removeLayer(grp);
  });

  if (camadaRecorte) { mapa.removeLayer(camadaRecorte); camadaRecorte=null; }

  if (rodSel && (!isNaN(kmIni)||!isNaN(kmFim))) {
    const pts = rodoviaDatas[rodSel].filter(p =>
      (isNaN(kmIni)||p.km>=kmIni) && (isNaN(kmFim)||p.km<=kmFim)
    );
    if (pts.length){
      camadaRecorte = L.polyline(
        pts.sort((a,b)=>a.km-b.km).map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}
      ).addTo(mapa);
      mapa.fitBounds(camadaRecorte.getBounds(),{maxZoom:14});
    }
  }
}

/* ---------------------------------------------------------- */
/* UTILITÁRIAS                                                */
/* ---------------------------------------------------------- */
function distanciaMetros(lat1, lon1, lat2, lon2){
  const R=6371000, d=Math.PI/180;
  const dLat=(lat2-lat1)*d, dLon=(lon2-lon1)*d;
  const h=Math.sin(dLat/2)**2+
          Math.cos(lat1*d)*Math.cos(lat2*d)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function corAleatoria(){
  return `hsl(${Math.random()*360},70%,60%)`;
}
