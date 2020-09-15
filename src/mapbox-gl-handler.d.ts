export interface MapboxglHandlerOptions {
  getPosition: (node: cytoscape.NodeSingular) => mapboxgl.LngLatLike;
  setPosition?: (node: cytoscape.NodeSingular, lngLat: mapboxgl.LngLat) => void;
  animate?: boolean;
  animationDuration?: number;
}