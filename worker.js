/**
 * Travel Map API - Cloudflare Worker
 * Dynamic map generator that fetches trip data from MediaWiki pages
 *
 * Usage:
 *   ?wiki=https://wiki.example.com/wiki/My_Travel_Page
 *
 * For embedding in MediaWiki:
 *   <iframe src="https://travelmap.psiegel.org/?wiki=..." width="100%" height="650"></iframe>
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const wikiUrl = url.searchParams.get('wiki');

    // If no wiki URL provided, show usage instructions
    if (!wikiUrl) {
      return new Response(generateUsagePage(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    try {
      // Fetch the wiki page
      const wikiResponse = await fetch(wikiUrl, {
        headers: {
          'User-Agent': 'TravelMapAPI/1.0',
          'Accept': 'text/html'
        }
      });

      if (!wikiResponse.ok) {
        throw new Error(`Failed to fetch wiki page: ${wikiResponse.status}`);
      }

      const wikiHtml = await wikiResponse.text();

      // Parse trip data from wiki HTML
      const tripData = parseWikiTripData(wikiHtml);

      // Generate the map HTML
      const mapHtml = generateMapHtml(tripData);

      return new Response(mapHtml, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300' // 5 min cache for dynamic data
        }
      });

    } catch (error) {
      return new Response(generateErrorPage(error.message), {
        status: 500,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }
  }
};

/**
 * Parse trip data from MediaWiki HTML
 */
function parseWikiTripData(html) {
  const workTrips = {};
  const personalTrips = {};
  const workProvinces = {};

  // US State code pattern: ", XX" at end of string or ", XX," or state names
  const statePattern = /,\s*([A-Z]{2})(?:\s*$|,|\s*<)/g;
  const provincePattern = /,\s*([A-Z]{2})\s*,\s*Canada/gi;

  // State name to code mapping for full names
  const stateNameToCode = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
  };

  // Valid US state codes
  const validStateCodes = new Set(Object.values(stateNameToCode));

  // Canadian province codes
  const validProvinceCodes = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

  /**
   * Extract state code from a location string
   */
  function extractStateCode(text) {
    if (!text) return null;

    // Check for Canadian province first
    const provMatch = text.match(/,\s*([A-Z]{2})\s*,\s*Canada/i);
    if (provMatch && validProvinceCodes.has(provMatch[1].toUpperCase())) {
      return { code: provMatch[1].toUpperCase(), isProvince: true };
    }

    // Look for state code pattern ", XX"
    const matches = text.match(/,\s*([A-Z]{2})(?:\s*$|[^a-zA-Z])/);
    if (matches && validStateCodes.has(matches[1])) {
      return { code: matches[1], isProvince: false };
    }

    // Try to find state name
    const lowerText = text.toLowerCase();
    for (const [name, code] of Object.entries(stateNameToCode)) {
      if (lowerText.includes(name)) {
        return { code, isProvince: false };
      }
    }

    return null;
  }

  /**
   * Extract date from text
   */
  function extractDate(text) {
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[1]}-${match[2]}`;
    }
    return null;
  }

  /**
   * Parse a table and extract trip data
   */
  function parseTable(tableHtml, type) {
    const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      // Skip header rows
      if (row.includes('<th')) continue;

      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length < 2) continue;

      // Strip HTML tags from cells
      const cleanCells = cells.map(cell =>
        cell.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
      );

      let locationText = '';
      let dateText = '';
      let tripInfo = {};

      if (type === 'golive' || type === 'immersion') {
        // Format: Customer | Dates | Location | Nearest Major City
        // Use "Nearest Major City" (last column) for state
        locationText = cleanCells[cleanCells.length - 1] || cleanCells[2] || '';
        dateText = cleanCells[1] || '';
        tripInfo = { customer: cleanCells[0], type: type === 'golive' ? 'Go-Live' : 'Immersion' };
      } else if (type === 'adhoc') {
        // Format: Customer | Trip | Dates | Location
        locationText = cleanCells[3] || '';
        dateText = cleanCells[2] || '';
        tripInfo = { customer: cleanCells[0], trip: cleanCells[1], type: 'Ad Hoc' };
      } else if (type === 'customer') {
        // Customer trips don't have location - we need to get it from section context
        // For now, skip these as they don't have state info in the table
        dateText = cleanCells[1] || '';
        tripInfo = { trip: cleanCells[0], type: 'Customer Project' };
        continue; // Skip for now - no location data in table
      } else if (type === 'personal') {
        // Format: Destination | Dates
        locationText = cleanCells[0] || '';
        dateText = cleanCells[1] || '';
        tripInfo = { destination: cleanCells[0], type: 'Personal' };
      }

      const stateInfo = extractStateCode(locationText);
      const date = extractDate(dateText);

      if (stateInfo && date) {
        const tripRecord = { date, ...tripInfo, location: locationText };

        if (type === 'personal') {
          if (!personalTrips[stateInfo.code]) {
            personalTrips[stateInfo.code] = [];
          }
          personalTrips[stateInfo.code].push(tripRecord);
        } else {
          if (stateInfo.isProvince) {
            if (!workProvinces[stateInfo.code]) {
              workProvinces[stateInfo.code] = [];
            }
            workProvinces[stateInfo.code].push(tripRecord);
          } else {
            if (!workTrips[stateInfo.code]) {
              workTrips[stateInfo.code] = [];
            }
            workTrips[stateInfo.code].push(tripRecord);
          }
        }
      }
    }
  }

  // Find and parse Go-Live tables
  const goliveTables = html.match(/<table[^>]*class="[^"]*golive-table[^"]*"[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const table of goliveTables) {
    parseTable(table, 'golive');
  }

  // Find and parse Immersion tables
  const immersionTables = html.match(/<table[^>]*class="[^"]*immersion-table[^"]*"[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const table of immersionTables) {
    parseTable(table, 'immersion');
  }

  // Find and parse Ad Hoc tables
  const adhocTables = html.match(/<table[^>]*class="[^"]*adhoc-trip-table[^"]*"[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const table of adhocTables) {
    parseTable(table, 'adhoc');
  }

  // Find and parse Personal trips tables
  const personalTables = html.match(/<table[^>]*class="[^"]*personal-trips-table[^"]*"[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const table of personalTables) {
    parseTable(table, 'personal');
  }

  return { workTrips, personalTrips, workProvinces };
}

/**
 * Generate the map HTML with parsed trip data
 */
function generateMapHtml(tripData) {
  const { workTrips, personalTrips, workProvinces } = tripData;

  // Calculate statistics
  const workStates = Object.keys(workTrips);
  const personalStates = Object.keys(personalTrips);
  const workProvList = Object.keys(workProvinces);

  const bothStates = workStates.filter(s => personalStates.includes(s));
  const workOnly = workStates.filter(s => !personalStates.includes(s));
  const personalOnly = personalStates.filter(s => !workStates.includes(s));

  const allStatesSet = new Set([...workStates, ...personalStates]);
  const allStates = Array.from(allStatesSet);
  const pct = allStates.length > 0 ? Math.round(allStates.length / 50 * 100) : 0;

  // Trip counts per state
  const tripCounts = {};
  for (const [state, trips] of Object.entries(workTrips)) {
    tripCounts[state] = (tripCounts[state] || 0) + trips.length;
  }
  for (const [state, trips] of Object.entries(personalTrips)) {
    tripCounts[state] = (tripCounts[state] || 0) + trips.length;
  }

  const provTripCounts = {};
  for (const [prov, trips] of Object.entries(workProvinces)) {
    provTripCounts[prov] = trips.length;
  }

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

  // Calculate max trips for shading
  const maxTrips = Math.max(1, ...Object.values(tripCounts), ...Object.values(provTripCounts));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travel Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      padding: 16px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      color: #fff;
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 4px;
      text-shadow: 0 2px 15px rgba(0,0,0,0.3);
    }

    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.7);
      font-size: 0.9rem;
      margin-bottom: 16px;
    }

    .legend {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.9);
      font-size: 13px;
      font-weight: 500;
    }

    .legend-swatch {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 2px solid rgba(255,255,255,0.3);
    }

    .swatch-work { background: #ff9800; }
    .swatch-personal { background: #e91e63; }
    .swatch-both { background: linear-gradient(135deg, #ff9800 50%, #e91e63 50%); }
    .swatch-unvisited { background: #dfe6e9; }

    .map-container {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }

    #map {
      width: 100%;
      height: 520px;
    }

    .stats {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 14px 16px;
      background: #f8f9fa;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #555;
    }

    .stat-item { display: flex; align-items: center; gap: 5px; }
    .stat-number { font-size: 1.3rem; font-weight: 700; color: #2d3436; }
    .stat-label { color: #636e72; }
    .stat-work { color: #ff9800; font-weight: 600; }
    .stat-personal { color: #e91e63; font-weight: 600; }
    .stat-both { color: #9c27b0; font-weight: 600; }
    .stat-prov { color: #00bcd4; font-weight: 600; }
    .stat-divider { width: 1px; height: 20px; background: #ddd; }

    .info-box {
      padding: 10px 14px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      font-size: 13px;
      line-height: 1.5;
      min-width: 180px;
    }

    .info-box h4 { margin: 0 0 4px 0; font-size: 15px; color: #2d3436; font-weight: 600; }
    .info-box .status { font-weight: 600; }
    .info-box .trips { color: #636e72; font-size: 12px; margin-top: 3px; }
    .info-box .trip-breakdown { font-size: 11px; color: #888; margin-top: 2px; }

    .leaflet-container { background: #b8d4e8; font-family: inherit; }
    .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.8) !important; }

    @media (max-width: 768px) {
      body { padding: 10px; }
      h1 { font-size: 1.4rem; }
      .legend { gap: 10px; }
      .legend-item { font-size: 11px; }
      #map { height: 400px; }
      .stats { gap: 10px; font-size: 12px; padding: 10px; }
      .stat-number { font-size: 1.1rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Travel Map</h1>
    <p class="subtitle">United States & Canada</p>

    <div class="legend">
      <div class="legend-item"><span class="legend-swatch swatch-work"></span> Work</div>
      <div class="legend-item"><span class="legend-swatch swatch-personal"></span> Personal</div>
      <div class="legend-item"><span class="legend-swatch swatch-both"></span> Both</div>
      <div class="legend-item"><span class="legend-swatch swatch-unvisited"></span> Not Visited</div>
    </div>

    <div class="map-container">
      <div id="map"></div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">${allStates.length}</span>
          <span class="stat-label">/ 50 states (${pct}%)</span>
        </div>
        <div class="stat-divider"></div>
        <span class="stat-work">${workOnly.length} work</span>
        <div class="stat-divider"></div>
        <span class="stat-personal">${personalOnly.length} personal</span>
        <div class="stat-divider"></div>
        <span class="stat-both">${bothStates.length} both</span>
        ${workProvList.length > 0 ? `<div class="stat-divider"></div><span class="stat-prov">${workProvList.length} province${workProvList.length > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvList)};
    const tripCounts = ${JSON.stringify(tripCounts)};
    const provTripCounts = ${JSON.stringify(provTripCounts)};
    const workTrips = ${JSON.stringify(workTrips)};
    const personalTrips = ${JSON.stringify(personalTrips)};
    const stateNames = ${JSON.stringify(stateNames)};
    const provNames = ${JSON.stringify(provNames)};
    const maxTrips = ${maxTrips};

    const fipsToState = {
      "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
      "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
      "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
      "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
      "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
      "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
      "54":"WV","55":"WI","56":"WY"
    };

    const map = L.map('map', { center: [44, -98], zoom: 4, minZoom: 3, maxZoom: 10 });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const labelsPane = map.createPane('labels');
    labelsPane.style.zIndex = 650;
    labelsPane.style.pointerEvents = 'none';

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      pane: 'labels'
    }).addTo(map);

    function getStateCategory(code) {
      const inWork = workStates.includes(code);
      const inPersonal = personalStates.includes(code);
      if (inWork && inPersonal) return 'both';
      if (inWork) return 'work';
      if (inPersonal) return 'personal';
      return 'unvisited';
    }

    function getProvCategory(code) {
      return workProvinces.includes(code) ? 'work' : 'unvisited';
    }

    function getColor(category, count) {
      const minOpacity = 0.5;
      const maxOpacity = 1.0;
      const opacity = count > 0 ? minOpacity + (Math.min(count, maxTrips) / maxTrips) * (maxOpacity - minOpacity) : 1.0;

      switch(category) {
        case 'work': return { color: '#ff9800', opacity };
        case 'personal': return { color: '#e91e63', opacity };
        case 'both': return { color: '#9c27b0', opacity };
        default: return { color: '#dfe6e9', opacity: 0.7 };
      }
    }

    function style(feature, isProvince = false) {
      let code;
      if (isProvince) {
        code = feature.properties.iso_3166_2?.replace('CA-', '') ||
               feature.properties.postal ||
               feature.properties.name?.substring(0,2).toUpperCase();
      } else {
        code = fipsToState[feature.id] || feature.properties.STUSPS || feature.properties.postal || '';
      }

      const category = isProvince ? getProvCategory(code) : getStateCategory(code);
      const count = isProvince ? (provTripCounts[code] || 0) : (tripCounts[code] || 0);
      const { color, opacity } = getColor(category, count);

      return { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
    }

    function highlightFeature(e) {
      e.target.setStyle({ weight: 3, color: '#333', fillOpacity: 0.9 });
      e.target.bringToFront();
      info.update(e.target.feature.properties, e.target.options.isProvince);
    }

    function resetHighlight(e, layer) {
      layer.resetStyle(e.target);
      info.update();
    }

    const info = L.control({ position: 'topright' });

    info.onAdd = function() {
      this._div = L.DomUtil.create('div', 'info-box');
      this.update();
      return this._div;
    };

    info.update = function(props, isProvince = false) {
      if (!props) {
        this._div.innerHTML = '<h4>Hover over a state</h4><div class="trips">to see trip details</div>';
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

      const category = isProvince ? getProvCategory(code) : getStateCategory(code);
      const workCount = workTrips[code]?.length || 0;
      const persCount = personalTrips[code]?.length || 0;
      const totalCount = workCount + persCount;

      let statusText, statusColor;
      switch(category) {
        case 'work': statusText = 'Work'; statusColor = '#ff9800'; break;
        case 'personal': statusText = 'Personal'; statusColor = '#e91e63'; break;
        case 'both': statusText = 'Work + Personal'; statusColor = '#9c27b0'; break;
        default: statusText = 'Not visited'; statusColor = '#999';
      }

      let html = '<h4>' + name + '</h4>';
      html += '<div class="status" style="color:' + statusColor + '">' + statusText + '</div>';
      if (totalCount > 0) {
        html += '<div class="trips">' + totalCount + ' trip' + (totalCount > 1 ? 's' : '') + '</div>';
        if (workCount > 0 && persCount > 0) {
          html += '<div class="trip-breakdown">' + workCount + ' work, ' + persCount + ' personal</div>';
        }
      }
      this._div.innerHTML = html;
    };

    info.addTo(map);

    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(r => r.json())
      .then(data => {
        const statesLayer = L.geoJson(data, {
          style: f => style(f, false),
          onEachFeature: (f, layer) => {
            layer.options.isProvince = false;
            layer.on({
              mouseover: highlightFeature,
              mouseout: e => resetHighlight(e, statesLayer),
              click: e => map.fitBounds(e.target.getBounds())
            });
          }
        }).addTo(map);
      });

    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(r => r.json())
      .then(data => {
        const provLayer = L.geoJson(data, {
          style: f => style(f, true),
          onEachFeature: (f, layer) => {
            layer.options.isProvince = true;
            layer.on({
              mouseover: highlightFeature,
              mouseout: e => resetHighlight(e, provLayer),
              click: e => map.fitBounds(e.target.getBounds())
            });
          }
        }).addTo(map);
      });
  </script>
</body>
</html>`;
}

/**
 * Generate usage instructions page
 */
function generateUsagePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travel Map API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      padding: 40px 20px;
      color: #fff;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .subtitle { color: rgba(255,255,255,0.7); font-size: 1.1rem; margin-bottom: 30px; }
    .card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }
    h2 { font-size: 1.3rem; margin-bottom: 12px; color: #4fc3f7; }
    p { line-height: 1.6; margin-bottom: 12px; color: rgba(255,255,255,0.85); }
    code {
      background: rgba(0,0,0,0.3);
      padding: 3px 8px;
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.9em;
    }
    pre {
      background: rgba(0,0,0,0.4);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code { padding: 0; background: none; }
    .table-info { margin: 16px 0; }
    .table-info li { margin: 8px 0; color: rgba(255,255,255,0.8); }
    .table-info code { color: #81c784; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Travel Map API</h1>
    <p class="subtitle">Generate interactive travel maps from MediaWiki pages</p>

    <div class="card">
      <h2>Usage</h2>
      <p>Pass your wiki page URL as a parameter:</p>
      <pre><code>https://travelmap.psiegel.org/?wiki=YOUR_WIKI_URL</code></pre>
    </div>

    <div class="card">
      <h2>Embed in MediaWiki</h2>
      <p>Add this HTML to your wiki page:</p>
      <pre><code>&lt;html&gt;
&lt;iframe
  src="https://travelmap.psiegel.org/?wiki=https://your-wiki.com/wiki/Your_Page"
  width="100%"
  height="650"
  style="border:none; border-radius:12px;"
&gt;&lt;/iframe&gt;
&lt;/html&gt;</code></pre>
    </div>

    <div class="card">
      <h2>Supported Table Classes</h2>
      <p>The API parses these table types from your wiki:</p>
      <ul class="table-info">
        <li><code>.golive-table</code> - Go-Live trips (work)</li>
        <li><code>.immersion-table</code> - Immersion/training trips (work)</li>
        <li><code>.adhoc-trip-table</code> - Ad-hoc customer trips (work)</li>
        <li><code>.personal-trips-table</code> - Personal travel</li>
      </ul>
      <p>Tables must include a location column with state codes (e.g., "Charlotte, NC").</p>
    </div>

    <div class="card">
      <h2>Features</h2>
      <ul class="table-info">
        <li>Accurate US state and Canadian province borders</li>
        <li>Color coding: Work (orange), Personal (pink), Both (purple)</li>
        <li>Intensity shading based on trip count</li>
        <li>Hover tooltips with trip details</li>
        <li>Interactive zoom and pan</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate error page
 */
function generateErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Travel Map API</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      padding: 20px;
    }
    .error-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      text-align: center;
    }
    h1 { color: #ef5350; margin-bottom: 16px; }
    p { color: rgba(255,255,255,0.8); line-height: 1.6; }
    code {
      display: block;
      background: rgba(0,0,0,0.3);
      padding: 12px;
      border-radius: 6px;
      margin-top: 16px;
      font-size: 0.9em;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <h1>Error</h1>
    <p>Failed to generate the travel map.</p>
    <code>${message}</code>
  </div>
</body>
</html>`;
}
