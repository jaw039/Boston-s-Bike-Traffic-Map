// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Check that Mapbox GL JS is loaded
console.log("Mapbox GL JS Loaded:", mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiamF3MDM5IiwiYSI6ImNtN2dqdmowcTE0cHYyc3Eza3cxbWttcGIifQ.9qKvnD-6PjD8s8CuQhd7Sg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/light-v11', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

// Define a reusable style object for bike lanes
const bikeLayerStyle = {
    'line-color': '#32D400',  // Bright green for bike lanes
    'line-width': 2.5,        // Consistent line width
    'line-opacity': 0.8       // Consistent opacity
};

// Load the map data
map.on("load", () => {
    // Add Boston bike lanes source and layer
    map.addSource("boston_route", {
        type: "geojson",
        data: "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson"
    });

    // Add Cambridge bike lanes source and layer
    map.addSource("cambridge_route", {
        type: "geojson",
        data: "https://data.cambridgema.gov/api/geospatial/rkht-haa3?method=export&format=GeoJSON"
    });

    // Add Boston bike lanes layer
    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: bikeLayerStyle  // Use the reusable style
    });

    // Add Cambridge bike lanes layer
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLayerStyle  // Use the same style for consistency
    });
});