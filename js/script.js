/* global L, JSZip, shp, turf */

/* … cabeçalhos, listas, mapa e funções já existentes … */

/* === localizarKm substituído (apenas esta função mudou) === */
function localizarKm(){
  const rod   = document.getElementById('selRod').value;
  const kmAbs = parseFloat(document.getElementById('kmAlvo').value);
  if(!rod || isNaN(kmAbs)){ alert('Escolha rodovia e Km'); return; }

  /* meta-dados */
  const meta = metaRod[rod];
  if(!meta){ alert('Rodovia sem meta-dados'); return; }
  if(kmAbs < meta.kmIni || kmAbs > meta.kmFim){
    alert(`KM fora do intervalo!\nVálido: ${meta.kmIni} – ${meta.kmFim}`); return;
  }
  const kmRel = kmAbs - meta.kmIni;      // distância a percorrer

  /* camada da rodovia */
  const lyr = rodLayers[rod];
  if(!lyr){ alert('Camada não carregada'); return; }
  const lines = lyr.toGeoJSON().features
                    .filter(f=>f.geometry.type==='LineString');
  if(!lines.length){ alert('Sem LineString'); return; }

  /* percorre segmentos na ordem, somando comprimentos */
  let restante = kmRel;
  let pt = null;
  for(const ln of lines){
    const len = turf.length(ln,{units:'kilometers'});
    if(restante <= len){
      pt = turf.along(ln, restante, {units:'kilometers'});
      break;
    }
    restante -= len;
  }
  if(!pt){                // se passou de tudo, cai no último vértice
    const ln = lines[lines.length-1];
    pt = turf.along(ln, turf.length(ln,{units:'kilometers'}), {units:'kilometers'});
  }

  const [lon,lat] = pt.geometry.coordinates;
  L.marker([lat,lon]).bindPopup(
    `<b>${rod}</b><br>KM ${kmAbs.toFixed(3)}`).addTo(mapa).openPopup();
  mapa.setView([lat,lon], 15);
}
