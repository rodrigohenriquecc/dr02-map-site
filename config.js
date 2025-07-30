/**
 * Configuração da API - Versão Segura
 * Substitua a chave abaixo pela sua nova chave
 */

// ⚠️ IMPORTANTE: Substitua pela sua nova chave do Google Cloud Console
const GOOGLE_MAPS_API_KEY = 'AIzaSyB2UoBUuLZIq7wQTlNEONXJSMIdHbC342M';

// Função para carregar a API dinamicamente
function carregarGoogleMapsAPI() {
  if (GOOGLE_MAPS_API_KEY === 'SUA_NOVA_CHAVE_AQUI_SUBSTITUA_ESTA_LINHA') {
    console.error('❌ ERRO: Configure sua chave de API no arquivo config.js');
    alert('⚠️ Configure sua chave de API no arquivo config.js antes de usar o sistema');
    return;
  }
  
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
