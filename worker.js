/**
 * Travel Map - Cloudflare Worker
 * Professional map using Leaflet.js with accurate GeoJSON boundaries
 *
 * Deployed to: https://travelmap.psiegel.org/
 *
 * Usage:
 *   ?work=NY,CA,TX&personal=OH,HI&prov=ON,BC
 *   ?trips=NY:5,CA:3,TX:1  (for trip count shading)
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Parse parameters
    const workParam = url.searchParams.get('work') || '';
    const persParam = url.searchParams.get('personal') || '';
    const provParam = url.searchParams.get('prov') || '';
    const tripsParam = url.searchParams.get('trips') || '';

    // Parse state lists
    const workStates = workParam.toUpperCase().split(',').filter(s => s.trim().length > 0);
    const personalStates = persParam.toUpperCase().split(',').filter(s => s.trim().length > 0);
    const workProvinces = provParam.toUpperCase().split(',').filter(s => s.trim().length > 0);

    // Parse trip counts: "NY:5,CA:3,TX:1"
    const tripCounts = {};
    if (tripsParam) {
      tripsParam.split(',').forEach(pair => {
        const [state, count] = pair.split(':');
        if (state && count) {
          tripCounts[state.toUpperCase().trim()] = parseInt(count, 10) || 1;
        }
      });
    }

    // Calculate statistics
    const allStatesSet = new Set([...workStates, ...personalStates]);
    const allStates = Array.from(allStatesSet);
    const bothStates = workStates.filter(s => personalStates.includes(s));
    const workOnly = workStates.filter(s => !personalStates.includes(s));
    const personalOnly = personalStates.filter(s => !workStates.includes(s));
    const pct = allStates.length > 0 ? Math.round(allStates.length / 50 * 100) : 0;

    // State name mappings
    const stateNames = {
      AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
      CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
      IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
      ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
      MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
      NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
      OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
      TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
      WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington D.C.'
    };

    const provNames = {
      AB:'Alberta',BC:'British Columbia',MB:'Manitoba',NB:'New Brunswick',
      NL:'Newfoundland and Labrador',NS:'Nova Scotia',NT:'Northwest Territories',
      NU:'Nunavut',ON:'Ontario',PE:'Prince Edward Island',QC:'Quebec',SK:'Saskatchewan',YT:'Yukon'
    };

    // State to FIPS code mapping (needed for GeoJSON matching)
    const stateToFips = {
      AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',FL:'12',GA:'13',
      HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
      MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',
      NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
      SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',DC:'11'
    };

    // Reverse mapping
    const fipsToState = Object.fromEntries(Object.entries(stateToFips).map(([k, v]) => [v, k]));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preston's Travel Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      color: white;
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 8px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.85);
      font-size: 0.95rem;
      margin-bottom: 20px;
    }

    .legend {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
    }

    .legend-swatch {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,0.5);
    }

    .swatch-work { background: #ff9800; }
    .swatch-personal { background: #e91e63; }
    .swatch-both { background: linear-gradient(135deg, #ff9800 50%, #e91e63 50%); }
    .swatch-unvisited { background: #e8e8e8; }

    .map-container {
      background: white;
      border-radius: 16px;
      padding: 0;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      overflow: hidden;
    }

    #map {
      width: 100%;
      height: 600px;
    }

    .stats {
      text-align: center;
      padding: 16px;
      background: rgba(255,255,255,0.95);
      border-top: 1px solid #eee;
      font-size: 15px;
      color: #444;
    }

    .stats strong { color: #222; font-weight: 700; }
    .stat-work { color: #ff9800; font-weight: 600; }
    .stat-personal { color: #e91e63; font-weight: 600; }
    .stat-both { color: #9c27b0; font-weight: 600; }
    .stat-prov { color: #2196f3; font-weight: 600; }

    .info-box {
      padding: 8px 12px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      font-size: 14px;
      line-height: 1.5;
    }

    .info-box h4 {
      margin: 0 0 4px 0;
      font-size: 15px;
      color: #333;
    }

    .info-box .status {
      font-weight: 600;
    }

    .info-box .trips {
      color: #666;
      font-size: 13px;
    }

    /* Leaflet customizations */
    .leaflet-container {
      background: #b3d1ff;
      font-family: inherit;
    }

    .leaflet-control-attribution {
      font-size: 10px;
    }

    @media (max-width: 768px) {
      body { padding: 12px; }
      h1 { font-size: 1.5rem; }
      .legend { gap: 12px; }
      .legend-item { font-size: 12px; }
      #map { height: 450px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Preston's Travel Map</h1>
    <p class="subtitle">United States & Canada</p>

    <div class="legend">
      <div class="legend-item"><span class="legend-swatch swatch-work"></span> Work</div>
      <div class="legend-item"><span class="legend-swatch swatch-personal"></span> Personal</div>
      <div class="legend-item"><span class="legend-swatch swatch-both"></span> Both</div>
      <div class="legend-item"><span class="legend-swatch swatch-unvisited"></span> Not Yet Visited</div>
    </div>

    <div class="map-container">
      <div id="map"></div>
      <div class="stats">
        <strong>${allStates.length}</strong>/50 states (${pct}%) &bull;
        <span class="stat-work">${workOnly.length} work</span> &bull;
        <span class="stat-personal">${personalOnly.length} personal</span> &bull;
        <span class="stat-both">${bothStates.length} both</span>
        ${workProvinces.length > 0 ? ` &bull; <span class="stat-prov">${workProvinces.length} province${workProvinces.length > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>

  <script>
    // Data from server
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvinces)};
    const tripCounts = ${JSON.stringify(tripCounts)};

    const stateNames = ${JSON.stringify(stateNames)};
    const provNames = ${JSON.stringify(provNames)};
    const fipsToState = ${JSON.stringify(fipsToState)};

    // Initialize map centered on North America
    const map = L.map('map', {
      center: [45, -98],
      zoom: 4,
      minZoom: 3,
      maxZoom: 8,
      zoomControl: true
    });

    // Use CartoDB Positron for a clean, minimal look (free, no API key needed)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Add labels layer on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'shadowPane'
    }).addTo(map);

    // Color functions
    function getStateCategory(stateCode) {
      const inWork = workStates.includes(stateCode);
      const inPersonal = personalStates.includes(stateCode);
      if (inWork && inPersonal) return 'both';
      if (inWork) return 'work';
      if (inPersonal) return 'personal';
      return 'unvisited';
    }

    function getProvinceCategory(provCode) {
      return workProvinces.includes(provCode) ? 'work' : 'unvisited';
    }

    // Get color with intensity based on trip count
    function getColor(category, tripCount = 0) {
      const maxTrips = Math.max(10, ...Object.values(tripCounts));
      const intensity = tripCount > 0 ? Math.min(1, 0.4 + (tripCount / maxTrips) * 0.6) : 1;

      switch(category) {
        case 'work': return \`rgba(255, 152, 0, \${intensity})\`;
        case 'personal': return \`rgba(233, 30, 99, \${intensity})\`;
        case 'both': return \`rgba(156, 39, 176, \${intensity})\`;
        default: return '#e8e8e8';
      }
    }

    function getFillOpacity(category, tripCount = 0) {
      if (category === 'unvisited') return 0.6;
      if (tripCount > 0) {
        const maxTrips = Math.max(10, ...Object.values(tripCounts));
        return 0.5 + (tripCount / maxTrips) * 0.4;
      }
      return 0.7;
    }

    function style(feature, isProvince = false) {
      const code = isProvince
        ? feature.properties.iso_3166_2?.replace('CA-', '') || feature.properties.name?.substring(0,2).toUpperCase()
        : fipsToState[feature.id] || feature.properties.STUSPS || feature.properties.postal;

      const category = isProvince ? getProvinceCategory(code) : getStateCategory(code);
      const trips = tripCounts[code] || 0;

      return {
        fillColor: getColor(category, trips),
        weight: 1.5,
        opacity: 1,
        color: '#666',
        fillOpacity: getFillOpacity(category, trips)
      };
    }

    function highlightFeature(e) {
      const layer = e.target;
      layer.setStyle({
        weight: 3,
        color: '#333',
        fillOpacity: 0.85
      });
      layer.bringToFront();
      info.update(layer.feature.properties, layer.options.isProvince);
    }

    function resetHighlight(e, geojsonLayer) {
      geojsonLayer.resetStyle(e.target);
      info.update();
    }

    // Info control
    const info = L.control({ position: 'topright' });

    info.onAdd = function(map) {
      this._div = L.DomUtil.create('div', 'info-box');
      this.update();
      return this._div;
    };

    info.update = function(props, isProvince = false) {
      if (!props) {
        this._div.innerHTML = '<h4>Hover over a state</h4>';
        return;
      }

      let code, name;
      if (isProvince) {
        code = props.iso_3166_2?.replace('CA-', '') || props.postal || props.name?.substring(0,2).toUpperCase();
        name = provNames[code] || props.name || code;
      } else {
        code = fipsToState[props.STATE] || props.STUSPS || props.postal || '';
        name = stateNames[code] || props.name || props.NAME || code;
      }

      const category = isProvince ? getProvinceCategory(code) : getStateCategory(code);
      const trips = tripCounts[code] || 0;

      let statusText = '';
      let statusColor = '#666';
      switch(category) {
        case 'work': statusText = 'Work'; statusColor = '#ff9800'; break;
        case 'personal': statusText = 'Personal'; statusColor = '#e91e63'; break;
        case 'both': statusText = 'Work + Personal'; statusColor = '#9c27b0'; break;
        default: statusText = 'Not visited'; statusColor = '#999';
      }

      this._div.innerHTML = '<h4>' + name + '</h4>' +
        '<span class="status" style="color:' + statusColor + '">' + statusText + '</span>' +
        (trips > 0 ? '<br><span class="trips">' + trips + ' trip' + (trips > 1 ? 's' : '') + '</span>' : '');
    };

    info.addTo(map);

    // Load US States GeoJSON
    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(response => response.json())
      .then(data => {
        const statesLayer = L.geoJson(data, {
          style: (feature) => style(feature, false),
          onEachFeature: function(feature, layer) {
            layer.options.isProvince = false;
            layer.on({
              mouseover: highlightFeature,
              mouseout: (e) => resetHighlight(e, statesLayer),
              click: function(e) {
                map.fitBounds(e.target.getBounds());
              }
            });
          }
        }).addTo(map);
      });

    // Load Canadian Provinces GeoJSON
    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(response => response.json())
      .then(data => {
        const provLayer = L.geoJson(data, {
          style: (feature) => style(feature, true),
          onEachFeature: function(feature, layer) {
            layer.options.isProvince = true;
            layer.on({
              mouseover: highlightFeature,
              mouseout: (e) => resetHighlight(e, provLayer),
              click: function(e) {
                map.fitBounds(e.target.getBounds());
              }
            });
          }
        }).addTo(map);
      });
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
