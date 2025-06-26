/* global L, XLSX, shp */

document.addEventListener('DOMContentLoaded', init);

let mapa,  rodoviaDatas = {},  // { rotulo: [{km,lat,lon}, …] }
    poliesRodovias = {},       // rotulo → L.Polyline (todas as KMs)
    camadaRecorte;             // L.Polyline recortada (Km filter)

async function init () {
  mapa = criarMapaBase();
  const rcLayers = await carregarRCs(mapa);
  await carregarRodovias(mapa);           // popula rodoviaDatas + poliesRodovias
  criarPainelRodovia();                   // cria filtro lateral

  L.control.layers(null, rcLayers, { position:'topright', collapsed:false })
    .addTo(mapa);

  // Ajusta o zoom para caber tudo (RCs + rodovias)
  const grupoTudo = L.featureGroup([
    ...Object.values(rcLayers),
    ...Object.values(poliesRodovias)
  ]);
  if (grupoTudo.getLayers().length) mapa.fitBounds(grupoTudo.getBounds());
}

/* ------------------------------------------------------------------ */
/* 1. Mapa base                                                       */
/* ------------------------------------------------------------------ */
function criarMapaBase () {
  const map = L.map('map').setView([-23.8,-48.5], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  return map;
}

/* ------------------------------------------------------------------ */
/* 2. Carrega RCs (shapefiles ZIP ou GeoJSON)                         */
/* ------------------------------------------------------------------ */
async function carregarRCs (map) {
  const arquivos = [
    { nome:'RC 2.1', arquivo:'data/RC_2.1.zip' },
    { nome:'RC 2.2', arquivo:'data/RC_2.2.zip' },
    { nome:'RC 2.4', arquivo:'data/RC_2.4.zip' },
    { nome:'RC 2.5', arquivo:'data/RC_2.5.zip' },
    { nome:'RC 2.6 + 2.8', arquivo:'data/RC_2.6_2.8.zip' },
    { nome:'RC 2.7', arquivo:'data/RC_2.7.zip' }
  ];

  const rcLayers = {};
  for (const {nome,arquivo} of arquivos) {
    try {
      const geo = await shp(arquivo);
      const cor = corAleatoria();
      const layer = L.geoJSON(geo, {
        style:{ color:cor, weight:1, fillColor:cor, fillOpacity:0.25 }
      }).addTo(map);
      layer.bindPopup(`<b>${nome}</b>`);
      rcLayers[nome] = layer;
    } catch (e) {
      console.error(`Falha ao ler ${arquivo}`, e);
    }
  }
  return rcLayers;
}

/* ------------------------------------------------------------------ */
/* 3. Carrega planilha e desenha rodovias                              */
/* ------------------------------------------------------------------ */
async function carregarRodovias (map) {
  const buf = await fetch('planilha.xlsx').then(r => r.arrayBuffer());
  const wb  = XLSX.read(buf, { type:'array' });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],
                                       { header:1, blankrows:false });
  if (!raw.length) return;

  const head = raw[0].map(s=>String(s).trim().toUpperCase());
  const idx  = h=>head.indexOf(h);
  let rc=idx('RC'), sp=idx('SP'), km=idx('KM'), lat=idx('LAT'), lon=idx('LON');
  const latlon = idx('LAT,LON');
  if ((lat===-1||lon===-1)&&latlon!==-1){
    head.splice(latlon,1,'LAT','LON');
    for(let i=1;i<raw.length;i++){
      const [la,lo]=String(raw[i][latlon]).split(/[,; ]+/);
      raw[i].splice(latlon,1,parseFloat(la),parseFloat(lo));
    }
    lat=latlon; lon=latlon+1;
  }
  if([rc,sp,km,lat,lon].includes(-1)){
    alert('Cabeçalhos RC, SP, KM, LAT, LON não encontrados.'); return;
  }

  raw.slice(1).forEach(l=>{
    const rot=`${l[rc]} | ${l[sp]}`;
    if(!rodoviaDatas[rot]) rodoviaDatas[rot]=[];
    rodoviaDatas[rot].push({ km:+l[km], lat:+l[lat], lon:+l[lon] });
  });

  // Desenha cada rodovia completa
  Object.entries(rodoviaDatas).forEach(([rot,pts])=>{
    pts.sort((a,b)=>a.km-b.km);
    poliesRodovias[rot] = L.polyline(
      pts.map(p=>[p.lat,p.lon]),
      {color:'#555',weight:3,opacity:0.9}
    ).bindPopup(`<b>${rot}</b>`).addTo(map);
  });
}

/* ------------------------------------------------------------------ */
/* 4. Painel de filtro de rodovia + Km                                */
/* ------------------------------------------------------------------ */
function criarPainelRodovia () {
  const RodControl = L.Control.extend({
    options:{ position:'topleft' },
    onAdd: function(){
      const div = L.DomUtil.create('div','leaflet-bar');
      div.style.background='#fff';
      div.style.padding='8px';
      div.style.minWidth='160px';
      div.style.maxWidth='220px';
      div.innerHTML = `
        <label style="font-weight:bold">Rodovia:</label><br>
        <select id="selRod" style="width:100%; margin-bottom:4px;">
          <option value="">(todas)</option>
          ${Object.keys(rodoviaDatas).sort().map(r=>`<option>${r}</option>`).join('')}
        </select>
        <label style="font-weight:bold">Km&nbsp;inicial:</label>
        <input id="kmIni" type="number" style="width:100%;margin-bottom:4px;"
               placeholder="(vazio = 0)">
        <label style="font-weight:bold">Km&nbsp;final:</label>
        <input id="kmFim" type="number" style="width:100%;">
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  mapa.addControl(new RodControl());

  // listeners
  document.getElementById('selRod').addEventListener('change', aplicarFiltro);
  document.getElementById('kmIni').addEventListener('input', aplicarFiltro);
  document.getElementById('kmFim').addEventListener('input', aplicarFiltro);
}

function aplicarFiltro(){
  const rodSel = document.getElementById('selRod').value;
  const kmIni  = parseFloat(document.getElementById('kmIni').value);
  const kmFim  = parseFloat(document.getElementById('kmFim').value);

  // 1. mostra / esconde polilinhas completas
  Object.entries(poliesRodovias).forEach(([rot,poly])=>{
    if(!rodSel || rot===rodSel) { poly.addTo(mapa); }
    else { mapa.removeLayer(poly); }
  });

  // 2. remove recorte anterior
  if(camadaRecorte){ mapa.removeLayer(camadaRecorte); camadaRecorte=null; }

  // 3. cria recorte se rodovia selecionada e KM informado
  if(rodSel && (!isNaN(kmIni) || !isNaN(kmFim))){
    const pts = rodoviaDatas[rodSel].filter(p=>{
      return (isNaN(kmIni) || p.km>=kmIni) &&
             (isNaN(kmFim)  || p.km<=kmFim);
    });
    if(pts.length){
      camadaRecorte = L.polyline(
        pts.map(p=>[p.lat,p.lon]),
        {color:'#d00',weight:5,opacity:1}
      ).addTo(mapa);
      mapa.fitBounds(camadaRecorte.getBounds(), { maxZoom: 14 });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Util – cor pastel aleatória                                        */
/* ------------------------------------------------------------------ */
function corAleatoria(){
  const h=Math.random()*360;
  return `hsl(${h},70%,60%)`;
}
