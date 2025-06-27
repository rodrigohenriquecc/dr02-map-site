/* ────────── KMZ → GeoJSON ────────── */
KMZ_FILES.forEach(async file=>{
  try{
    const resp = await fetch(encodeURI(file));
    if(!resp.ok){console.error('404',file);return;}

    const buf  = await resp.arrayBuffer();
    const zip  = await JSZip.loadAsync(buf);
    const kml  = Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kml){console.warn('KMZ sem KML:',file);return;}

    const kmlTxt = await zip.file(kml).async('string');
    const geo    = kmlToGeoJSON(kmlTxt);

    const title  = file.split('/').pop().replace('.kmz','');

    /*   ↓↓↓  AGORA filtra só LineString  ↓↓↓  */
    const lyr = L.geoJSON(geo,{
      style : {color:'#555', weight:3, opacity:.9},
      filter: f => f.geometry.type === 'LineString'
    }).addTo(mapa);

    rodLayers[title] = lyr;
    painel.addOverlay(lyr, '📄 ' + title);
    atualizarSelect();

    /* rótulo “SP ###” permanece igual … */
    const sig=(/SP[A-Z]?\s*\d+/i).exec(title);
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
