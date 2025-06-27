/* global L, L_KMZ, shp */

/* ---------- LISTAS DE ARQUIVOS --------------------------- */
const RC_ZIPS = [
  'data/RC_2.1.zip','data/RC_2.2.zip','data/RC_2.4.zip',
  'data/RC_2.5.zip','data/RC_2.6_2.8.zip','data/RC_2.7.zip'
];
const KMZ_FILES = [
  'data/SP 181 Separado.kmz',
  'data/SP 250 Separado.kmz'
];

/* ---------- MAPA BASE ------------------------------------ */
const mapa = L.map('map')
  .addLayer(L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '&copy; OpenStreetMap' }));

const painel = L.control.layers(null, null, { collapsed:false }).addTo(mapa);
const rcLayers = {}, rodLayers = {};

/* ---------- REGIÕES (shapefile .zip) --------------------- */
Promise.all(RC_ZIPS.map(async f=>{
  try{
    const geo = await shp(f);
    const nm  = f.match(/RC_[\d._]+/)[0].replace('_',' ');
    rcLayers[nm] = L.geoJSON(geo,{style:{color:'#000',weight:2.5,fill:false}})
                     .addTo(mapa).bindPopup(nm);
    L.marker(rcLayers[nm].getBounds().getCenter(),
      {icon:L.divIcon({className:'rc-label',html:nm,iconSize:null}),
       interactive:false}).addTo(mapa);
    painel.addOverlay(rcLayers[nm],`🗺️ ${nm}`);
  }catch(e){console.error('Erro RC',f,e);}
})).then(enquadrar);

/* ---------- RODOVIAS (KMZ) ------------------------------- */
KMZ_FILES.forEach(file=>{
  const url   = encodeURI(file);                  // <-- (1) escape
  const layer = new L.KMZLayer(url, {strict:false}); // <-- (2) MIME livre

  layer.on('load',e=>{
    const grp   = e.layer;
    const title = file.split('/').pop().replace('.kmz','');
    grp.addTo(mapa);
    rodLayers[title]=grp;
    painel.addOverlay(grp,`📄 ${title}`);

    /* rótulo “SP 250” */
    grp.eachLayer(l=>{
      if(l.getBounds&&l.getBounds().isValid()){
        const sp = /SP\s*\d+/i.exec(title);
        if(sp){
          L.marker(l.getBounds().getCenter(),
            {icon:L.divIcon({className:'rod-label',html:sp[0],iconSize:null}),
             interactive:false}).addTo(mapa);
        }
      }
    });
    enquadrar();
  });

  layer.on('error',e=>console.error('Falhou:',e.url));   // <-- (3)
  layer.addTo(mapa);
});

/* ---------- AJUSTA ZOOM ---------------------------------- */
function enquadrar(){
  const todos = {...rcLayers,...rodLayers};
  if(Object.keys(todos).length){
    const b = L.featureGroup(Object.values(todos)).getBounds();
    if(b.isValid()) mapa.fitBounds(b);
  }
}
