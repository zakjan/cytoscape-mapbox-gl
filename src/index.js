import { MapboxglHandler } from './mapbox-gl-handler';

function register(cytoscape) {
  if (!cytoscape) {
    return;
  }

  cytoscape('core', 'mapboxgl', function(mapboxglConfig, config) {
    return new MapboxglHandler(this, mapboxglConfig, config);
  });
}

if (typeof window.cytoscape !== 'undefined') {
  register(window.cytoscape);
}

export default register;