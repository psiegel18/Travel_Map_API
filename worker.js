/**
 * Travel Map API - Cloudflare Worker
 * Renders travel maps from URL parameters (for internal wiki embedding)
 *
 * Usage:
 *   ?work=NY,CA,TX&personal=OH,HI&prov=NL&trips=NY:40,CA:9,TX:17
 *
 * Parameters:
 *   work     - Comma-separated state codes visited for work
 *   personal - Comma-separated state codes visited personally
 *   prov     - Comma-separated Canadian province codes (work)
 *   provPers - Comma-separated Canadian province codes (personal)
 *   trips    - Trip counts as STATE:COUNT pairs (e.g., NY:40,CA:9)
 *   title    - Optional custom title for the map
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Check if any data parameters provided
    const hasData = url.searchParams.has('work') ||
                    url.searchParams.has('personal') ||
                    url.searchParams.has('prov');

    if (!hasData) {
      return new Response(generateUsagePage(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Parse parameters
    const workParam = url.searchParams.get('work') || '';
    const personalParam = url.searchParams.get('personal') || '';
    const provParam = url.searchParams.get('prov') || '';
    const provPersParam = url.searchParams.get('provPers') || '';
    const tripsParam = url.searchParams.get('trips') || '';
    const title = url.searchParams.get('title') || 'Travel Map';

    // Parse state lists
    const workStates = workParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const personalStates = personalParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const workProvinces = provParam.toUpperCase().split(',').filter(s => s.trim().length === 2);
    const personalProvinces = provPersParam.toUpperCase().split(',').filter(s => s.trim().length === 2);

    // Parse trip counts: "NY:40,CA:9,TX:17"
    const tripCounts = {};
    if (tripsParam) {
      tripsParam.split(',').forEach(pair => {
        const [code, count] = pair.split(':');
        if (code && count) {
          tripCounts[code.toUpperCase().trim()] = parseInt(count, 10) || 1;
        }
      });
    }

    // Calculate statistics
    const bothStates = workStates.filter(s => personalStates.includes(s));
    const workOnly = workStates.filter(s => !personalStates.includes(s));
    const personalOnly = personalStates.filter(s => !workStates.includes(s));
    const allStates = [...new Set([...workStates, ...personalStates])];
    const allProvinces = [...new Set([...workProvinces, ...personalProvinces])];
    const pct = allStates.length > 0 ? Math.round(allStates.length / 50 * 100) : 0;

    // Generate map HTML
    const mapHtml = generateMapHtml({
      workStates,
      personalStates,
      workProvinces,
      personalProvinces,
      tripCounts,
      bothStates,
      workOnly,
      personalOnly,
      allStates,
      allProvinces,
      pct,
      title
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
    tripCounts, bothStates, workOnly, personalOnly, allStates, allProvinces, pct, title
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

  const maxTrips = Math.max(1, ...Object.values(tripCounts));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      padding: 16px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
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
    #map { width: 100%; height: 520px; }
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
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvinces)};
    const personalProvinces = ${JSON.stringify(personalProvinces)};
    const tripCounts = ${JSON.stringify(tripCounts)};
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
      subdomains: 'abcd', maxZoom: 20, pane: 'labels'
    }).addTo(map);

    function getCategory(code, isProvince) {
      if (isProvince) {
        const inWork = workProvinces.includes(code);
        const inPers = personalProvinces.includes(code);
        if (inWork && inPers) return 'both';
        if (inWork) return 'work';
        if (inPers) return 'personal';
        return 'unvisited';
      }
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

    function style(feature, isProvince) {
      let code;
      if (isProvince) {
        code = feature.properties.iso_3166_2?.replace('CA-', '') ||
               feature.properties.postal || feature.properties.name?.substring(0,2).toUpperCase();
      } else {
        code = fipsToState[feature.id] || feature.properties.STUSPS || feature.properties.postal || '';
      }
      const category = getCategory(code, isProvince);
      const count = tripCounts[code] || 0;
      const { color, opacity } = getColor(category, count);
      return { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
    }

    function highlightFeature(e) {
      e.target.setStyle({ weight: 3, color: '#333', fillOpacity: 0.9 });
      e.target.bringToFront();
      info.update(e.target.feature.properties, e.target.options.isProvince);
    }

    function resetHighlight(e, layer) { layer.resetStyle(e.target); info.update(); }

    const info = L.control({ position: 'topright' });
    info.onAdd = function() {
      this._div = L.DomUtil.create('div', 'info-box');
      this.update();
      return this._div;
    };
    info.update = function(props, isProvince) {
      if (!props) {
        this._div.innerHTML = '<h4>Hover over a state</h4><div class="trips">to see details</div>';
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
      const category = getCategory(code, isProvince);
      const count = tripCounts[code] || 0;
      let statusText, statusColor;
      switch(category) {
        case 'work': statusText = 'Work'; statusColor = '#ff9800'; break;
        case 'personal': statusText = 'Personal'; statusColor = '#e91e63'; break;
        case 'both': statusText = 'Work + Personal'; statusColor = '#9c27b0'; break;
        default: statusText = 'Not visited'; statusColor = '#999';
      }
      let html = '<h4>' + name + '</h4>';
      html += '<div class="status" style="color:' + statusColor + '">' + statusText + '</div>';
      if (count > 0) html += '<div class="trips">' + count + ' trip' + (count > 1 ? 's' : '') + '</div>';
      this._div.innerHTML = html;
    };
    info.addTo(map);

    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJson(data, {
          style: f => style(f, false),
          onEachFeature: (f, l) => {
            l.options.isProvince = false;
            l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
          }
        }).addTo(map);
      });

    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(r => r.json())
      .then(data => {
        const layer = L.geoJson(data, {
          style: f => style(f, true),
          onEachFeature: (f, l) => {
            l.options.isProvince = true;
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
      <pre><code>https://travelmap.psiegel.org/?work=NY,CA,TX&personal=OH,HI&trips=NY:40,CA:9</code></pre>
    </div>

    <div class="card">
      <h2>URL Parameters</h2>
      <table class="param-table">
        <tr><th>Parameter</th><th>Description</th><th>Example</th></tr>
        <tr><td><code>work</code></td><td>States visited for work</td><td>NY,CA,TX,FL</td></tr>
        <tr><td><code>personal</code></td><td>States visited personally</td><td>OH,HI,MI</td></tr>
        <tr><td><code>prov</code></td><td>Canadian provinces (work)</td><td>ON,BC,NL</td></tr>
        <tr><td><code>provPers</code></td><td>Canadian provinces (personal)</td><td>QC,AB</td></tr>
        <tr><td><code>trips</code></td><td>Trip counts (for shading)</td><td>NY:40,CA:9,TX:17</td></tr>
        <tr><td><code>title</code></td><td>Custom map title</td><td>My Travel Map</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Embed in MediaWiki</h2>
      <p>Add this to your wiki page where you want the map. The script parses your trip tables automatically:</p>
      <pre><code>&lt;html&gt;
&lt;div id="travel-map-container"&gt;&lt;/div&gt;
&lt;script&gt;
(function() {
  var stateCodes = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);
  var provCodes = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']);

  function extractLoc(text) {
    if (!text) return null;
    var prov = text.match(/,\\s*([A-Z]{2})\\s*,\\s*Canada/i);
    if (prov && provCodes.has(prov[1].toUpperCase())) return { code: prov[1].toUpperCase(), isProv: true };
    var st = text.match(/,\\s*([A-Z]{2})(?:\\s*$|[^a-zA-Z])/);
    if (st && stateCodes.has(st[1])) return { code: st[1], isProv: false };
    return null;
  }

  var work = {}, personal = {}, provs = {};

  // Parse work tables (golive, immersion, adhoc)
  document.querySelectorAll('.golive-table tr, .immersion-table tr').forEach(function(r) {
    var c = r.querySelectorAll('td');
    if (c.length >= 4) {
      var res = extractLoc(c[c.length-1].textContent);
      if (res) { if (res.isProv) provs[res.code] = (provs[res.code]||0)+1; else work[res.code] = (work[res.code]||0)+1; }
    }
  });
  document.querySelectorAll('.adhoc-trip-table tr').forEach(function(r) {
    var c = r.querySelectorAll('td');
    if (c.length >= 4) {
      var res = extractLoc(c[3].textContent);
      if (res && !res.isProv) work[res.code] = (work[res.code]||0)+1;
    }
  });

  // Parse personal trips
  document.querySelectorAll('.personal-trips-table tr').forEach(function(r) {
    var c = r.querySelectorAll('td');
    if (c.length >= 1) {
      var res = extractLoc(c[0].textContent);
      if (res && !res.isProv) personal[res.code] = (personal[res.code]||0)+1;
    }
  });

  // Build URL
  var p = [], trips = {};
  if (Object.keys(work).length) p.push('work=' + Object.keys(work).join(','));
  if (Object.keys(personal).length) p.push('personal=' + Object.keys(personal).join(','));
  if (Object.keys(provs).length) p.push('prov=' + Object.keys(provs).join(','));
  for (var s in work) trips[s] = (trips[s]||0) + work[s];
  for (var s in personal) trips[s] = (trips[s]||0) + personal[s];
  for (var s in provs) trips[s] = (trips[s]||0) + provs[s];
  var tp = []; for (var k in trips) tp.push(k+':'+trips[k]);
  if (tp.length) p.push('trips=' + tp.join(','));
  p.push('title=' + encodeURIComponent("Preston's Travel Map"));

  var iframe = document.createElement('iframe');
  iframe.src = 'https://travelmap.psiegel.org/?' + p.join('&amp;');
  iframe.style.cssText = 'width:100%;height:650px;border:none;border-radius:12px;';
  document.getElementById('travel-map-container').appendChild(iframe);
})();
&lt;/script&gt;
&lt;/html&gt;</code></pre>
    </div>

    <div class="card">
      <h2>Features</h2>
      <p>• Accurate US state and Canadian province borders using Leaflet + GeoJSON</p>
      <p>• Color coding: Work (orange), Personal (pink), Both (purple)</p>
      <p>• Intensity shading based on trip count</p>
      <p>• Interactive hover tooltips and zoom</p>
    </div>
  </div>
</body>
</html>`;
}
