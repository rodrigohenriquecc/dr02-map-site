<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>DR-02 • Rodovias + KM</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <!-- favicon “vazio” -->
  <link rel="icon" href="data:," />

  <!-- pre-connect aos CDNs -->
  <link rel="preconnect" href="https://unpkg.com" />
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" />

  <!-- Leaflet + HeatLayer -->
  <link rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"  defer></script>
  <script src="https://unpkg.com/leaflet.heat/dist/leaflet-heat.js" defer></script>

  <!-- JSZip, shp.js, Turf, Papa -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/shpjs@3.6.2/dist/shp.min.js"   defer></script>
  <script src="https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js"   defer></script>
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js" defer></script>

  <!-- toGeoJSON -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/togeojson/0.16.0/togeojson.min.js" defer></script>

  <!-- Firebase compat -->
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"        defer></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"  defer></script>

  <style>
    html,body,#map{height:100%;margin:0;padding:0}

    /* cartão de camadas */
    .layer-card{
      position:absolute; top:16px; left:16px;
      background:#fff; border-radius:6px; padding:8px 10px;
      z-index:760; font:14px/20px Arial,Helvetica,sans-serif;
    }
    .layer-card label{cursor:pointer}
    .layer-card button{
      margin-left:4px; background:#e91e63; color:#fff;
      border:none; border-radius:3px; width:22px;height:22px;
      font-size:14px; line-height:22px; cursor:pointer;
      vertical-align:middle;
    }

    /* área de links */
    .link-card{
      position:absolute; top:16px; right:76px;   /* ao lado do seletor */
      display:flex; flex-direction:column; gap:4px;
      z-index:760;
    }
    .link-card a{
      text-decoration:none; background:#1976d2; color:#fff;
      padding:4px 8px; border-radius:4px; font:13px/16px Arial,Helvetica,sans-serif;
      text-align:center;
    }

    /* botão flutuante recarregar */
    .fab{
      position:absolute; bottom:16px; left:16px; z-index:750;
      width:48px;height:48px; border:none; border-radius:50%;
      background:#ff5722; color:#fff; font:28px/48px sans-serif;
      text-align:center; cursor:pointer;
    }

    /* seletor de rodovias */
    #selRod{
      position:absolute; top:16px; right:16px; z-index:750;
      padding:4px 8px; font-size:14px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- cartão: mostrar/ocultar + limpar -->
  <div id="layerCtrl" class="layer-card">
    <label><input type="checkbox" id="chkPoints" checked>Pontos de interesse</label>
    <button id="btnClrPoints" title="Limpar pontos">🗑</button><br>

    <label><input type="checkbox" id="chkHeat" checked>Mapa de calor</label>
    <button id="btnClrHeat" title="Limpar heatmap">🗑</button><br>

    <label><input type="checkbox" id="chkLines" checked>Linhas por trecho</label>
    <button id="btnClrLines" title="Limpar linhas">🗑</button>
  </div>

  <!-- 3 links para as planilhas (abre em nova guia) -->
  <div class="link-card">
    <a href="https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/edit?gid=1050353294#gid=1050353294"
       target="_blank" rel="noopener">Pontos de interesse</a>
    <a href="https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/edit?gid=885124301#gid=885124301"
       target="_blank" rel="noopener">Mapa de calor</a>
    <a href="https://docs.google.com/spreadsheets/d/14dAXHzNvDQb8gFgOZCeTnOOcgWEpqaoA/edit?gid=867537972#gid=867537972"
       target="_blank" rel="noopener">Linhas por trecho</a>
  </div>

  <!-- botão recarregar CSVs -->
  <button id="btnCSV" class="fab" title="Recarregar planilhas">⟳</button>

  <!-- filtro rodovia -->
  <select id="selRod"><option value="">(todas)</option></select>

  <!-- script principal -->
  <script src="js/script.js" defer></script>
</body>
</html>
