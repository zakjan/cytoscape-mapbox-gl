import mapboxgl from 'mapbox-gl';

/** @typedef {import('cytoscape')} cytoscape */
/** @typedef {import('./mapbox-gl-handler').MapboxglHandlerOptions} MapboxglHandlerOptions */

/**
 * @param {MouseEvent} event
 * @see https://github.com/cytoscape/cytoscape.js/blob/master/src/extensions/renderer/base/load-listeners.js
 */
function isMultSelKeyDown(event) {
  return event.shiftKey || event.metaKey || event.ctrlKey; // maybe event.altKey
}

const DEFAULT_FIT_PADDING = 50;
const DEFAULT_ANIMATION_DURATION = 500;

export class MapboxglHandler {
  /** @type cytoscape.Core */
  cy;
  /** @type mapboxgl.MapboxOptions */
  mapboxOptions;
  /** @type MapboxglHandlerOptions */
  options;

  /** @type HTMLElement */
  mapContainer;
  /** @type mapboxgl.Map */
  map;

  /** @type boolean | undefined */
  originalAutoungrabify;
  /** @type boolean | undefined */
  originalUserZoomingEnabled;
  /** @type boolean | undefined */
  originalUserPanningEnabled;

  /** @type cytoscape.NodePositionMap | undefined */
  originalPositions;
  /** @type number | undefined */
  originalZoom;
  /** @type cytoscape.Position | undefined */
  originalPan;

  onGraphContainerMouseDownBound = this.onGraphContainerMouseDown.bind(this);
  onGraphContainerMouseMoveBound = this.onGraphContainerMouseMove.bind(this);
  onGraphContainerWheelBound = this.onGraphContainerWheel.bind(this);
  onMapMoveBound = this.onMapMove.bind(this);

  onGraphAddBound = this.onGraphAdd.bind(this);
  onGraphResizeBound = this.onGraphResize.bind(this);
  onGraphDragFreeBound = this.onGraphDragFree.bind(this);

  /**
   * @param {cytoscape.Core} cy
   * @param {mapboxgl.MapboxOptions} mapboxOptions
   * @param {MapboxglHandlerOptions} options
   */
  constructor(cy, mapboxOptions, options) {
    this.cy = cy;
    this.mapboxOptions = mapboxOptions;
    this.options = options;

    if (!(this.options.getPosition instanceof Function)) {
      throw new Error('getPosition should be a function');
    }
    if (this.options.setPosition && !(this.options.setPosition instanceof Function)) {
      throw new Error('setPosition should be a function');
    }

    // Cytoscape config
    this.originalAutoungrabify = this.cy.autoungrabify();
    this.originalUserZoomingEnabled = this.cy.userZoomingEnabled();
    this.originalUserPanningEnabled = this.cy.userPanningEnabled();

    this.cy.userZoomingEnabled(false);
    this.cy.userPanningEnabled(false);

    // Cytoscape events
    const graphContainer = /** @type HTMLElement */ (this.cy.container());
    graphContainer.addEventListener('mousedown', this.onGraphContainerMouseDownBound);
    graphContainer.addEventListener('mousemove', this.onGraphContainerMouseMoveBound);
    graphContainer.addEventListener('wheel', this.onGraphContainerWheelBound);
    this.cy.on('add', this.onGraphAddBound);
    this.cy.on('resize', this.onGraphResizeBound);
    this.cy.on('dragfree', this.onGraphDragFreeBound);

    // Mapbox GL container
    this.mapContainer = document.createElement('div');
    this.mapContainer.style.position = 'absolute';
    this.mapContainer.style.top = '0px';
    this.mapContainer.style.left = '0px';
    this.mapContainer.style.width = '100%';
    this.mapContainer.style.height = '100%';
    graphContainer.insertBefore(this.mapContainer, this.cy.renderer().data.canvasContainer);

    // Mapbox GL instance
    this.map = new mapboxgl.Map({
      ...this.mapboxOptions,
      container: this.mapContainer,
    });
    this.fit(undefined, DEFAULT_FIT_PADDING);

    // Mapbox GL events
    this.map.on('move', this.onMapMoveBound);

    // Cytoscape unit viewport
    this.originalZoom = this.cy.zoom();
    this.originalPan = {...this.cy.pan()};

    const zoom = 1;
    const pan = { x: 0, y: 0 };

    if (this.options.animate) {
      this.cy.animate({
        zoom: zoom,
        pan: pan,
      }, {
        duration: this.options.animationDuration ?? DEFAULT_ANIMATION_DURATION,
        easing: 'linear',
      });
    } else {
      this.cy.viewport(
        zoom,
        pan
      );
    }

    // Cytoscape positions
    this.enableGeographicPositions();
  }

  destroy() {
    // Cytoscape events
    const graphContainer = /** @type HTMLElement */ (this.cy.container());
    graphContainer.removeEventListener('mousedown', this.onGraphContainerMouseDownBound);
    graphContainer.removeEventListener('mousemove', this.onGraphContainerMouseMoveBound);
    graphContainer.removeEventListener('wheel', this.onGraphContainerWheelBound);
    this.cy.off('add', this.onGraphAddBound);
    this.cy.off('resize', this.onGraphResizeBound);
    this.cy.off('dragfree', this.onGraphDragFreeBound);

    // Cytoscape config
    this.cy.autoungrabify(this.originalAutoungrabify);
    this.cy.userZoomingEnabled(this.originalUserZoomingEnabled);
    this.cy.userPanningEnabled(this.originalUserPanningEnabled);

    this.originalAutoungrabify = undefined;
    this.originalUserZoomingEnabled = undefined;
    this.originalUserPanningEnabled = undefined;

    // Mapbox GL events
    this.map.off('move', this.onMapMoveBound);

    // Mapbox GL instance
    this.map.remove();
    this.map = undefined;

    // Mapbox GL container
    this.mapContainer.remove();
    this.mapContainer = undefined;

    // Cytoscape unit viewport
    if (this.options.animate) {
      this.cy.animate({
        zoom: this.originalZoom,
        pan: this.originalPan,
      }, {
        duration: this.options.animationDuration ?? DEFAULT_ANIMATION_DURATION,
        easing: 'linear',
      });
    } else {
      this.cy.viewport(
        this.originalZoom,
        this.originalPan
      );
    }

    this.originalZoom = undefined;
    this.originalPan = undefined;

    // Cytoscape positions
    this.disableGeographicPositions();

    this.cy = undefined;
    this.options = undefined;
  }

  /**
   * @param {cytoscape.NodeCollection} nodes
   * @param {number} padding
   */
  fit(nodes = this.cy.nodes(), padding = 0) {
    const bounds = this.getNodeLngLatBounds(nodes);
    if (bounds.isEmpty()) {
      return;
    }

    this.map.fitBounds(bounds, { padding: padding, animate: false });
  }

  /**
   * @private
   */
  enableGeographicPositions() {
    this.originalPositions = Object.fromEntries(this.cy.nodes().map(node => {
      return [node.id(), {...node.position()}];
    }));

    const newPositions = /** @type cytoscape.NodePositionMap */ (Object.fromEntries(this.cy.nodes().map(node => {
      return [node.id(), {...this.getGeographicPosition(node)}];
    })));

    this.cy.layout({
      name: 'preset',
      positions: newPositions,
      fit: false,
      animate: this.options.animate,
      animationDuration: this.options.animationDuration ?? DEFAULT_ANIMATION_DURATION,
      animationEasing: 'ease-out-cubic',
    }).run();
  }

  /**
   * @private
   * @param {cytoscape.NodeCollection} nodes
   */
  updateGeographicPositions(nodes = this.cy.nodes()) {
    // update only positions which have changed, for cytoscape-edgehandles compatibility
    const currentPositions = /** @type cytoscape.NodePositionMap */ (Object.fromEntries(nodes.map(node => {
      return [node.id(), {...node.position()}];
    })));

    const newPositions = /** @type cytoscape.NodePositionMap */ (Object.fromEntries(
      /** @type [string, cytoscape.Position][] */ (nodes.map(node => {
        return [node.id(), {...this.getGeographicPosition(node)}];
      })).filter(([id, position]) => {
        const currentPosition = currentPositions[id];
        return (
          position.x != undefined &&
          position.y != undefined &&
          position.x !== currentPosition.x &&
          position.y !== currentPosition.y
        );
      })
    ));

    this.cy.layout({
      name: 'preset',
      positions: newPositions,
      fit: false,
    }).run();
  }

  /**
   * @private
   */
  disableGeographicPositions() {
    this.cy.layout({
      name: 'preset',
      positions: this.originalPositions,
      fit: false,
      animate: this.options.animate,
      animationDuration: this.options.animationDuration ?? DEFAULT_ANIMATION_DURATION,
      animationEasing: 'ease-in-cubic',
    }).run();

    this.originalPositions = undefined;
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  onGraphContainerMouseDown(event) {
    if (
      event.buttons === 1 &&
      !isMultSelKeyDown(event) &&
      !this.cy.renderer().hoverData.down
    ) {
      this.cy.renderer().hoverData.dragging = true; // cytoscape-lasso compatibility
      this.dispatchMapEvent(event);
    }
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  onGraphContainerMouseMove(event) {
    if (
      event.buttons === 1 &&
      !isMultSelKeyDown(event) &&
      !this.cy.renderer().hoverData.down
    ) {
      this.dispatchMapEvent(event);
    }
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  onGraphContainerWheel(event) {
    this.dispatchMapEvent(event);
  }

  /**
   * @private
   */
  onMapMove() {
    this.updateGeographicPositions();
  }

  /**
   * @private
   * @param {cytoscape.EventObject} event
   */
  onGraphAdd(event) {
    const node = /** @type cytoscape.NodeSingular */ (event.target);

    this.originalPositions[node.id()] = {...node.position()};

    this.updateGeographicPositions([node]);
  }

  /**
   * @private
   */
  onGraphResize() {
    this.map.resize();
  }

  /**
   * @private
   * @param {cytoscape.EventObject} event
   */
  onGraphDragFree(event) {
    const node = /** @type cytoscape.NodeSingular */ (event.target);

    if (this.options.setPosition) {
      const lngLat = this.map.unproject(node.position());
      this.options.setPosition(node, lngLat);
    }

    this.updateGeographicPositions([node]);
  }

  /**
   * @private
   * @param {MouseEvent} event
   */
  dispatchMapEvent(event) {
    if (event.target === this.mapContainer || this.mapContainer.contains(event.target)) {
      return;
    }

    const clonedEvent = new event.constructor(event.type, event);
    this.map.getCanvas().dispatchEvent(clonedEvent);
  }

  /**
   * @private
   * @param {cytoscape.NodeSingular} node
   * @return {mapboxgl.LngLat | undefined}
   */
  getNodeLngLat(node) {
    const lngLatLike = this.options.getPosition(node);
    if (!lngLatLike) {
      return;
    }

    let lngLat;
    try {
      lngLat = mapboxgl.LngLat.convert(lngLatLike);
    } catch (e) {
      return;
    }

    return lngLat;
  }

  /**
   * @private
   * @param {cytoscape.NodeCollection} nodes
   * @return {mapboxgl.LngLatBounds}
   */
  getNodeLngLatBounds(nodes = this.cy.nodes()) {
    const bounds = nodes.reduce((bounds, node) => {
      const lngLat = this.getNodeLngLat(node);
      if (!lngLat) {
        return bounds;
      }

      return bounds.extend(lngLat);
    }, new mapboxgl.LngLatBounds());
    return bounds;
  }

  /**
   * @private
   * @param {cytoscape.NodeSingular} node
   * @return {cytoscape.Position | undefined}
   */
  getGeographicPosition(node) {
    const lngLat = this.getNodeLngLat(node);
    if (!lngLat) {
      return;
    }

    const position = this.map.project(lngLat);
    return position;
  }
}