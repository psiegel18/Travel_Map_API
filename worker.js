/**
 * Travel Map API - Cloudflare Worker v4
 * Added international country support
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    const hasData = url.searchParams.has('work') ||
                    url.searchParams.has('personal') ||
                    url.searchParams.has('prov') ||
                    url.searchParams.has('persCountries') ||
                    url.searchParams.has('workCountries');

    if (!hasData) {
      return new Response(generateUsagePage(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    const workParam = url.searchParams.get('work') || '';
    const personalParam = url.searchParams.get('personal') || '';
    const provParam = url.searchParams.get('prov') || '';
    const provPersParam = url.searchParams.get('provPers') || '';
    const workCountriesParam = url.searchParams.get('workCountries') || '';
    const persCountriesParam = url.searchParams.get('persCountries') || '';
    const workTripsParam = url.searchParams.get('workTrips') || '';
    const persTripsParam = url.searchParams.get('persTrips') || '';
    const title = url.searchParams.get('title') || 'Travel Map';

    const workStates = workParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const personalStates = personalParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const workProvinces = provParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const personalProvinces = provPersParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const workCountries = workCountriesParam.toUpperCase().split(',').filter(s => s.trim().length === 3);
    const personalCountries = persCountriesParam.toUpperCase().split(',').filter(s => s.trim().length === 3);

    // Parse work trip counts
    const workTripCounts = {};
    if (workTripsParam) {
      workTripsParam.split(',').forEach(pair => {
        const [code, count] = pair.split(':');
        if (code && count) {
          workTripCounts[code.toUpperCase().trim()] = parseInt(count, 10) || 0;
        }
      });
    }

    // Parse personal trip counts
    const persTripCounts = {};
    if (persTripsParam) {
      persTripsParam.split(',').forEach(pair => {
        const [code, count] = pair.split(':');
        if (code && count) {
          persTripCounts[code.toUpperCase().trim()] = parseInt(count, 10) || 0;
        }
      });
    }

    // Calculate total trip counts (for shading intensity)
    const totalTripCounts = {};
    for (const code of Object.keys(workTripCounts)) {
      totalTripCounts[code] = (totalTripCounts[code] || 0) + workTripCounts[code];
    }
    for (const code of Object.keys(persTripCounts)) {
      totalTripCounts[code] = (totalTripCounts[code] || 0) + persTripCounts[code];
    }

    const bothStates = workStates.filter(s => personalStates.includes(s));
    const workOnly = workStates.filter(s => !personalStates.includes(s));
    const personalOnly = personalStates.filter(s => !workStates.includes(s));
    const allStates = [...new Set([...workStates, ...personalStates])];
    const allProvinces = [...new Set([...workProvinces, ...personalProvinces])];
    const allCountries = [...new Set([...workCountries, ...personalCountries])];
    const pct = allStates.length > 0 ? Math.round(allStates.length / 50 * 100) : 0;

    const mapHtml = generateMapHtml({
      workStates, personalStates, workProvinces, personalProvinces,
      workCountries, personalCountries,
      workTripCounts, persTripCounts, totalTripCounts,
      bothStates, workOnly, personalOnly, allStates, allProvinces, allCountries, pct, title
    });

    return new Response(mapHtml, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};

function generateMapHtml(data) {
  const {
    workStates, personalStates, workProvinces, personalProvinces,
    workCountries, personalCountries,
    workTripCounts, persTripCounts, totalTripCounts,
    bothStates, workOnly, personalOnly, allStates, allProvinces, allCountries, pct, title
  } = data;

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

  const countryNames = {
    AFG:'Afghanistan',ALB:'Albania',DZA:'Algeria',ARG:'Argentina',AUS:'Australia',
    AUT:'Austria',BHS:'Bahamas',BEL:'Belgium',BLZ:'Belize',BRA:'Brazil',
    BGR:'Bulgaria',KHM:'Cambodia',CHL:'Chile',CHN:'China',COL:'Colombia',
    CRI:'Costa Rica',HRV:'Croatia',CUB:'Cuba',CZE:'Czech Republic',DNK:'Denmark',
    DOM:'Dominican Republic',ECU:'Ecuador',EGY:'Egypt',EST:'Estonia',FIN:'Finland',
    FRA:'France',DEU:'Germany',GRC:'Greece',GTM:'Guatemala',HND:'Honduras',
    HUN:'Hungary',ISL:'Iceland',IND:'India',IDN:'Indonesia',IRL:'Ireland',
    ISR:'Israel',ITA:'Italy',JAM:'Jamaica',JPN:'Japan',KEN:'Kenya',
    LVA:'Latvia',LTU:'Lithuania',LUX:'Luxembourg',MYS:'Malaysia',MEX:'Mexico',
    MAR:'Morocco',NLD:'Netherlands',NZL:'New Zealand',NIC:'Nicaragua',NOR:'Norway',
    PAN:'Panama',PER:'Peru',PHL:'Philippines',POL:'Poland',PRT:'Portugal',
    PRI:'Puerto Rico',ROU:'Romania',RUS:'Russia',SGP:'Singapore',SVK:'Slovakia',
    SVN:'Slovenia',ZAF:'South Africa',KOR:'South Korea',ESP:'Spain',SWE:'Sweden',
    CHE:'Switzerland',TWN:'Taiwan',THA:'Thailand',TUR:'Turkey',GBR:'United Kingdom',
    UKR:'Ukraine',URY:'Uruguay',VAT:'Vatican City',VEN:'Venezuela',VNM:'Vietnam',
    ENG:'England',SCT:'Scotland',WLS:'Wales',NIR:'Northern Ireland'
  };

  const maxTrips = Math.max(1, ...Object.values(totalTripCounts));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      height: 100vh;
      padding: 10px 16px;
    }
    .container { max-width: 1400px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; }
    h1 {
      text-align: center;
      color: #fff;
      font-size: 1.6rem;
      font-weight: 700;
      margin-bottom: 2px;
      text-shadow: 0 2px 15px rgba(0,0,0,0.3);
    }
    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.7);
      font-size: 0.85rem;
      margin-bottom: 10px;
    }
    .legend {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.9);
      font-size: 12px;
      font-weight: 500;
    }
    .legend-swatch {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 2px solid rgba(255,255,255,0.3);
    }
    .swatch-work { background: #ff9800; }
    .swatch-personal { background: #e91e63; }
    .swatch-both { background: #9c27b0; }
    .swatch-unvisited { background: #dfe6e9; }
    .map-container {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    #map { width: 100%; flex: 1; min-height: 0; }
    .stats {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding: 10px 16px;
      background: #f8f9fa;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #555;
    }
    .stat-item { display: flex; align-items: center; gap: 5px; }
    .stat-number { font-size: 1.2rem; font-weight: 700; color: #2d3436; }
    .stat-label { color: #636e72; }
    .stat-work { color: #ff9800; font-weight: 600; }
    .stat-personal { color: #e91e63; font-weight: 600; }
    .stat-both { color: #9c27b0; font-weight: 600; }
    .stat-prov { color: #00bcd4; font-weight: 600; }
    .stat-country { color: #4caf50; font-weight: 600; }
    .stat-divider { width: 1px; height: 18px; background: #ddd; }
    .info-box {
      padding: 8px 12px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      font-size: 12px;
      line-height: 1.4;
      min-width: 160px;
    }
    .info-box h4 { margin: 0 0 3px 0; font-size: 14px; color: #2d3436; font-weight: 600; }
    .info-box .status { font-weight: 600; }
    .info-box .trips { color: #636e72; font-size: 11px; margin-top: 2px; }
    .info-box .trip-breakdown { font-size: 10px; color: #888; margin-top: 2px; }
    .info-box .trip-work { color: #ff9800; }
    .info-box .trip-personal { color: #e91e63; }
    .leaflet-container { background: #b8d4e8; font-family: inherit; }
    .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.8) !important; }
    @media (max-width: 768px) {
      body { padding: 8px; }
      h1 { font-size: 1.3rem; }
      .legend { gap: 8px; }
      .legend-item { font-size: 10px; }
      .stats { gap: 8px; font-size: 11px; padding: 8px; }
      .stat-number { font-size: 1rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
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
        ${allProvinces.length > 0 ? `<div class="stat-divider"></div><span class="stat-prov">${allProvinces.length} province${allProvinces.length > 1 ? 's' : ''}</span>` : ''}
        ${allCountries.length > 0 ? `<div class="stat-divider"></div><span class="stat-country">${allCountries.length} ${allCountries.length > 1 ? 'countries' : 'country'}</span>` : ''}
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvinces)};
    const personalProvinces = ${JSON.stringify(personalProvinces)};
    const workCountries = ${JSON.stringify(workCountries)};
    const personalCountries = ${JSON.stringify(personalCountries)};
    const workTripCounts = ${JSON.stringify(workTripCounts)};
    const persTripCounts = ${JSON.stringify(persTripCounts)};
    const totalTripCounts = ${JSON.stringify(totalTripCounts)};
    const stateNames = ${JSON.stringify(stateNames)};
    const provNames = ${JSON.stringify(provNames)};
    const countryNames = ${JSON.stringify(countryNames)};
    const maxTrips = ${maxTrips};

    // Province name to code mapping for the Canada GeoJSON (codeforamerica uses full names)
    const provNameToCode = {
      'Alberta': 'AB',
      'British Columbia': 'BC',
      'Manitoba': 'MB',
      'New Brunswick': 'NB',
      'Newfoundland and Labrador': 'NL',
      'Nova Scotia': 'NS',
      'Northwest Territories': 'NT',
      'Nunavut': 'NU',
      'Ontario': 'ON',
      'Prince Edward Island': 'PE',
      'Quebec': 'QC',
      'Saskatchewan': 'SK',
      'Yukon': 'YT',
      'Yukon Territory': 'YT'
    };

    const fipsToState = {
      "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
      "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
      "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
      "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
      "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
      "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
      "54":"WV","55":"WI","56":"WY"
    };

    const map = L.map('map', { center: [44, -98], zoom: 4, minZoom: 2, maxZoom: 10 });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Create panes for proper z-ordering (lower zIndex = behind)
    const countriesPane = map.createPane('countries');
    countriesPane.style.zIndex = 400;
    
    const statesPane = map.createPane('states');
    statesPane.style.zIndex = 450;
    
    const provincesPane = map.createPane('provinces');
    provincesPane.style.zIndex = 450;

    const labelsPane = map.createPane('labels');
    labelsPane.style.zIndex = 650;
    labelsPane.style.pointerEvents = 'none';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20, pane: 'labels'
    }).addTo(map);

    function getProvinceCode(props) {
      if (props.name && provNameToCode[props.name]) {
        return provNameToCode[props.name];
      }
      if (props.iso_3166_2) {
        return props.iso_3166_2.replace('CA-', '');
      }
      if (props.postal) {
        return props.postal.toUpperCase();
      }
      return null;
    }

    function getCountryCode(props, featureId) {
      // Natural Earth map_units uses GU_A3 (3-letter geo unit code)
      if (props.GU_A3) {
        return props.GU_A3.toUpperCase();
      }
      // johan/world.geo.json uses feature id
      if (featureId && typeof featureId === 'string' && featureId.length === 3) {
        return featureId.toUpperCase();
      }
      // datasets/geo-countries uses ISO3166-1-Alpha-3
      var code = props['ISO3166-1-Alpha-3'];
      if (code) {
        return code.toUpperCase();
      }
      // Natural Earth GeoJSON uses ISO_A3 or ADM0_A3
      if (props.ISO_A3 && props.ISO_A3 !== '-99') {
        return props.ISO_A3.toUpperCase();
      }
      if (props.ADM0_A3) {
        return props.ADM0_A3.toUpperCase();
      }
      if (props.iso_a3 && props.iso_a3 !== '-99') {
        return props.iso_a3.toUpperCase();
      }
      return null;
    }

    function getCategory(code, locationType) {
      if (locationType === 'country') {
        const inWork = workCountries.includes(code);
        const inPers = personalCountries.includes(code);
        if (inWork && inPers) return 'both';
        if (inWork) return 'work';
        if (inPers) return 'personal';
        return 'unvisited';
      }
      if (locationType === 'province') {
        const inWork = workProvinces.includes(code);
        const inPers = personalProvinces.includes(code);
        if (inWork && inPers) return 'both';
        if (inWork) return 'work';
        if (inPers) return 'personal';
        return 'unvisited';
      }
      // Default: state
      const inWork = workStates.includes(code);
      const inPers = personalStates.includes(code);
      if (inWork && inPers) return 'both';
      if (inWork) return 'work';
      if (inPers) return 'personal';
      return 'unvisited';
    }

    function getColor(category, count) {
      const minOp = 0.5, maxOp = 1.0;
      const opacity = count > 0 ? minOp + (Math.min(count, maxTrips) / maxTrips) * (maxOp - minOp) : 1.0;
      switch(category) {
        case 'work': return { color: '#ff9800', opacity };
        case 'personal': return { color: '#e91e63', opacity };
        case 'both': return { color: '#9c27b0', opacity };
        default: return { color: '#dfe6e9', opacity: 0.7 };
      }
    }

    function styleState(feature) {
      const code = fipsToState[feature.id] || feature.properties.STUSPS || feature.properties.postal || '';
      const category = getCategory(code, 'state');
      const count = totalTripCounts[code] || 0;
      const { color, opacity } = getColor(category, count);
      return { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
    }

    function styleProvince(feature) {
      const code = getProvinceCode(feature.properties);
      const category = getCategory(code, 'province');
      const count = totalTripCounts[code] || 0;
      const { color, opacity } = getColor(category, count);
      return { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
    }

    function styleCountry(feature) {
      const code = getCountryCode(feature.properties, feature.id);
      const category = getCategory(code, 'country');
      // Unvisited countries get minimal styling
      if (category === 'unvisited') {
        return { fillColor: '#dfe6e9', fillOpacity: 0.3, weight: 0.5, opacity: 0.3, color: '#ccc' };
      }
      const count = totalTripCounts[code] || 0;
      const { color, opacity } = getColor(category, count);
      return { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
    }

    function highlightFeature(e) {
      const code = e.target.locationCode;
      const type = e.target.locationType;
      // Don't highlight USA/Canada country outlines
      if (type === 'country' && (code === 'USA' || code === 'CAN')) return;
      e.target.setStyle({ weight: 3, color: '#333', fillOpacity: 0.9 });
      e.target.bringToFront();
      info.update(e.target.feature, e.target.locationType);
    }

    function resetHighlight(e, layer) { layer.resetStyle(e.target); info.update(); }

    const info = L.control({ position: 'topright' });
    info.onAdd = function() {
      this._div = L.DomUtil.create('div', 'info-box');
      this.update();
      return this._div;
    };
    info.update = function(feature, locationType) {
      if (!feature) {
        this._div.innerHTML = '<h4>Hover over a state</h4><div class="trips">to see details</div>';
        return;
      }
      const props = feature.properties || {};
      const featureId = feature.id;
      let code, name;
      
      // Detect location type - check for country first, then province, then state
      var detectedType = locationType;
      if (!detectedType) {
        // Check for Natural Earth map_units GU_A3
        if (props.GU_A3) {
          detectedType = 'country';
        // Check if feature.id is a 3-letter country code
        } else if (featureId && typeof featureId === 'string' && featureId.length === 3) {
          detectedType = 'country';
        } else if (props['ISO3166-1-Alpha-3'] || props.ISO_A3 || props.ADM0_A3) {
          detectedType = 'country';
        } else if (props.name && provNameToCode[props.name]) {
          detectedType = 'province';
        } else {
          detectedType = 'state';
        }
      }
      
      if (detectedType === 'country') {
        code = getCountryCode(props, featureId);
        name = countryNames[code] || props.GEOUNIT || props.NAME || props.name || props.ADMIN || code;
      } else if (detectedType === 'province') {
        code = getProvinceCode(props);
        name = provNames[code] || props.name || code;
      } else {
        code = fipsToState[feature.id] || props.STUSPS || props.postal || '';
        name = stateNames[code] || props.name || props.NAME || code;
      }
      const category = getCategory(code, detectedType);
      const workCount = workTripCounts[code] || 0;
      const persCount = persTripCounts[code] || 0;
      const totalCount = totalTripCounts[code] || 0;
      
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
        html += '<div class="trips">' + totalCount + ' trip' + (totalCount > 1 ? 's' : '') + ' total</div>';
        
        // Show breakdown if there are trips
        if (workCount > 0 || persCount > 0) {
          html += '<div class="trip-breakdown">';
          if (workCount > 0) {
            html += '<span class="trip-work">' + workCount + ' work</span>';
          }
          if (workCount > 0 && persCount > 0) {
            html += ' · ';
          }
          if (persCount > 0) {
            html += '<span class="trip-personal">' + persCount + ' personal</span>';
          }
          html += '</div>';
        }
      }
      
      this._div.innerHTML = html;
    };
    info.addTo(map);

    // Fetch countries (Natural Earth map_units - includes UK subdivisions)
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_map_units.geojson')
      .then(r => r.json())
      .then(data => {
        // Filter out USA and Canada entirely - they're handled with states/provinces
        data.features = data.features.filter(f => {
          const code = getCountryCode(f.properties, f.id);
          return code !== 'USA' && code !== 'CAN';
        });
        
        const layer = L.geoJson(data, {
          style: function(feature) {
            return styleCountry(feature);
          },
          pane: 'countries',
          onEachFeature: (f, l) => {
            const code = getCountryCode(f.properties, f.id);
            l.locationType = 'country';
            l.locationCode = code;
            // Only make visited countries interactive
            const category = getCategory(code, 'country');
            if (category !== 'unvisited') {
              l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
            }
          }
        }).addTo(map);
      })
      .catch(err => console.error('Error loading countries:', err));

    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJson(data, {
          style: styleState,
          pane: 'states',
          onEachFeature: (f, l) => {
            const code = fipsToState[f.id] || f.properties.STUSPS || '';
            l.locationType = 'state';
            l.locationCode = code;
            l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
          }
        }).addTo(map);
      });

    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJson(data, {
          style: styleProvince,
          pane: 'provinces',
          onEachFeature: (f, l) => {
            const code = getProvinceCode(f.properties);
            l.locationType = 'province';
            l.locationCode = code;
            l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
          }
        }).addTo(map);
      });
  </script>
</body>
</html>`;
}

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
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 10px; }
    .subtitle { color: rgba(255,255,255,0.7); font-size: 1.1rem; margin-bottom: 30px; }
    .card { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    h2 { font-size: 1.3rem; margin-bottom: 12px; color: #4fc3f7; }
    p { line-height: 1.6; margin-bottom: 12px; color: rgba(255,255,255,0.85); }
    code { background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em; }
    pre { background: rgba(0,0,0,0.4); padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; font-size: 0.85em; }
    pre code { padding: 0; background: none; }
    .param-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .param-table th, .param-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .param-table th { color: #4fc3f7; font-weight: 600; }
    .param-table td code { color: #81c784; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Travel Map API</h1>
    <p class="subtitle">Generate interactive travel maps via URL parameters</p>

    <div class="card">
      <h2>Quick Example</h2>
      <pre><code>https://travelmap.psiegel.org/?work=NY,CA,TX&amp;personal=OH,HI&amp;workTrips=NY:40,CA:9&amp;persTrips=OH:3,HI:2</code></pre>
    </div>

    <div class="card">
      <h2>URL Parameters</h2>
      <table class="param-table">
        <tr><th>Parameter</th><th>Description</th><th>Example</th></tr>
        <tr><td><code>work</code></td><td>States visited for work</td><td>NY,CA,TX,FL</td></tr>
        <tr><td><code>personal</code></td><td>States visited personally</td><td>OH,HI,MI</td></tr>
        <tr><td><code>prov</code></td><td>Canadian provinces (work)</td><td>ON,BC,NL</td></tr>
        <tr><td><code>provPers</code></td><td>Canadian provinces (personal)</td><td>QC,AB</td></tr>
        <tr><td><code>workTrips</code></td><td>Work trip counts</td><td>NY:40,CA:9,TX:17</td></tr>
        <tr><td><code>persTrips</code></td><td>Personal trip counts</td><td>OH:3,HI:2,MI:1</td></tr>
        <tr><td><code>title</code></td><td>Custom map title</td><td>My Travel Map</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Features</h2>
      <p>• Accurate US state and Canadian province borders using Leaflet + GeoJSON</p>
      <p>• Color coding: Work (orange), Personal (pink), Both (purple)</p>
      <p>• Intensity shading based on total trip count</p>
      <p>• Hover tooltip shows work/personal trip breakdown</p>
      <p>• Interactive zoom on click</p>
    </div>
  </div>
</body>
</html>`;
}
