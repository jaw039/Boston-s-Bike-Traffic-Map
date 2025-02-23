// Import D3 as an ESM module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Helper function to format minutes since midnight as HH:MM AM/PM
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Function to compute minutes since midnight for a date
function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

// Function to filter trips by time
function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1 
        ? trips // If no filter is applied (-1), return all trips
        : trips.filter((trip) => {
            // Convert trip start and end times to minutes since midnight
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            
            // Include trips that started or ended within 60 minutes of the selected time
            return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
            );
        });
}

// Function to compute station traffic
function computeStationTraffic(stations, trips) {
    // Calculate departures
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
    );

    // Calculate arrivals
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
    );

    // Update each station with traffic data
    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiamF3MDM5IiwiYSI6ImNtN2dqdmowcTE0cHYyc3Eza3cxbWttcGIifQ.9qKvnD-6PjD8s8CuQhd7Sg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
});

// Helper function to convert coordinates
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

// Define bike lane style
const bikeLayerStyle = {
    'line-color': '#32D400',
    'line-width': 2.5,
    'line-opacity': 0.8
};

// Load the map data
map.on("load", async () => {
    // Create SVG overlay after map loads
    d3.select('#map')
        .append('svg')
        .style('position', 'absolute')
        .style('z-index', 1)
        .style('width', '100%')
        .style('height', '100%');

    // Add bike lanes
    map.addSource("boston_route", {
        type: "geojson",
        data: "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson"
    });

    map.addSource("cambridge_route", {
        type: "geojson",
        data: "https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson"
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: bikeLayerStyle
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLayerStyle
    });

    try {
        // Load station data
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const jsonData = await d3.json(jsonurl);
        let stations = jsonData.data.stations;

        // Load and parse trip data
        const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        const trips = await d3.csv(csvUrl, (trip) => {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);
            return trip;
        });

        // Initial station traffic computation
        stations = computeStationTraffic(stations, trips);

        // Create radius scale after computing traffic
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, d => d.totalTraffic)])
            .range([0, 25]);

        // Create station flow scale
        let stationFlow = d3.scaleQuantize()
            .domain([0, 1])
            .range([0, 0.5, 1]);

        // Select the SVG element
        const svg = d3.select('#map').select('svg');

        // Create circles
        const circles = svg.selectAll('circle')
            .data(stations, d => d.short_name)
            .enter()
            .append('circle')
            .attr('r', d => radiusScale(d.totalTraffic))
            .attr('fill', 'steelblue')  // Base fill; CSS variable will override it.
            .attr('fill-opacity', 0.6)
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('class', 'station-marker')
            .each(function(d) {
                d3.select(this)
                    .append('title')
                    .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            })
            // Set the CSS variable based on traffic flow ratio.
            .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

        // Update circle positions
        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)
                .attr('cy', d => getCoords(d).cy);
        }

        // Initial position update
        updatePositions();

        // Update on map interactions
        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        // Time filter setup
        const timeSlider = document.getElementById('time-slider');
        const selectedTime = document.getElementById('time-display');
        const anyTimeLabel = document.getElementById('any-time');

        function updateScatterPlot(timeFilter) {
            // Filter trips and recompute station traffic
            const filteredTrips = filterTripsbyTime(trips, timeFilter);
            const filteredStations = computeStationTraffic(stations, filteredTrips);
            
            // Adjust circle sizes based on filter (optional)
            timeFilter === -1
              ? radiusScale.range([0, 25])
              : radiusScale.range([3, 50]);
            
            // Update circles and update color based on departures ratio
            circles
                .data(filteredStations, d => d.short_name)
                .join('circle')
                .attr('r', d => radiusScale(d.totalTraffic))
                .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));
        }

        function updateTimeDisplay() {
            let timeFilter = Number(timeSlider.value);

            if (timeFilter === -1) {
                selectedTime.style.display = 'none';
                anyTimeLabel.style.display = 'block';
            } else {
                selectedTime.style.display = 'block';
                selectedTime.textContent = formatTime(timeFilter);
                anyTimeLabel.style.display = 'none';
            }
            
            updateScatterPlot(timeFilter);
        }

        // Bind time slider events
        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();

    } catch (error) {
        console.error('Error loading data:', error);
    }
});