/* global L, L_KMZ */

/* Lista de arquivos KMZ já presentes no diretório do site
   └► coloque outros nomes aqui caso tenha mais rodovias                    */
const KMZ_FILES = [
  './data/SP_181_Separado.kmz',
  './data/SP_250_Separado.kmz'
];

/* ---------------------------------------------------------- */
/*   INICIALIZA O MAPA                                        */
/* ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const mapa = L.map('map').setView([-23.8, -48.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom : 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);

  /* painéis de camadas                                        */
  const kmzGroup   = {};          // título do arquivo  → camada Leaflet
  const labelGroup = {};          // título do arquivo  → L.marker rótulo

  const painel = L.control.layers(null, null, {
    position: 'topright', collapsed: false
  }).addTo(mapa);

  /* ---------------------------------------------------------- */
  /*   CARREGA TODOS OS KMZ                                     */
  /* ---------------------------------------------------------- */
  KMZ_FILES.forEach(file => {
    const layerKMZ = new L.KMZLayer(file);

    layerKMZ.on('load', e => {
      const camada = e.layer;                 // grupo já convertido
      const titulo = file.split('/').pop().replace(/_/g,' ').replace(/\.kmz$/i,'');

      /* Adiciona a camada principal (todas as polilinhas / pontos)         */
      camada.addTo(mapa);
      kmzGroup[titulo] = camada;
      painel.addOverlay(camada, `📄 ${titulo}`);

      /* Gera rótulos: um no centro de cada polilinha                      */
      camada.eachLayer(l => {
        if (l.getBounds && l.getBounds().isValid()) {
          const c = l.getBounds().getCenter();
          const sigla = /SP\s*\d+/i.exec(titulo) || ['Rodovia'];
          const marker = L.marker(c, {
            icon: L.divIcon({className:'kmz-label', html: sigla[0], iconSize:null}),
            interactive: false
          }).addTo(mapa);
          (labelGroup[titulo] ||= L.layerGroup()).addLayer(marker);
        }
      });

      /* Mostra rótulos como opção extra                                 */
      if (labelGroup[titulo]) {
        labelGroup[titulo].addTo(mapa);
        painel.addOverlay(labelGroup[titulo], `🏷️ ${titulo} (rótulo)`);
      }

      /* Ajusta zoom global depois que todos os arquivos carregarem       */
      if (Object.keys(kmzGroup).length === KMZ_FILES.length) {
        const tudo = L.featureGroup(Object.values(kmzGroup));
        mapa.fitBounds(tudo.getBounds());
      }
    });

    /* Inicia download do KMZ                                            */
    layerKMZ.addTo(mapa);
  });
});
