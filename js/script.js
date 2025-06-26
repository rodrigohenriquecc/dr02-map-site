/* global L, XLSX, shp */

document.addEventListener('DOMContentLoaded', init);

async function init () {
  const map = criarMapaBase();

  // 1. Carrega shapefiles das regiões (RCs)
  const rcLayers = await carregarRCs(map);

  // 2. Carrega planilha e desenha polilinhas das rodovias
  await carregarRodovias(map);

  // 3. Adiciona painel de camadas (RCs)
  L.control.layers(null, rcLayers, { position: 'topright', collapsed: false })
    .addTo(map);

  // zoom para tudo
  const tudo = L.featureGroup(Object.values(rcLayers)).getBounds();
  if (tudo.isValid()) map.fitBounds(tudo);
}

/* ------------------------------------------------------------------ */
/* Mapa-base                                                          */
/* ------------------------------------------------------------------ */
function criarMapaBase () {
  const map = L.map('map').setView([-23.8, -48.5], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  return map;
}

/* ------------------------------------------------------------------ */
/* RCs – leitura dos shapefiles                                       */
/* ------------------------------------------------------------------ */
async function carregarRCs (map) {
  // lista das regiões e respectivos arquivos
  const arquivos = [
    { nome: 'RC 2.1', arquivo: 'data/RC_2.1.zip' },
    { nome: 'RC 2.2', arquivo: 'data/RC_2.2.zip' },
    { nome: 'RC 2.4', arquivo: 'data/RC_2.4.zip' },
    { nome: 'RC 2.5', arquivo: 'data/RC_2.5.zip' },
    { nome: 'RC 2.6 + 2.8', arquivo: 'data/RC_2.6_2.8.zip' },
    { nome: 'RC 2.7', arquivo: 'data/RC_2.7.zip' }
  ];

  const rcLayers = {};

  for (const { nome, arquivo } of arquivos) {
    try {
      const geojson = await shp(arquivo);      // shp.js magic :-)
      const cor     = corAleatoria();
      const layer   = L.geoJSON(geojson, {
        style: { color: cor, weight: 1, fillColor: cor, fillOpacity: 0.25 }
      }).addTo(map);

      layer.bindPopup(`<b>${nome}</b>`);
      rcLayers[nome] = layer;
    } catch (err) {
      console.error(`Falha ao ler ${arquivo}`, err);
    }
  }
  return rcLayers;
}

/* ------------------------------------------------------------------ */
/* Rodovias – leitura da planilha                                     */
/* ------------------------------------------------------------------ */
async function carregarRodovias (map) {
  let raw;
  try {
    const buf = await fetch('planilha.xlsx').then(r => r.arrayBuffer());
    const wb  = XLSX.read(buf, { type: 'array' });
    raw       = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],
                                         { header: 1, blankrows: false });
  } catch (e) {
    alert('Falha ao abrir planilha.xlsx'); throw e;
  }
  if (raw.length === 0) return;

  const head = raw[0].map(s => String(s).trim().toUpperCase());
  const idx  = (h) => head.indexOf(h);
  let rc=idx('RC'), sp=idx('SP'), km=idx('KM'), lat=idx('LAT'), lon=idx('LON');
  const latlon = idx('LAT,LON');
  if ((lat===-1||lon===-1) && latlon!==-1) {
    head.splice(latlon,1,'LAT','LON');
    for (let i=1;i<raw.length;i++){
      const [la,lo]=(String(raw[i][latlon])).split(/[,; ]+/);
      raw[i].splice(latlon,1,parseFloat(la),parseFloat(lo));
    }
    lat=latlon; lon=latlon+1;
  }
  if ([rc,sp,km,lat,lon].includes(-1)) {
    alert('Cabeçalhos RC, SP, KM, LAT, LON faltando.'); return;
  }

  // agrupa por RC|SP
  const grupos = {};
  raw.slice(1).forEach(l=>{
    const chave=`${l[rc]} | ${l[sp]}`;
    if(!grupos[chave])grupos[chave]=[];
    grupos[chave].push({
      km:parseFloat(l[km]), lat:parseFloat(l[lat]), lon:parseFloat(l[lon])
    });
  });

  Object.entries(grupos).forEach(([rotulo,arr])=>{
    arr.sort((a,b)=>a.km-b.km);
    const linha=L.polyline(arr.map(p=>[p.lat,p.lon]),
      {color:'#555',weight:3,opacity:0.9}).addTo(map);
    linha.bindPopup(`<b>${rotulo}</b>`);
  });
}

/* util cor pastel aleatória */
function corAleatoria () {
  const h = Math.random()*360;
  return `hsl(${h},70%,60%)`;
}
