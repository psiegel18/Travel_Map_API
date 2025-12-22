// Cloudflare Worker for Travel Map
// Deploy to: https://travelmap.psiegel.org/

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  // Parse parameters
  const workStates = params.get('work') ? params.get('work').split(',') : [];
  const personalStates = params.get('personal') ? params.get('personal').split(',') : [];
  const provinces = params.get('prov') ? params.get('prov').split(',') : [];
  const persCountries = params.get('persCountries') ? params.get('persCountries').split(',') : [];
  const workCountries = params.get('workCountries') ? params.get('workCountries').split(',') : [];
  
  // Future states/provinces/countries (for hatching)
  const workFuture = params.get('workFuture') ? params.get('workFuture').split(',') : [];
  const personalFuture = params.get('personalFuture') ? params.get('personalFuture').split(',') : [];
  const provFuture = params.get('provFuture') ? params.get('provFuture').split(',') : [];
  const persCountriesFuture = params.get('persCountriesFuture') ? params.get('persCountriesFuture').split(',') : [];
  
  // Trip counts (state:count format)
  const workTrips = parseTripCounts(params.get('workTrips'));
  const persTrips = parseTripCounts(params.get('persTrips'));
  const workTripsFuture = parseTripCounts(params.get('workTripsFuture'));
  const persTripsFuture = parseTripCounts(params.get('persTripsFuture'));
  
  const title = params.get('title') || 'Travel Map';

  const html = generateHTML({
    workStates, personalStates, provinces, persCountries, workCountries,
    workFuture, personalFuture, provFuture, persCountriesFuture,
    workTrips, persTrips, workTripsFuture, persTripsFuture,
    title
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function parseTripCounts(tripString) {
  if (!tripString) return {};
  const counts = {};
  tripString.split(',').forEach(part => {
    const [code, count] = part.split(':');
    if (code && count) {
      counts[code] = parseInt(count, 10);
    }
  });
  return counts;
}

function generateHTML(data) {
  const {
    workStates, personalStates, provinces, persCountries, workCountries,
    workFuture, personalFuture, provFuture, persCountriesFuture,
    workTrips, persTrips, workTripsFuture, persTripsFuture,
    title
  } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 15px;
    }
    h1 {
      text-align: center;
      color: #fff;
      font-size: 1.8em;
      margin-bottom: 15px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    #map {
      height: 480px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      border: 2px solid rgba(255,255,255,0.1);
    }
    .legend {
      display: flex;
      justify-content: center;
      gap: 25px;
      margin-top: 15px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      font-size: 0.9em;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid rgba(255,255,255,0.3);
    }
    .legend-color.hatched {
      background: repeating-linear-gradient(
        45deg,
        #ff9800,
        #ff9800 3px,
        transparent 3px,
        transparent 6px
      );
      opacity: 0.7;
    }
    .work-color { background-color: #ff9800; }
    .personal-color { background-color: #e91e63; }
    .both-color { background-color: #9c27b0; }
    .work-future { background-color: #ff9800; }
    .personal-future { background-color: #e91e63; }
    .has-upcoming {
      position: relative;
      overflow: hidden;
    }
    .has-upcoming::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 8px;
      height: 8px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 0 3px rgba(0,0,0,0.5);
    }
    .future-only-state {
      fill-opacity: 0.3;
    }
    .leaflet-interactive.future-only-state {
      stroke-dasharray: none !important;
    }
    .info-box {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 8px;
      padding: 10px 15px;
      color: #fff;
      font-size: 0.85em;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 8px;
    }
    .popup-content {
      font-size: 14px;
    }
    .popup-content strong {
      font-size: 16px;
    }
    .popup-work { color: #e65100; }
    .popup-personal { color: #c2185b; }
    .popup-future { font-style: italic; opacity: 0.8; }
    .trip-tooltip {
      background: rgba(255,255,255,0.95);
      border: none;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      padding: 6px 10px;
      font-size: 13px;
    }
    .trip-tooltip strong {
      font-size: 14px;
      color: #333;
    }
    .trip-tooltip em {
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <div id="map"></div>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-color work-color"></div>
        <span>Work Travel</span>
      </div>
      <div class="legend-item">
        <div class="legend-color personal-color"></div>
        <span>Personal Travel</span>
      </div>
      <div class="legend-item">
        <div class="legend-color both-color"></div>
        <span>Both</span>
      </div>
      <div class="legend-item">
        <div class="legend-color work-color" style="border: 3px dashed #333;"></div>
        <span>+ Upcoming</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background-color: #ff9800; opacity: 0.35;"></div>
        <span>Future Only</span>
      </div>
    </div>
  </div>

  <script>
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const provinces = ${JSON.stringify(provinces)};
    const persCountries = ${JSON.stringify(persCountries)};
    const workCountries = ${JSON.stringify(workCountries)};
    const workFuture = ${JSON.stringify(workFuture)};
    const personalFuture = ${JSON.stringify(personalFuture)};
    const provFuture = ${JSON.stringify(provFuture)};
    const persCountriesFuture = ${JSON.stringify(persCountriesFuture)};
    const workTrips = ${JSON.stringify(workTrips)};
    const persTrips = ${JSON.stringify(persTrips)};
    const workTripsFuture = ${JSON.stringify(workTripsFuture)};
    const persTripsFuture = ${JSON.stringify(persTripsFuture)};

    // Initialize map
    const map = L.map('map', {
      center: [39.8, -98.5],
      zoom: 4,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Create SVG pattern for hatching (future trips)
    const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgDefs.setAttribute('width', '0');
    svgDefs.setAttribute('height', '0');
    svgDefs.innerHTML = \`
      <defs>
        <pattern id="hatch-work" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#ff9800" fill-opacity="0.4"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#fff" stroke-width="2" stroke-opacity="0.5"/>
        </pattern>
        <pattern id="hatch-personal" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#e91e63" fill-opacity="0.4"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#fff" stroke-width="2" stroke-opacity="0.5"/>
        </pattern>
      </defs>
    \`;
    document.body.appendChild(svgDefs);

    function getStateStyle(stateCode) {
      // Calculate actual past trips (total minus future)
      const workTotal = workTrips[stateCode] || 0;
      const workFutureCount = workTripsFuture[stateCode] || 0;
      const workPastCount = workTotal - workFutureCount;
      
      const persTotal = persTrips[stateCode] || 0;
      const persFutureCount = persTripsFuture[stateCode] || 0;
      const persPastCount = persTotal - persFutureCount;
      
      const hasPastWork = workPastCount > 0;
      const hasPastPersonal = persPastCount > 0;
      const hasPast = hasPastWork || hasPastPersonal;
      
      const hasFutureWork = workFutureCount > 0;
      const hasFuturePersonal = persFutureCount > 0;
      const hasFuture = hasFutureWork || hasFuturePersonal;
      
      // Only future (no past trips) - show with stripes pattern
      if (!hasPast && hasFuture) {
        const futureColor = hasFutureWork ? '#ff9800' : '#e91e63';
        return { 
          color: futureColor, 
          weight: 2, 
          fillColor: futureColor, 
          fillOpacity: 0.25,
          className: 'future-only-state'
        };
      }
      
      // Has past trips - determine base style
      let baseStyle = { color: '#fff', weight: 2, fillOpacity: 0.7 };
      
      if (hasPastWork && hasPastPersonal) {
        baseStyle.fillColor = '#9c27b0';
      } else if (hasPastWork) {
        baseStyle.fillColor = '#ff9800';
      } else if (hasPastPersonal) {
        baseStyle.fillColor = '#e91e63';
      } else {
        // No trips at all
        return { color: '#888', weight: 1, fillColor: '#e0e0e0', fillOpacity: 0.3 };
      }
      
      // If has future trips too, add dashed border indicator
      if (hasFuture) {
        baseStyle.weight = 4;
        baseStyle.dashArray = '8,4';
        baseStyle.color = '#333';
      }
      
      return baseStyle;
    }

    function getCountryStyle(countryCode) {
      // Calculate actual past trips (total minus future)
      const workTotal = workTrips[countryCode] || 0;
      const workFutureCount = workTripsFuture[countryCode] || 0;
      const workPastCount = workTotal - workFutureCount;
      
      const persTotal = persTrips[countryCode] || 0;
      const persFutureCount = persTripsFuture[countryCode] || 0;
      const persPastCount = persTotal - persFutureCount;
      
      const hasPastWork = workPastCount > 0;
      const hasPastPersonal = persPastCount > 0;
      const hasPast = hasPastWork || hasPastPersonal;
      
      const hasFuture = persFutureCount > 0;
      
      // Only future (no past trips)
      if (!hasPast && hasFuture) {
        return { 
          color: '#e91e63', 
          weight: 2, 
          fillColor: '#e91e63', 
          fillOpacity: 0.25,
          className: 'future-only-state'
        };
      }
      
      // Has past trips
      let baseStyle = { color: '#fff', weight: 2, fillOpacity: 0.7 };
      
      if (hasPastWork && hasPastPersonal) {
        baseStyle.fillColor = '#9c27b0';
      } else if (hasPastWork) {
        baseStyle.fillColor = '#ff9800';
      } else if (hasPastPersonal) {
        baseStyle.fillColor = '#e91e63';
      } else {
        return null;
      }
      
      // If has future trips too, add dashed border
      if (hasFuture) {
        baseStyle.weight = 4;
        baseStyle.dashArray = '8,4';
        baseStyle.color = '#333';
      }
      
      return baseStyle;
    }

    function buildTooltip(code, name) {
      const workTotal = workTrips[code] || 0;
      const workFutureCount = workTripsFuture[code] || 0;
      const workPastCount = workTotal - workFutureCount;
      
      const persTotal = persTrips[code] || 0;
      const persFutureCount = persTripsFuture[code] || 0;
      const persPastCount = persTotal - persFutureCount;
      
      const totalPast = workPastCount + persPastCount;
      const totalFuture = workFutureCount + persFutureCount;
      
      let text = '<strong>' + name + '</strong>';
      if (totalPast > 0) {
        text += '<br>' + totalPast + ' trip' + (totalPast > 1 ? 's' : '');
      }
      if (totalFuture > 0) {
        text += '<br><em>+' + totalFuture + ' upcoming</em>';
      }
      return text;
    }

    function buildPopup(code, name) {
      let html = '<div class="popup-content"><strong>' + name + '</strong>';
      
      const workTotal = workTrips[code] || 0;
      const workFutureCount = workTripsFuture[code] || 0;
      const workPastCount = workTotal - workFutureCount;
      
      const persTotal = persTrips[code] || 0;
      const persFutureCount = persTripsFuture[code] || 0;
      const persPastCount = persTotal - persFutureCount;
      
      if (workPastCount > 0) {
        html += '<br><span class="popup-work">Work: ' + workPastCount + ' trip' + (workPastCount > 1 ? 's' : '') + '</span>';
      }
      if (workFutureCount > 0) {
        html += '<br><span class="popup-work popup-future">Work (upcoming): ' + workFutureCount + ' trip' + (workFutureCount > 1 ? 's' : '') + '</span>';
      }
      if (persPastCount > 0) {
        html += '<br><span class="popup-personal">Personal: ' + persPastCount + ' trip' + (persPastCount > 1 ? 's' : '') + '</span>';
      }
      if (persFutureCount > 0) {
        html += '<br><span class="popup-personal popup-future">Personal (upcoming): ' + persFutureCount + ' trip' + (persFutureCount > 1 ? 's' : '') + '</span>';
      }
      
      html += '</div>';
      return html;
    }

    // Load US States GeoJSON
    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(response => response.json())
      .then(data => {
        L.geoJSON(data, {
          style: function(feature) {
            const stateCode = stateNameToCode[feature.properties.name];
            return getStateStyle(stateCode);
          },
          onEachFeature: function(feature, layer) {
            const stateCode = stateNameToCode[feature.properties.name];
            const hasTrips = (workTrips[stateCode] || 0) > 0 || (persTrips[stateCode] || 0) > 0;
            if (hasTrips) {
              layer.bindTooltip(buildTooltip(stateCode, feature.properties.name), {
                permanent: false,
                direction: 'auto',
                className: 'trip-tooltip'
              });
              layer.bindPopup(buildPopup(stateCode, feature.properties.name));
            }
          }
        }).addTo(map);
      });

    // Load Canadian Provinces GeoJSON
    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(response => response.json())
      .then(data => {
        L.geoJSON(data, {
          style: function(feature) {
            const provCode = provNameToCode[feature.properties.name];
            return getStateStyle(provCode);
          },
          onEachFeature: function(feature, layer) {
            const provCode = provNameToCode[feature.properties.name];
            const hasTrips = (workTrips[provCode] || 0) > 0 || (persTrips[provCode] || 0) > 0;
            if (hasTrips) {
              layer.bindTooltip(buildTooltip(provCode, feature.properties.name), {
                permanent: false,
                direction: 'auto',
                className: 'trip-tooltip'
              });
              layer.bindPopup(buildPopup(provCode, feature.properties.name));
            }
          }
        }).addTo(map);
      });

    // Load World Countries GeoJSON (for international travel)
    const allCountries = [...new Set([...persCountries, ...workCountries, ...persCountriesFuture])];
    if (allCountries.length > 0) {
      fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(data => {
          L.geoJSON(data, {
            style: function(feature) {
              const countryCode = feature.properties.ISO_A3;
              const style = getCountryStyle(countryCode);
              return style || { fillOpacity: 0, weight: 0 };
            },
            filter: function(feature) {
              const code = feature.properties.ISO_A3;
              return allCountries.includes(code);
            },
            onEachFeature: function(feature, layer) {
              const code = feature.properties.ISO_A3;
              layer.bindTooltip(buildTooltip(code, feature.properties.ADMIN), {
                permanent: false,
                direction: 'auto',
                className: 'trip-tooltip'
              });
              layer.bindPopup(buildPopup(code, feature.properties.ADMIN));
            }
          }).addTo(map);
        });
    }

    // State name to code mapping
    const stateNameToCode = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
      'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
      'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
      'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
      'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
      'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
      'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
      'District of Columbia': 'DC'
    };

    // Province name to code mapping
    const provNameToCode = {
      'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
      'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Northwest Territories': 'NT',
      'Nunavut': 'NU', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC',
      'Saskatchewan': 'SK', 'Yukon': 'YT'
    };
  </script>
</body>
</html>`;
}
