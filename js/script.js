/* global L, XLSX, shp */

/* ---------------------------------------------------------- */
/* CONFIGURAÇÕES                                              */
/* ---------------------------------------------------------- */
const LIMITE_METROS = 2000;   // quebra a polilinha se pular > 2 km

/* ---------------------------------------------------------- */
/* VARIÁVEIS GLOBAIS                                          */
/* ---------------------------------------------------------- */
let mapa;
const rodoviaDatas   = {};    // { rotulo: [{km,lat,lon}, …] }
const gruposRodovia  = {};    // rotulo → L.FeatureGroup (linhas+marcadores)
let camadaRecorte    = null;  // polilinha vermelha do filtro Km

/* ---------------------------------------------------------- */
/* INICIALIZAÇÃO                                              */
/* ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  mapa = criarMapaBase();

  const rcLayers = await carregarRCs(mapa);
  await carregarRodovias(mapa);      // popula rodoviaDatas + gruposRodovia
  criarPainelRodovia();              // painel lateral com filtros

  L.control.layers(null, rcLayers, { position:'topright', collapsed:false })
    .addTo(mapa);

  // zoom geral
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
/* CARREGA SHAPEFILES DAS REGIÕES (RCs)                       */
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
  for (const {nome,arquivo} of arquivos) {
    try {
      const geo = await shp(arquivo);
      const cor = corAleatoria();
      const layer = L.geoJSON(geo, {
        style:{ color:cor, weight:1, fillColor:cor, fillOpacity:0.25 }
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
/* CARREGA PLANILHA E DESENHA RODOVIAS                        */
/* ---------------------------------------------------------- */
async function carregarRodovias (map) {
  const buf = await fetch('planilha.xlsx').then(r=>r.arrayBuffer());
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

  // agrupa dados
  raw.slice(1).forEach(l=>{
    const rot=`${l[rc]} | ${l[sp]}`;
    if(!rodoviaDatas[rot]) rodoviaDatas[rot]=[];
    rodoviaDatas[rot].push({ km:+l[km], lat:+l[lat], lon:+l[lon] });
  });

  // desenha cada rodovia com segmentação e marcadores
  Object.entries(rodoviaDatas).forEach(([rot, pts])=>{
    pts.sort((a,b)=>a.km-b.km);

    const segmentos=[[]];
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      if(i>0){
        const ant=pts[i-1];
        const dist=distanciaMetros(ant.lat,ant.lon,p.lat,p.lon);
        if(dist > LIMITE_METROS) segmentos.push([]);
      }
      segmentos[segmentos.length-1].push([p.lat,p.lon]);
    }

    const group=L.featureGroup().addTo(map);

    segmentos.forEach(coords=>{
      L.polyline(coords,{color:'#555',weight:3,opacity:0.9})
        .bindPopup(`<b>${rot}</b>`).addTo(group);
    });

    const primeiro=pts[0], ultimo=pts[pts.length-1];
    L.circleMarker([primeiro.lat,primeiro.lon],{
      radius:6,color:'#090',fillColor:'#0f0',fillOpacity:0.85
    }).bindTooltip(`${rot} • Início Km ${primeiro.km}`,{direction:'top'})
      .addTo(group);

    L.circleMarker([ultimo.lat,ultimo.lon],{
      radius:6,color:'#900',fillColor:'#f00',fillOpacity:0.85
    }).bindTooltip(`${rot} • Final Km ${ultimo.km}`,{direction:'top'})
      .addTo(group);

    gruposRodovia[rot]=group;
  });
}

/* ---------------------------------------------------------- */
/* PAINEL DE FILTRO RODOVIA + KM                              */
/* ---------------------------------------------------------- */
function criarPainelRodovia () {
  const RodControl = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const div=L.DomUtil.create('div','leaflet-bar');
      div.style.background='#fff';
      div.style.padding='8px';
      div.style.minWidth='160px';
      div.innerHTML=`
        <label style="font-weight:bold">Rodovia:</label><br>
        <select id="selRod" style="width:100%;margin-bottom:4px;">
          <option value="">(todas)</option>
          ${Object.keys(rodoviaDatas).sort().map(r=>`<option>${r}</option>`).join('')}
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

  // eventos
  document.getElementById('selRod').addEventListener('change', aplicarFiltro);
  document.getElementById('kmIni').addEventListener('input', aplicarFiltro);
  document.getElementById('kmFim').addEventListener('input', aplicarFiltro);
}

function aplicarFiltro(){
  const rodSel=document.getElementById('selRod').value;
  const kmIni=parseFloat(document.getElementById('kmIni').value);
  const kmFim=parseFloat(document.getElementById('kmFim').value);

  // mostra/esconde grupos completos
  Object.entries(gruposRodovia).forEach(([rot,grp])=>{
    if(!rodSel || rot===rodSel) grp.addTo(mapa);
    else mapa.removeLayer(grp);
  });

  // remove recorte anterior
  if(camadaRecorte){ mapa.removeLayer(cama
