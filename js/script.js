/* global L, JSZip, shp, turf */

/* … LISTAS DE ARQUIVOS E META-DADOS (mesmo conteúdo) … */
/* … mapa, painel, funções addLabel / zoomGlobal idem … */

/* ---------- Estilo dos marcadores pequenos ----------- */
const dotOpt = {
  radius: 5,
  color:  '#1976d2',
  weight: 2,
  fillColor: '#1976d2',
  fillOpacity: 1
};

/* ---------- UI permanece igual (selRod, btnKm) -------- */

/* ---------- RC (.zip) — sem mudanças ------------------ */
Promise.all(RC_ZIPS.map(async zip=>{ /* … idêntico … */ })).then(zoomGlobal);

/* ---------- KMZ -> GeoJSON ---------------------------- */
KMZ_FILES.forEach(async file=>{
  /* … (mesmo código para carregar) … */

    rodLayers[title]=lyr; painel.addOverlay(lyr,'📄 '+title);
    atualizarSelect();

    /* marcador início/fim (se vier no JSON) */
    const meta = metaRod[title];
    if(meta && meta.iniLat){
      L.circleMarker([meta.iniLat, meta.iniLon], dotOpt)
        .bindPopup(`${title}<br>Km ${meta.kmIni}`).addTo(mapa);
      L.circleMarker([meta.fimLat, meta.fimLon], dotOpt)
        .bindPopup(`${title}<br>Km ${meta.kmFim}`).addTo(mapa);
    }

    /* rótulo SP ### (permanece) */
    /* … */
});

/* ---------- Localizar Km (apenas marcador mudou) ------ */
function localizarKm(){
  /* … validações iguais … */

  const [lon,lat]=pt.geometry.coordinates;

  L.circleMarker([lat,lon], dotOpt)              // ← bolinha
    .bindPopup(`<b>${rod}</b><br>KM ${kmVal.toFixed(3)}`)
    .addTo(mapa).openPopup();

  mapa.setView([lat,lon], 15);
}

/* ---------- kmlToGeoJSON (mesmo) ---------------------- */
