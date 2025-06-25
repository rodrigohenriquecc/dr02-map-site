// Map initialization
const map = L.map('map').setView([-23.5, -47.8], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ---------- Utility functions ----------
function randomColor(alpha=0.2){
  const r=Math.floor(Math.random()*255);
  const g=Math.floor(Math.random()*255);
  const b=Math.floor(Math.random()*255);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- Load region shapefiles ----------
const regions = [
  {name:'RC 2.1',file:'RC 2.1.zip'},
  {name:'RC 2.2',file:'RC 2.2.zip'},
  {name:'RC 2.4',file:'RC 2.4.zip'},
  {name:'RC 2.5',file:'RC 2.5.zip'},
  {name:'RC 2.6+2.8',file:'RC 2.6+2.8.zip'},
  {name:'RC 2.7',file:'RC 2.7.zip'}
];
const regionLayers = {};

regions.forEach(info=>{
  const color = randomColor();
  const layer = omnivore.shapefile(`data/${info.file}`, null, L.geoJson(null, {
    style: { color: color, weight: 1, fillColor: color, fillOpacity: 0.2 }
  }));
  regionLayers[info.name] = layer;
  layer.on('ready', () => {
    // Optionally fit map to first region
    // map.fitBounds(layer.getBounds());
  });
  layer.addTo(map);
});

// Region filter checkboxes
document.querySelectorAll('.region-filter').forEach(cb=>{
  cb.addEventListener('change', e=>{
    const name = e.target.dataset.region;
    if(e.target.checked){
      map.addLayer(regionLayers[name]);
    }else{
      map.removeLayer(regionLayers[name]);
    }
  });
});

// ---------- Load Excel and plot road network ----------
fetch('data/PLANILHA BI - OFICIAL.xlsx')
  .then(r=>r.arrayBuffer())
  .then(buf=>{
    const workbook = XLSX.read(buf,{type:'array'});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, {header:1, defval:null});

    // Expect columns: RC | Rodovia | KM Inicial | KM Final | Latitude | Longitude | Municipio | Seq
    const header = data[0];
    const rcIdx = header.findIndex(h=>/RC/i.test(h));
    const rodIdx= header.findIndex(h=>/Rodovia/i.test(h));
    const latIdx= header.findIndex(h=>/Lat/i.test(h));
    const lonIdx= header.findIndex(h=>/Lon/i.test(h));
    const seqIdx= header.findIndex(h=>/Seq|Ordem|Index/i.test(h));

    const groups = {};
    for(let i=1;i<data.length;i++){
      const row = data[i];
      if(row[latIdx]==null || row[lonIdx]==null) continue;
      const key = `${row[rcIdx]} ${row[rodIdx]}`.trim();
      if(!groups[key]) groups[key] = [];
      groups[key].push({
        lat: parseFloat(row[latIdx]),
        lon: parseFloat(row[lonIdx]),
        seq: seqIdx>=0 ? Number(row[seqIdx]) : i
      });
    }
    // Create layers per road
    const roadLayers = {};
    Object.entries(groups).forEach(([key, pts])=>{
      // sort by seq
      pts.sort((a,b)=>a.seq-b.seq);
      const coords = pts.map(p=>[p.lat, p.lon]);
      const line = L.polyline(coords, {color:'#666', weight:3, opacity:1});
      line.addTo(map);
      roadLayers[key]=line;
    });

    // Build UI for roads
    const container = document.getElementById('rodovia-filters');
    Object.keys(roadLayers).sort().forEach(name=>{
      const id = name.replace(/\s+/g,'_');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type='checkbox'; cb.checked=true;
      cb.addEventListener('change', e=>{
        if(e.target.checked){ map.addLayer(roadLayers[name]); }
        else { map.removeLayer(roadLayers[name]); }
      });
      label.append(cb, ` ${name}`);
      container.append(label);
    });
  })
  .catch(err=>{
    console.error('Erro carregando Excel:', err);
    alert('Não foi possível carregar PLANILHA BI - OFICIAL.xlsx. Verifique se o arquivo está em /data/');
  });
