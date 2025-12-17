/**
 * Preston's Travel Map - Cloudflare Worker
 * Professional map using Leaflet.js with accurate GeoJSON boundaries
 *
 * Deployed to: https://travelmap.psiegel.org/
 * Data source: Wiki Travel @ Epic: Master List
 */

export default {
  async fetch(request) {
    // ============================================
    // TRIP DATA - Extracted from Wiki
    // ============================================

    // Work trips by state (Go-Lives, Customer Trips, Immersion)
    const workTrips = {
      // Go-Live Floor Support
      NC: [
        { date: '2022-08-07', type: 'Go-Live', customer: 'Atrium Health', city: 'Charlotte' },
        { date: '2025-08-07', type: 'Go-Live CC', customer: 'NC DHHS', city: 'Raleigh' },
        { date: '2025-02-17', type: 'Customer', customer: 'CarolinaEast', city: 'New Bern' },
      ],
      GA: [
        { date: '2022-09-30', type: 'Go-Live', customer: 'Emory Healthcare', city: 'Atlanta' },
      ],
      WI: [
        { date: '2022-10-21', type: 'Go-Live', customer: 'Ascension Health', city: 'Appleton' },
      ],
      OK: [
        { date: '2023-06-02', type: 'Go-Live', customer: 'OU Health', city: 'Oklahoma City' },
        { date: '2025-04-09', type: 'Go-Live', customer: 'Choctaw Nation', city: 'Durant' },
      ],
      OR: [
        { date: '2024-04-15', type: 'Go-Live', customer: 'Kaiser Permanente', city: 'Portland' },
      ],
      MA: [
        { date: '2024-06-07', type: 'Go-Live', customer: 'Beth Israel Lahey', city: 'Boston' },
      ],
      TX: [
        { date: '2024-10-09', type: 'Go-Live', customer: 'Memorial Hermann', city: 'Houston' },
        { date: '2025-01-13', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-02-03', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-03-03', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-03-31', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-04-21', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-07-07', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-08-03', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-09-08', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-09-29', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-10-20', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-11-17', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2025-12-15', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2026-01-19', type: 'Customer', customer: 'UMC Health', city: 'Lubbock' },
        { date: '2026-02-19', type: 'Go-Live CC', customer: 'UMC Health', city: 'Lubbock' },
      ],
      NY: [
        { date: '2025-01-31', type: 'Go-Live', customer: 'Memorial Sloan Kettering', city: 'NYC' },
        { date: '2023-08-06', type: 'Go-Live CC', customer: 'Mount Sinai', city: 'NYC' },
        { date: '2022-09-19', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2022-10-31', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2022-11-14', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2022-12-05', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-01-16', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-01-31', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-02-20', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-03-14', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-03-27', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-04-24', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-05-22', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-06-12', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-06-26', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-07-10', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-07-31', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-08-28', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-10-02', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-10-23', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-11-06', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2023-12-04', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-01-07', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-01-22', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-02-05', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-02-29', type: 'Go-Live CC', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-03-25', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-04-01', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-05-20', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-06-10', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-07-08', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-08-05', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-09-09', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-09-30', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-10-31', type: 'Go-Live CC', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-12-02', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2024-12-16', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2025-01-20', type: 'Customer', customer: 'Albany Med', city: 'Albany' },
        { date: '2025-03-27', type: 'Go-Live CC', customer: 'Xtensys', city: 'Ithaca' },
      ],
      FL: [
        { date: '2025-02-28', type: 'Go-Live', customer: 'Tallahassee Memorial', city: 'Tallahassee' },
        { date: '2026-01-30', type: 'Go-Live', customer: 'Halifax Hospital', city: 'Orlando' },
        { date: '2026-02-09', type: 'Customer', customer: 'Nicklaus Children\'s', city: 'Miami' },
        { date: '2026-03-16', type: 'Customer', customer: 'Nicklaus Children\'s', city: 'Miami' },
      ],
      AR: [
        { date: '2025-09-26', type: 'Go-Live', customer: 'Washington Regional', city: 'Fayetteville' },
      ],
      RI: [
        { date: '2025-10-03', type: 'Go-Live', customer: 'Care New England', city: 'Providence' },
      ],
      DE: [
        { date: '2025-10-31', type: 'Go-Live', customer: 'Beebe Healthcare', city: 'Dover' },
      ],
      IL: [
        { date: '2026-03-20', type: 'Go-Live', customer: 'Blessing Health', city: 'Quincy' },
      ],
      AL: [
        { date: '2026-07-29', type: 'Go-Live', customer: 'UAB Medicine', city: 'Birmingham' },
      ],
      OH: [
        { date: '2023-10-06', type: 'Go-Live CC', customer: 'UH-Cleveland', city: 'Cleveland' },
        { date: '2024-10-04', type: 'Go-Live CC', customer: 'Ohio DMHAS', city: 'Columbus' },
      ],
      CA: [
        { date: '2024-11-18', type: 'Customer', customer: 'NEMS', city: 'San Francisco' },
        { date: '2024-12-09', type: 'Customer', customer: 'NEMS', city: 'San Francisco' },
        { date: '2025-01-06', type: 'Go-Live CC', customer: 'NEMS', city: 'San Francisco' },
        { date: '2025-03-17', type: 'Customer', customer: 'NEMS', city: 'San Francisco' },
        { date: '2025-07-21', type: 'Customer', customer: 'NEMS', city: 'San Francisco' },
      ],
      CT: [
        { date: '2025-03-07', type: 'Go-Live CC', customer: 'Stamford Health', city: 'Stamford' },
      ],
      PA: [
        { date: '2026-05-08', type: 'Go-Live CC', customer: 'UPMC Enterprise', city: 'Pittsburgh' },
        { date: '2026-06-04', type: 'Go-Live CC', customer: 'Mount Nittany', city: 'State College' },
      ],
      SC: [
        { date: '2022-09-06', type: 'Immersion', customer: 'McLeod Health', city: 'Florence' },
      ],
    };

    // Canadian provinces visited for work
    const workProvinceTrips = {
      NL: [
        { date: '2026-04-23', type: 'Go-Live', customer: 'NL Health Services', city: "St. John's" },
      ],
    };

    // Personal trips by state
    const personalTrips = {
      CA: [
        { date: '2022-08-19', destination: 'San Francisco', reason: 'Visiting Family' },
        { date: '2025-01-12', destination: 'Muir Woods & Bodega Bay', reason: 'Nature' },
        { date: '2025-03-21', destination: 'San Francisco', reason: 'Visiting Family' },
        { date: '2026-02-13', destination: 'San Francisco', reason: 'Visiting Family' },
      ],
      OH: [
        { date: '2022-09-09', destination: 'Columbus', reason: 'Football' },
        { date: '2024-10-08', destination: 'Columbus', reason: 'Alma Mater Visit' },
        { date: '2025-12-11', destination: 'Cleveland', reason: "Friend's Wedding" },
      ],
      MI: [
        { date: '2022-11-11', destination: 'Detroit', reason: 'Visiting Family' },
      ],
      HI: [
        { date: '2023-12-09', destination: 'Honolulu', reason: 'Nature & Culture' },
        { date: '2025-12-02', destination: 'Oahu', reason: 'Nature & Culture' },
        { date: '2025-12-04', destination: 'Hawaii Island', reason: 'Nature & Culture' },
        { date: '2025-12-07', destination: 'Maui', reason: 'Nature & Culture' },
      ],
      MA: [
        { date: '2024-03-10', destination: 'Boston', reason: 'Nature & Culture' },
      ],
      PA: [
        { date: '2024-03-29', destination: 'Philadelphia', reason: 'Nature & Culture' },
      ],
      NJ: [
        { date: '2024-03-31', destination: 'Atlantic City', reason: 'Visiting Family' },
      ],
      AZ: [
        { date: '2024-05-18', destination: 'Phoenix', reason: 'Visiting Family & Nature' },
      ],
      TX: [
        { date: '2024-10-13', destination: 'Houston', reason: 'Visiting Family' },
        { date: '2025-02-15', destination: 'Austin & Houston', reason: 'Visiting Family' },
      ],
      IN: [
        { date: '2025-08-29', destination: 'Indianapolis', reason: "Friend's Wedding" },
      ],
      NV: [
        { date: '2026-05-28', destination: 'Las Vegas', reason: 'Visiting Family' },
      ],
    };

    // ============================================
    // Calculate statistics
    // ============================================
    const workStates = Object.keys(workTrips);
    const personalStates = Object.keys(personalTrips);
    const workProvinces = Object.keys(workProvinceTrips);

    // States visited for both work and personal
    const bothStates = workStates.filter(s => personalStates.includes(s));
    const workOnly = workStates.filter(s => !personalStates.includes(s));
    const personalOnly = personalStates.filter(s => !workStates.includes(s));

    // All unique states
    const allStatesSet = new Set([...workStates, ...personalStates]);
    const allStates = Array.from(allStatesSet);
    const pct = Math.round(allStates.length / 50 * 100);

    // Trip counts per state (for shading intensity)
    const tripCounts = {};
    for (const [state, trips] of Object.entries(workTrips)) {
      tripCounts[state] = (tripCounts[state] || 0) + trips.length;
    }
    for (const [state, trips] of Object.entries(personalTrips)) {
      tripCounts[state] = (tripCounts[state] || 0) + trips.length;
    }

    // Province trip counts
    const provTripCounts = {};
    for (const [prov, trips] of Object.entries(workProvinceTrips)) {
      provTripCounts[prov] = trips.length;
    }

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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preston's Travel Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      color: #fff;
      font-size: 2.2rem;
      font-weight: 700;
      margin-bottom: 6px;
      text-shadow: 0 2px 15px rgba(0,0,0,0.3);
      letter-spacing: -0.5px;
    }

    .subtitle {
      text-align: center;
      color: rgba(255,255,255,0.7);
      font-size: 1rem;
      margin-bottom: 20px;
    }

    .legend {
      display: flex;
      justify-content: center;
      gap: 28px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: rgba(255,255,255,0.9);
      font-size: 14px;
      font-weight: 500;
    }

    .legend-swatch {
      width: 22px;
      height: 22px;
      border-radius: 5px;
      border: 2px solid rgba(255,255,255,0.3);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .swatch-work { background: #ff9800; }
    .swatch-personal { background: #e91e63; }
    .swatch-both { background: linear-gradient(135deg, #ff9800 50%, #e91e63 50%); }
    .swatch-unvisited { background: #dfe6e9; }

    .map-container {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 15px 50px rgba(0,0,0,0.3);
    }

    #map {
      width: 100%;
      height: 620px;
    }

    .stats {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 18px 20px;
      background: linear-gradient(90deg, #f8f9fa 0%, #fff 50%, #f8f9fa 100%);
      border-top: 1px solid #eee;
      font-size: 15px;
      color: #555;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-number {
      font-size: 1.4rem;
      font-weight: 700;
      color: #2d3436;
    }

    .stat-label { color: #636e72; }
    .stat-work { color: #ff9800; font-weight: 600; }
    .stat-personal { color: #e91e63; font-weight: 600; }
    .stat-both { color: #9c27b0; font-weight: 600; }
    .stat-prov { color: #00bcd4; font-weight: 600; }

    .stat-divider {
      width: 1px;
      height: 24px;
      background: #ddd;
    }

    .info-box {
      padding: 12px 16px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-size: 14px;
      line-height: 1.6;
      min-width: 200px;
    }

    .info-box h4 {
      margin: 0 0 6px 0;
      font-size: 16px;
      color: #2d3436;
      font-weight: 600;
    }

    .info-box .status { font-weight: 600; }
    .info-box .trips { color: #636e72; font-size: 13px; margin-top: 4px; }
    .info-box .trip-breakdown { font-size: 12px; color: #888; margin-top: 2px; }

    .leaflet-container {
      background: #b8d4e8;
      font-family: inherit;
    }

    .leaflet-control-attribution {
      font-size: 10px;
      background: rgba(255,255,255,0.8) !important;
    }

    @media (max-width: 768px) {
      body { padding: 12px; }
      h1 { font-size: 1.6rem; }
      .legend { gap: 14px; }
      .legend-item { font-size: 12px; }
      #map { height: 480px; }
      .stats { gap: 12px; font-size: 13px; }
      .stat-number { font-size: 1.2rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Preston's Travel Map</h1>
    <p class="subtitle">United States & Canada - Work & Personal Travel</p>

    <div class="legend">
      <div class="legend-item"><span class="legend-swatch swatch-work"></span> Work</div>
      <div class="legend-item"><span class="legend-swatch swatch-personal"></span> Personal</div>
      <div class="legend-item"><span class="legend-swatch swatch-both"></span> Both</div>
      <div class="legend-item"><span class="legend-swatch swatch-unvisited"></span> Not Yet Visited</div>
    </div>

    <div class="map-container">
      <div id="map"></div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">${allStates.length}</span>
          <span class="stat-label">/ 50 states (${pct}%)</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-work">${workOnly.length} work only</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-personal">${personalOnly.length} personal only</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-both">${bothStates.length} both</span>
        </div>
        ${workProvinces.length > 0 ? `
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-prov">${workProvinces.length} province${workProvinces.length > 1 ? 's' : ''}</span>
        </div>
        ` : ''}
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    // Data from server
    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvinces)};
    const tripCounts = ${JSON.stringify(tripCounts)};
    const provTripCounts = ${JSON.stringify(provTripCounts)};
    const workTrips = ${JSON.stringify(workTrips)};
    const personalTrips = ${JSON.stringify(personalTrips)};
    const stateNames = ${JSON.stringify(stateNames)};
    const provNames = ${JSON.stringify(provNames)};

    // FIPS to state code mapping
    const fipsToState = {
      "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
      "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
      "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
      "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
      "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
      "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
      "54":"WV","55":"WI","56":"WY"
    };

    // Initialize map
    const map = L.map('map', {
      center: [44, -98],
      zoom: 4,
      minZoom: 3,
      maxZoom: 10,
      zoomControl: true
    });

    // CartoDB Positron tiles (clean, minimal)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Labels layer on top
    const labelsPane = map.createPane('labels');
    labelsPane.style.zIndex = 650;
    labelsPane.style.pointerEvents = 'none';

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      pane: 'labels'
    }).addTo(map);

    // Category functions
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

    // Color with intensity based on trip count
    function getColor(category, count) {
      // Max trips for scaling (NY has ~40)
      const maxTrips = 40;
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

      return {
        fillColor: color,
        weight: 1.5,
        opacity: 1,
        color: '#fff',
        fillOpacity: opacity
      };
    }

    function highlightFeature(e) {
      const layer = e.target;
      layer.setStyle({
        weight: 3,
        color: '#333',
        fillOpacity: 0.9
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

    // Load US States GeoJSON
    fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json')
      .then(r => r.json())
      .then(data => {
        const statesLayer = L.geoJson(data, {
          style: feature => style(feature, false),
          onEachFeature: (feature, layer) => {
            layer.options.isProvince = false;
            layer.on({
              mouseover: highlightFeature,
              mouseout: e => resetHighlight(e, statesLayer),
              click: e => map.fitBounds(e.target.getBounds())
            });
          }
        }).addTo(map);
      });

    // Load Canadian Provinces GeoJSON
    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson')
      .then(r => r.json())
      .then(data => {
        const provLayer = L.geoJson(data, {
          style: feature => style(feature, true),
          onEachFeature: (feature, layer) => {
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

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
