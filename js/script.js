/* global L, L_KMZ, shp */

/* -------------------------------------------------- */
/*   ARQUIVOS LOCAIS                                  */
/* -------------------------------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];

const KMZ_FILES = [
  'data/SP 181 Separado.kmz',
  'data/SP 250 Separado.kmz'
];

/* -------------------------------------------------- */
/*   MAPA BASE                                        */
/* -------------------------------------------------- */
const mapa = L.map('map');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);

const painel = L.control.layers(null,null,{collapsed:false}).addTo(mapa);

/* grupos para calcular bounds quando tudo acabar      */
const rcCamadas = {};
const rodCamadas = {};

/* -------------------------------------------------- */
/*   CARREGA RCS (shapefile .zip)                     */
/* -------------------------------------------------- */
Promise.all(RC_ZIPS.map(async zip=>{
  try{
    const geo = await shp(zip);
    const nome = zip.match(/RC_[\d._]+/)[0].replace('_',' ');
    const camada = L.geoJSON(geo,{
      style:{color:'#000',weight:2.5,fill:false}
    }).bindPopup(`<b>${nome}</b>`).addTo(mapa);
    rcCamadas[nome]=camada;
    painel.addOverlay(camada,`🗺️ ${nome}`);

    /* rótulo no centro */
    L.marker(camada.getBounds().getCenter(),{
      icon:L.divIcon({className:'rc-label',html:nome,iconSize:null}),
      interactive:false
    }).addTo(mapa);
  }catch(e){console.error('Erro lendo',zip,e);}
})).then(reenquadrar);

/* -------------------------------------------------- */
/*   CARREGA KMZs                                     */
/* -------------------------------------------------- */
KMZ_FILES.forEach(arquivo=>{
  const kmz = new L.KMZLayer(arquivo);
  kmz.on('load',e=>{
    const grupo = e.layer;
    const titulo = arquivo.split('/').pop().replace('.kmz','');
    grupo.addTo(mapa);
    rodCamadas[titulo]=grupo;
    painel.addOverlay(grupo,`📄 ${titulo}`);

    /* rótulos “SP 250” etc. */
    grupo.eachLayer(l=>{
      if(l.getBounds&&l.getBounds().isValid()){
        const sigla = /SP\s*\d+/i.exec(titulo);
        if(sigla){
          L.marker(l.getBounds().getCenter(),{
            icon:L.divIcon({className:'rod-label',html:sigla[0],iconSize:null}),
            interactive:false
          }).addTo(mapa);
        }
      }
    });

    reenquadrar();              // se todas as entradas já chegaram
  });
  kmz.addTo(mapa);              // inicia download
});

/* -------------------------------------------------- */
/*   AJUSTA ZOOM APENAS QUANDO JÁ TEMOS ALGUMA COISA  */
/* -------------------------------------------------- */
function reenquadrar(){
  const todas = {...rcCamadas,...rodCamadas};
  if(Object.keys(todas).length===0) return;
  const bounds = L.featureGroup(Object.values(todas)).getBounds();
  if(bounds.isValid()) mapa.fitBounds(bounds);
}
