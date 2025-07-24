/**
 * Configuração da API - Versão Segura
 * Substitua a chave abaixo pela sua nova chave
 */

// ⚠️ IMPORTANTE: Substitua pela sua nova chave do Google Cloud Console
const GOOGLE_MAPS_API_KEY = 'AIzaSyDRgz2fjGIsRXztCQpIWXMlsQifV1C4IDM';

// Função para carregar a API dinamicamente
function carregarGoogleMapsAPI() {
  if (typeof google !== 'undefined') {
    console.log('Google Maps já carregado');
    return;
  }
  
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places,visualization,drawing&callback=initMap&v=weekly&loading=async`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

// Carregar API quando página estiver pronta
document.addEventListener('DOMContentLoaded', carregarGoogleMapsAPI);
