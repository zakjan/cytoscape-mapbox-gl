# cytoscape-mapbox-gl

[![](https://img.shields.io/npm/dm/cytoscape-mapbox-gl)](https://www.npmjs.com/package/cytoscape-mapbox-gl)
[![](https://img.shields.io/david/zakjan/cytoscape-mapbox-gl)](https://www.npmjs.com/package/cytoscape-mapbox-gl)
[![](https://img.shields.io/bundlephobia/min/cytoscape-mapbox-gl)](https://www.npmjs.com/package/cytoscape-mapbox-gl)

Mapbox GL plugin for Cytoscape

[Demo](https://zakjan.github.io/cytoscape-mapbox-gl/)

<img src="docs/screenshot@2x.jpg" alt="Screenshot" width="640" height="320">

Compatible with Mapbox GL v1.13 or earlier. Compatibility with v2 is not guaranteed due to [license change](https://github.com/mapbox/mapbox-gl-js/issues/10162). Compatibility with MapLibre fork is under consideration.

Compatible with Cytoscape plugins:

- [cytoscape-edgehandles](https://github.com/cytoscape/cytoscape.js-edgehandles)
- [cytoscape-lasso](https://github.com/zakjan/cytoscape-lasso)

Incompatible with Cytoscape plugins:

- cytoscape-panzoom
  - disable with `cy.panzoom('destroy')` after enabling `cy.mapboxgl(...)`
  - [add map navigation control](#add-map-navigation-control)
  - enable with `cy.panzoom()` after calling `cyMap.destroy()`

## Install

```
npm install mapbox-gl-js cytoscape-mapbox-gl
```

or

```
<script src="https://api.mapbox.com/mapbox-gl-js/v1.13.0/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v1.13.0/mapbox-gl.css" rel="stylesheet">
<script src="https://unpkg.com/cytoscape-mapbox-gl@1.2.0/dist/cytoscape-mapbox-gl.min.js"></script>
```

## Usage

The plugin exposes a single function, which should be used to register the plugin to Cytoscape.js.

```
import cytoscape from 'cytoscape';
import cytoscapeMapboxgl from 'cytoscape-mapbox-gl';

cytoscape.use(cytoscapeMapboxgl);
```

Plain HTML/JS has the extension registered for you automatically.

### API

```
export interface MapboxglHandlerOptions {
  getPosition: (node: cytoscape.NodeSingular) => mapboxgl.LngLatLike;
  setPosition?: (node: cytoscape.NodeSingular, lngLat: mapboxgl.LngLat) => void;
  animate?: boolean;
  animationDuration?: number;
}

const cyMap = cy.mapboxgl(mapboxOptions: mapboxgl.MapboxOptions, options: MapboxglHandlerOptions);
```

- `mapboxglOptions` - see [Mapbox GL JS docs](https://docs.mapbox.com/mapbox-gl-js/api/map/) for detailed documentation
- `options`
  - `getPosition` - function, should return node position, **required**
  - `setPosition` - function, should save the node position
  - `animate` - animate the transition between graph and map mode
  - `animateDuration` - animation duration for the transition between graph and map mode

If no `setPosition` option is provided, it's important to disable node dragging with Cytoscape methods, e.g. with `cy.autoungrabify(true)`.

If node dragging is kept enabled and no `setPosition` option is provided, or `setPosition` returns without saving, node position is reverted back to the original position after node dragging is finished. This behavior can be also used for cancelling.

### Basic

```
cy.autoungrabify(true); // disable node dragging
const cyMap = cy.mapboxgl(..., {
  getPosition: (node) => {
    return [node.data('lng'), node.data('lat')];
  }
});
```

### Node dragging enabled

```
const cyMap = cy.mapboxgl(..., {
  getPosition: (node) => {
    return [node.data('lng'), node.data('lat')];
  },
  setPosition: (node, lngLat) => {
    node.data('lng', lngLat.lng);
    node.data('lat', lngLat.lat);
  }
});
```

### Use raster basemap layer

```
const cyMap = cy.mapboxgl({
  style: {
    'version': 8,
    'sources': {
      'raster-tiles': {
        'type': 'raster',
        'tiles': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        'tileSize': 256,
        'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    },
    'layers': [
      {
        'id': 'raster-tiles',
        'type': 'raster',
        'source': 'raster-tiles',
        'minzoom': 0,
        'maxzoom': 19
      }
    ]
  }
}, ...);
```

OpenStreetMap tiles are not recommended for heavy use. See [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) for details. See [Tile servers at OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Tile_servers) for possible alternatives, or consider commercial alternatives such as [Mapbox](https://studio.mapbox.com/), [Maptiler](https://cloud.maptiler.com/), or running your own tile server.

### Use Mapbox vector basemap layer

```
const cyMap = cy.mapboxgl({
  accessToken: '...',
  style: 'mapbox://styles/mapbox/streets-v11'
}, ...);
```

This requires [Mapbox](https://studio.mapbox.com/) access token.

### Use Maptiler vector basemap layer

```
const cyMap = cy.mapboxgl({
  style: 'https://api.maptiler.com/maps/basic/style.json?key=...'
}, ...);
```

This requires [Maptiler](https://cloud.maptiler.com/) access token.

### Fit map to nodes

```
cyMap.fit(nodes = this.cy.nodes(), options)
```

- `nodes` - `cytoscape.NodeCollection`, the collection to fit to (default all nodes)
- `options` - `mapboxgl.FitBoundsOptions`, see [Mapbox GL JS docs](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#fitbounds) for detailed documentation

### Access Mapbox GL instance

```
cyMap.map
```

See [Mapbox GL JS docs](https://docs.mapbox.com/mapbox-gl-js/api/map/) for detailed documentation.

### Add map navigation control

```
cyMap.map.addControl(new mapboxgl.NavigationControl(), 'top-left');
```

### Destroy

```
cy.autoungrabify(false); // enable node dragging, if node dragging was disabled earlier with `cy.autoungrabify(true)`
cyMap.destroy();
```

## Sponsors

<a href="https://graphlytic.biz/"><img src="docs/graphlytic.png" alt="Graphlytic" width="250" height="61"></a>

[Graphlytic](https://graphlytic.biz/) is a customizable web application for collaborative graph visualization and analysis. There is a [free version for Neo4j Desktop](https://graphlytic.biz/blog/how-to-install-graphlytic-in-neo4j-desktop) available.