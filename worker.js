/**
 * Travel Map API - Cloudflare Worker v5
 * Added future trip support with visual indicators
 */

import * as Sentry from '@sentry/cloudflare';

export default Sentry.withSentry(
  (env) => {
    const versionId = env.CF_VERSION_METADATA?.id || 'unknown';

    return {
      dsn: env.SENTRY_DSN,
      release: versionId,
      environment: env.ENVIRONMENT || 'production',

      // Sample 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,

      // Capture request headers for debugging (excludes cookies/auth)
      sendDefaultPii: false,

      beforeSend(event) {
        // Scrub any accidentally captured sensitive data
        if (event.request?.headers) {
          delete event.request.headers['cookie'];
          delete event.request.headers['authorization'];
        }
        return event;
      },
    };
  },
  {
    async fetch(request, env, ctx) {
      try {
        const url = new URL(request.url);

        // Test route for Sentry - admin access only
        if (url.pathname === '/debug-sentry') {
          const providedKey = url.searchParams.get('key');
          const adminPassword = env.ADMIN_PASSWORD;

          // Require admin password to be configured
          if (!adminPassword) {
            return new Response('Sentry debug endpoint is not configured', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          }

          // Validate the provided key
          if (!providedKey || providedKey !== adminPassword) {
            return new Response('Unauthorized - invalid or missing admin key', {
              status: 401,
              headers: { 'Content-Type': 'text/plain' }
            });
          }

          // Admin authenticated - throw test error for Sentry
          throw new Error('Sentry test error - integration is working!');
        }

        const hasData = url.searchParams.has('work') ||
                        url.searchParams.has('personal') ||
                        url.searchParams.has('prov') ||
                        url.searchParams.has('persCountries') ||
                        url.searchParams.has('workCountries');

        if (!hasData) {
          Sentry.setTag('map.has_data', 'false');
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
    
    // Future trip parameters
    const workFutureParam = url.searchParams.get('workFuture') || '';
    const personalFutureParam = url.searchParams.get('personalFuture') || '';
    const provFutureParam = url.searchParams.get('provFuture') || '';
    const persCountriesFutureParam = url.searchParams.get('persCountriesFuture') || '';
    const workTripsFutureParam = url.searchParams.get('workTripsFuture') || '';
    const persTripsFutureParam = url.searchParams.get('persTripsFuture') || '';
    
    // Sanitize title to prevent XSS/HTML injection
    function sanitizeTitle(title) {
      if (!title) return 'Travel Map';
      // Remove HTML tags
      title = title.replace(/<[^>]*>/g, '');
      // Remove potentially dangerous characters
      title = title.replace(/[<>"'`]/g, '');
      // Limit length
      return title.slice(0, 100).trim() || 'Travel Map';
    }

    const title = sanitizeTitle(url.searchParams.get('title'));

    // Valid code sets for input validation
    const VALID_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
    const VALID_PROVINCES = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']);
    const VALID_COUNTRIES = new Set(['AFG','ALB','DZA','ARG','AUS','AUT','BHS','BEL','BLZ','BRA','BGR','KHM','CHL','CHN','COL','CRI','HRV','CUB','CZE','DNK','DOM','ECU','EGY','EST','FIN','FRA','DEU','GRC','GTM','HND','HUN','ISL','IND','IDN','IRL','ISR','ITA','JAM','JPN','KEN','LVA','LTU','LUX','MYS','MEX','MAR','NLD','NZL','NIC','NOR','PAN','PER','PHL','POL','PRT','PRI','ROU','RUS','SGP','SVK','SVN','ZAF','KOR','ESP','SWE','CHE','TWN','THA','TUR','GBR','UKR','URY','VAT','VEN','VNM','ENG','SCT','WLS','NIR']);

    // Validation helper for location codes
    function validateCodes(codes, validSet, length) {
      return codes.filter(code => {
        const trimmed = code.trim().toUpperCase();
        return trimmed.length === length && validSet.has(trimmed);
      }).map(code => code.trim().toUpperCase());
    }

    // Validation helper for trip counts
    function parseTripCounts(param, validSet) {
      const counts = {};
      if (!param) return counts;
      param.split(',').forEach(pair => {
        const [code, count] = pair.split(':');
        if (code && count) {
          const trimmedCode = code.toUpperCase().trim();
          const num = parseInt(count, 10);
          // Validate: must be valid code, valid number, positive, and reasonable (<100000)
          if (validSet.has(trimmedCode) && !isNaN(num) && num > 0 && num < 100000) {
            counts[trimmedCode] = num;
          }
        }
      });
      return counts;
    }

    const workStates = validateCodes(workParam.split(','), VALID_STATES, 2);
    const personalStates = validateCodes(personalParam.split(','), VALID_STATES, 2);
    const workProvinces = validateCodes(provParam.split(','), VALID_PROVINCES, 2);
    const personalProvinces = validateCodes(provPersParam.split(','), VALID_PROVINCES, 2);
    const workCountries = validateCodes(workCountriesParam.split(','), VALID_COUNTRIES, 3);
    const personalCountries = validateCodes(persCountriesParam.split(','), VALID_COUNTRIES, 3);
    
    // Future locations (validate these too)
    const workFutureStates = validateCodes(workFutureParam.split(','), VALID_STATES, 2);
    const personalFutureStates = validateCodes(personalFutureParam.split(','), VALID_STATES, 2);
    const workFutureProvinces = validateCodes(provFutureParam.split(','), VALID_PROVINCES, 2);
    const persCountriesFuture = validateCodes(persCountriesFutureParam.split(','), VALID_COUNTRIES, 3);

    // Combine valid sets for trip count validation (states + provinces for work/personal)
    const VALID_STATE_PROV = new Set([...VALID_STATES, ...VALID_PROVINCES]);

    // Parse and validate trip counts
    const workTripCounts = parseTripCounts(workTripsParam, VALID_STATE_PROV);
    const persTripCounts = parseTripCounts(persTripsParam, VALID_STATE_PROV);
    const workTripsFuture = parseTripCounts(workTripsFutureParam, VALID_STATE_PROV);
    const persTripsFuture = parseTripCounts(persTripsFutureParam, VALID_STATE_PROV);

    // Helper function to split locations into past and future-only categories
    function splitPastFuture(allLocations, futureLocations, tripCounts, futureTripCounts) {
      const past = [];
      const futureOnly = [];

      allLocations.forEach(code => {
        const total = tripCounts[code] || 0;
        const future = futureTripCounts[code] || 0;
        const pastCount = total - future;

        if (pastCount > 0) {
          past.push(code);
        } else if (future > 0 || futureLocations.includes(code)) {
          futureOnly.push(code);
        }
      });

      return { past, futureOnly };
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

    // Merge future trip counts for calculations
    const allFutureTripCounts = {};
    Object.keys(workTripsFuture).forEach(k => allFutureTripCounts[k] = (allFutureTripCounts[k] || 0) + workTripsFuture[k]);
    Object.keys(persTripsFuture).forEach(k => allFutureTripCounts[k] = (allFutureTripCounts[k] || 0) + persTripsFuture[k]);

    // Calculate breakdowns for all states
    const allStatesPastFuture = splitPastFuture(
      allStates,
      [...workFutureStates, ...personalFutureStates],
      totalTripCounts,
      allFutureTripCounts
    );
    const pastStates = allStatesPastFuture.past;
    const futureOnlyStates = allStatesPastFuture.futureOnly;

    // Calculate breakdowns for work-only states
    const workOnlyPastFuture = splitPastFuture(
      workOnly,
      workFutureStates,
      workTripCounts,
      workTripsFuture
    );

    // Calculate breakdowns for personal-only states
    const personalOnlyPastFuture = splitPastFuture(
      personalOnly,
      personalFutureStates,
      persTripCounts,
      persTripsFuture
    );

    // Calculate breakdowns for both states
    const bothStatesPastFuture = splitPastFuture(
      bothStates,
      [...workFutureStates, ...personalFutureStates],
      totalTripCounts,
      allFutureTripCounts
    );

    // Set Sentry tags for efficient issue filtering
    Sentry.setTag('map.has_data', hasData.toString());
    Sentry.setTag('map.states_count', allStates.length.toString());
    Sentry.setTag('map.provinces_count', allProvinces.length.toString());
    Sentry.setTag('map.countries_count', allCountries.length.toString());
    Sentry.setTag('map.has_work', (workStates.length > 0 || workCountries.length > 0).toString());
    Sentry.setTag('map.has_personal', (personalStates.length > 0 || personalCountries.length > 0).toString());
    Sentry.setTag('map.has_future', (workFutureStates.length > 0 || personalFutureStates.length > 0).toString());
    Sentry.setTag('map.has_trip_counts', (Object.keys(workTripCounts).length > 0 || Object.keys(persTripCounts).length > 0).toString());

    // Set context with detailed info (not indexed but searchable)
    Sentry.setContext('map_params', {
      workStates: workStates.join(',') || 'none',
      personalStates: personalStates.join(',') || 'none',
      workProvinces: workProvinces.join(',') || 'none',
      personalProvinces: personalProvinces.join(',') || 'none',
      workCountries: workCountries.join(',') || 'none',
      personalCountries: personalCountries.join(',') || 'none',
      futureStates: [...workFutureStates, ...personalFutureStates].join(',') || 'none',
      title: title,
    });

    const mapHtml = generateMapHtml({
      workStates, personalStates, workProvinces, personalProvinces,
      workCountries, personalCountries,
      workFutureStates, personalFutureStates, workFutureProvinces, persCountriesFuture,
      workTripCounts, persTripCounts, totalTripCounts,
      workTripsFuture, persTripsFuture,
      bothStates, workOnly, personalOnly, allStates, allProvinces, allCountries, pct, title,
      pastStates, futureOnlyStates,
      workOnlyPast: workOnlyPastFuture.past,
      workOnlyFuture: workOnlyPastFuture.futureOnly,
      personalOnlyPast: personalOnlyPastFuture.past,
      personalOnlyFuture: personalOnlyPastFuture.futureOnly,
      bothStatesPast: bothStatesPastFuture.past,
      bothStatesFuture: bothStatesPastFuture.futureOnly
    });

        return new Response(mapHtml, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        // Capture the error in Sentry with full context
        Sentry.captureException(error);

        // Return a user-friendly error response
        return new Response(
          `<!DOCTYPE html><html><head><title>Error</title></head><body>
          <h1>Something went wrong</h1>
          <p>We encountered an error generating your travel map. Please try again.</p>
          </body></html>`,
          {
            status: 500,
            headers: {
              'Content-Type': 'text/html;charset=UTF-8',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
    }
  }
);

function generateMapHtml(data) {
  const {
    workStates, personalStates, workProvinces, personalProvinces,
    workCountries, personalCountries,
    workFutureStates, personalFutureStates, workFutureProvinces, persCountriesFuture,
    workTripCounts, persTripCounts, totalTripCounts,
    workTripsFuture, persTripsFuture,
    bothStates, workOnly, personalOnly, allStates, allProvinces, allCountries, pct, title,
    pastStates, futureOnlyStates,
    workOnlyPast, workOnlyFuture,
    personalOnlyPast, personalOnlyFuture,
    bothStatesPast, bothStatesFuture
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
    .swatch-upcoming { background: #ff9800; border: 3px dashed #333; }
    .swatch-future {
      background: #03a9f4;
      opacity: 0.7;
      border: 2px dashed #0277bd;
    }
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
    .stat-breakdown {
      font-size: 0.85em;
      color: #888;
      font-weight: 400;
      margin-left: 4px;
    }
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
    .info-box .trip-future { font-style: italic; opacity: 0.9; }
    .leaflet-container { background: #b8d4e8; font-family: inherit; }
    .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.8) !important; }
    .region-label {
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      text-shadow: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transition: transform 0.15s ease-out, opacity 0.15s ease-out;
    }
    .region-label-zoom-2 { transform: scale(0.5); opacity: 0.6; }
    .region-label-zoom-3 { transform: scale(0.6); opacity: 0.7; }
    .region-label-zoom-4 { transform: scale(0.75); opacity: 0.85; }
    .region-label-zoom-5 { transform: scale(0.85); opacity: 0.9; }
    .region-label-zoom-6 { transform: scale(1); opacity: 1; }
    .region-label-hidden { display: none; }
    .error-banner {
      display: none;
      background: #f8d7da;
      color: #721c24;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 10px;
      border: 1px solid #f5c6cb;
      font-size: 13px;
    }
    .error-banner.visible { display: block; }
    .error-banner h4 { margin: 0 0 4px 0; font-size: 14px; }
    .error-banner p { margin: 0; }
    .share-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .share-btn {
      background: rgba(255,255,255,0.2);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .share-btn:hover {
      background: rgba(255,255,255,0.3);
      border-color: rgba(255,255,255,0.5);
    }
    .share-btn:active {
      transform: scale(0.95);
    }
    .share-btn.success {
      background: rgba(76, 175, 80, 0.3);
      border-color: rgba(76, 175, 80, 0.5);
    }
    .stats-dashboard {
      background: rgba(255,255,255,0.95);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out, padding 0.3s ease-out;
    }
    .stats-dashboard.expanded {
      max-height: 500px;
      padding: 16px;
    }
    .stats-dashboard.collapsed {
      padding: 0;
    }
    .stats-toggle-btn {
      background: rgba(255,255,255,0.2);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      margin: 0 auto 8px auto;
      display: block;
      transition: all 0.2s;
    }
    .stats-toggle-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .dashboard-card {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid #4fc3f7;
    }
    .dashboard-card h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #555;
      font-weight: 600;
    }
    .dashboard-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #2d3436;
      margin-bottom: 4px;
    }
    .dashboard-card .label {
      font-size: 11px;
      color: #888;
    }
    .dashboard-list {
      list-style: none;
      padding: 0;
      margin: 8px 0 0 0;
    }
    .dashboard-list li {
      padding: 4px 0;
      font-size: 12px;
      color: #555;
      display: flex;
      justify-content: space-between;
    }
    .dashboard-list .list-label {
      font-weight: 500;
    }
    .dashboard-list .list-value {
      color: #888;
    }
    .view-filter {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .filter-btn {
      background: rgba(255,255,255,0.2);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .filter-btn.active {
      background: rgba(255,255,255,0.4);
      border-color: rgba(255,255,255,0.6);
      font-weight: 600;
    }
    @media (max-width: 768px) {
      body { padding: 8px; }
      h1 { font-size: 1.3rem; }
      .legend { gap: 8px; }
      .legend-item { font-size: 10px; }
      .stats { gap: 8px; font-size: 11px; padding: 8px; }
      .stat-number { font-size: 1rem; }
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        max-width: 100%;
        height: 100vh;
      }
      .share-buttons { display: none; }
      .stats-toggle-btn { display: none; }
      .stats-dashboard {
        max-height: none !important;
        page-break-inside: avoid;
        box-shadow: none;
        border: 1px solid #ddd;
      }
      .error-banner { display: none; }
      h1 { color: #000; text-shadow: none; }
      .subtitle { color: #666; }
      .legend-item { color: #000; }
      .map-container {
        page-break-inside: avoid;
        box-shadow: none;
      }
      .leaflet-control-attribution {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p class="subtitle">United States, Canada & International</p>
    <div class="share-buttons">
      <button class="share-btn" id="copy-url-btn" title="Copy map URL to clipboard">
        📋 Copy URL
      </button>
      <button class="share-btn" id="print-btn" title="Print this map">
        🖨️ Print
      </button>
      <button class="share-btn" id="stats-btn" title="Show detailed statistics">
        📊 Statistics
      </button>
    </div>
    <button class="stats-toggle-btn" id="stats-toggle" style="display:none;">
      ▼ Show Statistics Dashboard
    </button>
    <div id="stats-dashboard" class="stats-dashboard collapsed">
      <h3 style="margin: 0 0 12px 0; color: #2d3436; font-size: 16px;">📊 Travel Statistics</h3>
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <h4>Total Locations</h4>
          <div class="value">${allStates.length + allProvinces.length + allCountries.length}</div>
          <div class="label">${allStates.length} states, ${allProvinces.length} provinces, ${allCountries.length} countries</div>
        </div>
        <div class="dashboard-card">
          <h4>Total Trips</h4>
          <div class="value">${Object.values(totalTripCounts).reduce((a, b) => a + b, 0)}</div>
          <div class="label">${Object.values(workTripCounts).reduce((a, b) => a + b, 0)} work + ${Object.values(persTripCounts).reduce((a, b) => a + b, 0)} personal</div>
        </div>
        <div class="dashboard-card">
          <h4>US Coverage</h4>
          <div class="value">${pct}%</div>
          <div class="label">${allStates.length} of 50 states</div>
        </div>
        <div class="dashboard-card">
          <h4>Most Visited</h4>
          <div class="value">${(() => {
            const sorted = Object.entries(totalTripCounts).sort((a, b) => b[1] - a[1]);
            return sorted.length > 0 ? sorted[0][0] : 'N/A';
          })()}</div>
          <div class="label">${(() => {
            const sorted = Object.entries(totalTripCounts).sort((a, b) => b[1] - a[1]);
            return sorted.length > 0 ? sorted[0][1] + ' trips' : '';
          })()}</div>
        </div>
      </div>
      <div class="dashboard-grid" style="margin-top: 12px;">
        <div class="dashboard-card">
          <h4>Top 5 Destinations</h4>
          <ul class="dashboard-list">
            ${Object.entries(totalTripCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([code, count]) => `<li><span class="list-label">${code}</span><span class="list-value">${count} trips</span></li>`)
              .join('')}
          </ul>
        </div>
        <div class="dashboard-card">
          <h4>Trip Breakdown</h4>
          <ul class="dashboard-list">
            <li><span class="list-label">Work Only</span><span class="list-value">${workOnlyPast.length + workOnlyFuture.length} locations</span></li>
            <li><span class="list-label">Personal Only</span><span class="list-value">${personalOnlyPast.length + personalOnlyFuture.length} locations</span></li>
            <li><span class="list-label">Both</span><span class="list-value">${bothStatesPast.length + bothStatesFuture.length} locations</span></li>
            ${futureOnlyStates.length > 0 ? `<li><span class="list-label">Future Only</span><span class="list-value">${futureOnlyStates.length} locations</span></li>` : ''}
          </ul>
        </div>
      </div>
    </div>
    <div id="error-banner" class="error-banner">
      <h4>Map Loading Error</h4>
      <p id="error-message"></p>
    </div>
    <div class="view-filter">
      <button class="filter-btn active" data-view="all">All Trips</button>
      <button class="filter-btn" data-view="work">Work Only</button>
      <button class="filter-btn" data-view="personal">Personal Only</button>
      <button class="filter-btn" data-view="past">Past Only</button>
      <button class="filter-btn" data-view="future">Future Only</button>
    </div>
    <div class="legend">
      <div class="legend-item"><span class="legend-swatch swatch-work"></span> Work</div>
      <div class="legend-item"><span class="legend-swatch swatch-personal"></span> Personal</div>
      <div class="legend-item"><span class="legend-swatch swatch-both"></span> Both</div>
      <div class="legend-item"><span class="legend-swatch swatch-upcoming"></span> + Upcoming</div>
      <div class="legend-item"><span class="legend-swatch swatch-future"></span> Future Only</div>
      <div class="legend-item"><span style="font-weight: 600; font-size: 14px;">*</span> = has upcoming</div>
    </div>
    <div class="map-container">
      <div id="map"></div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">${allStates.length}</span>
          <span class="stat-label">/ 50 states (${pct}%)</span>
          ${futureOnlyStates.length > 0 ?
            `<span class="stat-breakdown">(${pastStates.length} past, ${futureOnlyStates.length} future)</span>`
            : ''}
        </div>
        <div class="stat-divider"></div>
        <span class="stat-work">${workOnlyPast.length} work</span>
        ${workOnlyFuture.length > 0 ?
          `<span class="stat-breakdown">(+${workOnlyFuture.length} future)</span>`
          : ''}
        <div class="stat-divider"></div>
        <span class="stat-personal">${personalOnlyPast.length} personal</span>
        ${personalOnlyFuture.length > 0 ?
          `<span class="stat-breakdown">(+${personalOnlyFuture.length} future)</span>`
          : ''}
        <div class="stat-divider"></div>
        <span class="stat-both">${bothStatesPast.length} both</span>
        ${bothStatesFuture.length > 0 ?
          `<span class="stat-breakdown">(+${bothStatesFuture.length} future)</span>`
          : ''}
        ${allProvinces.length > 0 ? `<div class="stat-divider"></div><span class="stat-prov">${allProvinces.length} province${allProvinces.length > 1 ? 's' : ''}</span>` : ''}
        ${allCountries.length > 0 ? `<div class="stat-divider"></div><span class="stat-country">${allCountries.length} ${allCountries.length > 1 ? 'countries' : 'country'}</span>` : ''}
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    // Show user-visible error messages
    function showError(message) {
      console.error('Map Error:', message);
      const errorBanner = document.getElementById('error-banner');
      const errorMessage = document.getElementById('error-message');
      if (errorBanner && errorMessage) {
        errorMessage.textContent = message;
        errorBanner.classList.add('visible');
      }
    }

    // Share/Export functionality
    document.getElementById('copy-url-btn').addEventListener('click', function() {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(function() {
        const btn = document.getElementById('copy-url-btn');
        btn.classList.add('success');
        btn.textContent = '✓ Copied!';
        setTimeout(function() {
          btn.classList.remove('success');
          btn.textContent = '📋 Copy URL';
        }, 2000);
      }).catch(function(err) {
        console.error('Failed to copy URL:', err);
        alert('Failed to copy URL. Please copy manually: ' + url);
      });
    });

    document.getElementById('print-btn').addEventListener('click', function() {
      window.print();
    });

    document.getElementById('stats-btn').addEventListener('click', function() {
      const dashboard = document.getElementById('stats-dashboard');
      const toggle = document.getElementById('stats-toggle');
      if (toggle.style.display === 'none') {
        toggle.style.display = 'block';
        toggle.click(); // Auto-expand on first click
      } else {
        toggle.click();
      }
    });

    document.getElementById('stats-toggle').addEventListener('click', function() {
      const dashboard = document.getElementById('stats-dashboard');
      const btn = this;
      if (dashboard.classList.contains('expanded')) {
        dashboard.classList.remove('expanded');
        dashboard.classList.add('collapsed');
        btn.textContent = '▼ Show Statistics Dashboard';
      } else {
        dashboard.classList.remove('collapsed');
        dashboard.classList.add('expanded');
        btn.textContent = '▲ Hide Statistics Dashboard';
      }
    });

    // View filter functionality - will be connected after map layers are created
    let currentView = 'all';
    let mapLayers = { states: null, provinces: null, countries: null };

    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        currentView = this.getAttribute('data-view');
        applyViewFilter(currentView);
      });
    });

    function applyViewFilter(view) {
      console.log('Applying view filter:', view);

      // Iterate through all layer features and update their style
      if (mapLayers.states) {
        mapLayers.states.eachLayer(function(layer) {
          const code = layer.locationCode;
          const visible = shouldShowLocation(code, 'state', view);
          layer.setStyle({ fillOpacity: visible ? layer.options.fillOpacity : 0, opacity: visible ? 1 : 0 });
        });
      }

      if (mapLayers.provinces) {
        mapLayers.provinces.eachLayer(function(layer) {
          const code = layer.locationCode;
          const visible = shouldShowLocation(code, 'province', view);
          layer.setStyle({ fillOpacity: visible ? layer.options.fillOpacity : 0, opacity: visible ? 1 : 0 });
        });
      }

      if (mapLayers.countries) {
        mapLayers.countries.eachLayer(function(layer) {
          const code = layer.locationCode;
          const visible = shouldShowLocation(code, 'country', view);
          layer.setStyle({ fillOpacity: visible ? layer.options.fillOpacity : 0, opacity: visible ? 1 : 0 });
        });
      }
    }

    function shouldShowLocation(code, locationType, view) {
      const info = getTripInfo(code);
      const hasPastWork = info.workPast > 0;
      const hasPastPersonal = info.persPast > 0;
      const hasFuture = hasFutureTrips(code, locationType);

      if (view === 'all') return true;
      if (view === 'work') return hasPastWork || (workStates.includes(code) || workProvinces.includes(code) || workCountries.includes(code));
      if (view === 'personal') return hasPastPersonal || (personalStates.includes(code) || personalProvinces.includes(code) || personalCountries.includes(code));
      if (view === 'past') return (hasPastWork || hasPastPersonal) && !hasFuture;
      if (view === 'future') return hasFuture;
      return true;
    }

    const workStates = ${JSON.stringify(workStates)};
    const personalStates = ${JSON.stringify(personalStates)};
    const workProvinces = ${JSON.stringify(workProvinces)};
    const personalProvinces = ${JSON.stringify(personalProvinces)};
    const workCountries = ${JSON.stringify(workCountries)};
    const personalCountries = ${JSON.stringify(personalCountries)};
    const workFutureStates = ${JSON.stringify(workFutureStates)};
    const personalFutureStates = ${JSON.stringify(personalFutureStates)};
    const workFutureProvinces = ${JSON.stringify(workFutureProvinces)};
    const persCountriesFuture = ${JSON.stringify(persCountriesFuture)};
    const workTripCounts = ${JSON.stringify(workTripCounts)};
    const persTripCounts = ${JSON.stringify(persTripCounts)};
    const workTripsFuture = ${JSON.stringify(workTripsFuture)};
    const persTripsFuture = ${JSON.stringify(persTripsFuture)};
    const totalTripCounts = ${JSON.stringify(totalTripCounts)};
    const stateNames = ${JSON.stringify(stateNames)};
    const provNames = ${JSON.stringify(provNames)};
    const countryNames = ${JSON.stringify(countryNames)};
    const maxTrips = ${maxTrips};

    const provNameToCode = {
      'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB', 'New Brunswick': 'NB',
      'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS', 'Northwest Territories': 'NT',
      'Nunavut': 'NU', 'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC',
      'Saskatchewan': 'SK', 'Yukon': 'YT', 'Yukon Territory': 'YT'
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

    const countriesPane = map.createPane('countries');
    countriesPane.style.zIndex = 400;
    
    const statesPane = map.createPane('states');
    statesPane.style.zIndex = 450;
    
    const provincesPane = map.createPane('provinces');
    provincesPane.style.zIndex = 450;

    const regionLabelsPane = map.createPane('regionLabels');
    regionLabelsPane.style.zIndex = 500;
    regionLabelsPane.style.pointerEvents = 'none';

    const labelsPane = map.createPane('labels');
    labelsPane.style.zIndex = 650;
    labelsPane.style.pointerEvents = 'none';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 20, pane: 'labels'
    }).addTo(map);

    const regionLabels = [];

    function getZoomClass(zoom, locationType) {
      const isCountry = locationType === 'country';
      const minZoom = isCountry ? 2 : 3;
      if (zoom < minZoom) return 'region-label-hidden';
      if (zoom <= 2) return 'region-label-zoom-2';
      if (zoom <= 3) return 'region-label-zoom-3';
      if (zoom <= 4) return 'region-label-zoom-4';
      if (zoom <= 5) return 'region-label-zoom-5';
      return 'region-label-zoom-6';
    }

    function updateLabelsForZoom() {
      const zoom = map.getZoom();
      regionLabels.forEach(item => {
        const el = item.marker.getElement();
        if (!el) return;
        el.classList.remove('region-label-zoom-2', 'region-label-zoom-3', 'region-label-zoom-4',
                           'region-label-zoom-5', 'region-label-zoom-6', 'region-label-hidden');
        const zoomClass = getZoomClass(zoom, item.locationType);
        el.classList.add(zoomClass);
      });
    }

    map.on('zoomend', updateLabelsForZoom);

    function addRegionLabel(layer, code, locationType) {
      const info = getTripInfo(code);
      const pastCount = info.workPast + info.persPast;
      const futureCount = info.workFuture + info.persFuture;

      // Only show labels for regions with past trips (future-only regions have no label)
      if (pastCount === 0) return;

      // Show past count with asterisk if future trips exist
      let labelText = pastCount.toString();
      if (futureCount > 0) {
        labelText += '*';
      }

      const bounds = layer.getBounds();
      const center = bounds.getCenter();
      const zoomClass = getZoomClass(map.getZoom(), locationType);

      const icon = L.divIcon({
        className: 'region-label ' + zoomClass,
        html: labelText,
        iconSize: null,
        iconAnchor: [0, 0]
      });

      const marker = L.marker(center, {
        icon: icon,
        pane: 'regionLabels',
        interactive: false
      }).addTo(map);

      regionLabels.push({ marker, locationType });
    }

    function getProvinceCode(props) {
      if (props.name && provNameToCode[props.name]) return provNameToCode[props.name];
      if (props.iso_3166_2) return props.iso_3166_2.replace('CA-', '');
      if (props.postal) return props.postal.toUpperCase();
      return null;
    }

    function getCountryCode(props, featureId) {
      if (props.GU_A3) return props.GU_A3.toUpperCase();
      if (featureId && typeof featureId === 'string' && featureId.length === 3) return featureId.toUpperCase();
      if (props['ISO3166-1-Alpha-3']) return props['ISO3166-1-Alpha-3'].toUpperCase();
      if (props.ISO_A3 && props.ISO_A3 !== '-99') return props.ISO_A3.toUpperCase();
      if (props.ADM0_A3) return props.ADM0_A3.toUpperCase();
      if (props.iso_a3 && props.iso_a3 !== '-99') return props.iso_a3.toUpperCase();
      return null;
    }

    function getTripInfo(code) {
      const workTotal = workTripCounts[code] || 0;
      const persTotal = persTripCounts[code] || 0;
      const workFuture = workTripsFuture[code] || 0;
      const persFuture = persTripsFuture[code] || 0;
      const workPast = workTotal - workFuture;
      const persPast = persTotal - persFuture;
      return { workTotal, persTotal, workFuture, persFuture, workPast, persPast };
    }

    function hasFutureTrips(code, locationType) {
      const info = getTripInfo(code);
      if (info.workFuture > 0 || info.persFuture > 0) return true;
      if (locationType === 'state') {
        return workFutureStates.includes(code) || personalFutureStates.includes(code);
      }
      if (locationType === 'province') {
        return workFutureProvinces.includes(code);
      }
      if (locationType === 'country') {
        return persCountriesFuture.includes(code);
      }
      return false;
    }

    function getCategory(code, locationType) {
      const info = getTripInfo(code);
      const hasPastWork = info.workPast > 0;
      const hasPastPersonal = info.persPast > 0;
      const hasFuture = hasFutureTrips(code, locationType);
      
      if (locationType === 'country') {
        // For countries, check array membership (may not have trip counts)
        const inWork = workCountries.includes(code);
        const inPers = personalCountries.includes(code);
        if ((inWork && inPers) || (hasPastWork && hasPastPersonal)) return 'both';
        if (inWork || hasPastWork) return 'work';
        if (inPers || hasPastPersonal) return 'personal';
        if (hasFuture) return 'futureOnly';
        return 'unvisited';
      }
      if (locationType === 'province') {
        // For provinces, check array membership
        const inWork = workProvinces.includes(code);
        const inPers = personalProvinces.includes(code);
        const inFutureWork = workFutureProvinces.includes(code);
        if ((inWork && inPers) || (hasPastWork && hasPastPersonal)) return 'both';
        if (inWork || hasPastWork) return 'work';
        if (inPers || hasPastPersonal) return 'personal';
        if (inFutureWork) return 'futureOnly';
        return 'unvisited';
      }
      // State - check array membership AND trip counts
      const inWork = workStates.includes(code);
      const inPers = personalStates.includes(code);
      const inFutureWork = workFutureStates.includes(code);
      const inFuturePers = personalFutureStates.includes(code);
      
      // Use trip counts for past (more accurate) but fall back to array membership
      if ((hasPastWork && hasPastPersonal) || (inWork && inPers && !hasFuture)) return 'both';
      if (hasPastWork || (inWork && !hasFuture)) return 'work';
      if (hasPastPersonal || (inPers && !hasFuture)) return 'personal';
      if ((inFutureWork || inFuturePers) && !hasPastWork && !hasPastPersonal) return 'futureOnly';
      return 'unvisited';
    }

    function getColor(category, count) {
      const minOp = 0.5, maxOp = 1.0;
      const opacity = count > 0 ? minOp + (Math.min(count, maxTrips) / maxTrips) * (maxOp - minOp) : 1.0;
      switch(category) {
        case 'work': return { color: '#ff9800', opacity };
        case 'personal': return { color: '#e91e63', opacity };
        case 'both': return { color: '#9c27b0', opacity };
        case 'futureOnly': return { color: '#03a9f4', opacity: 0.5 };  // Light blue
        default: return { color: '#dfe6e9', opacity: 0.7 };
      }
    }

    function styleFeature(code, locationType) {
      const category = getCategory(code, locationType);
      if (category === 'unvisited') {
        return { fillColor: '#dfe6e9', weight: 1.5, opacity: 1, color: '#fff', fillOpacity: 0.7 };
      }
      
      const info = getTripInfo(code);
      const totalPast = info.workPast + info.persPast;
      const totalAll = (workTripCounts[code] || 0) + (persTripCounts[code] || 0);
      
      // Use total trips for opacity calculation (or default if no counts)
      const countForOpacity = totalAll > 0 ? totalAll : 1;
      const { color, opacity } = getColor(category, countForOpacity);
      const hasFuture = hasFutureTrips(code, locationType);
      
      let style = { fillColor: color, weight: 1.5, opacity: 1, color: '#fff', fillOpacity: opacity };
      
      // Add dashed border if has future trips AND past trips
      if (hasFuture && totalPast > 0) {
        style.weight = 3;
        style.dashArray = '6,4';
        style.color = '#333';
      }
      
      // Future only styling - light blue with prominent dashed border
      if (category === 'futureOnly') {
        style.fillColor = '#03a9f4'; // Light blue
        style.fillOpacity = 0.5;
        style.weight = 3;
        style.dashArray = '8,4';
        style.color = '#0277bd'; // Darker blue border for contrast
      }
      
      return style;
    }

    function styleState(feature) {
      // Natural Earth uses 'postal' property for 2-letter state codes
      const code = feature.properties.postal || feature.properties.code_hasc?.split('-')[1] || feature.properties.STUSPS || '';
      return styleFeature(code, 'state');
    }

    function styleProvince(feature) {
      const code = getProvinceCode(feature.properties);
      return styleFeature(code, 'province');
    }

    function styleCountry(feature) {
      const code = getCountryCode(feature.properties, feature.id);
      const category = getCategory(code, 'country');
      if (category === 'unvisited') {
        return { fillColor: '#dfe6e9', fillOpacity: 0.3, weight: 0.5, opacity: 0.3, color: '#ccc' };
      }
      return styleFeature(code, 'country');
    }

    function highlightFeature(e) {
      const code = e.target.locationCode;
      const type = e.target.locationType;
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
        this._div.innerHTML = '<h4>Hover over a region</h4><div class="trips">to see details</div>';
        return;
      }
      const props = feature.properties || {};
      const featureId = feature.id;
      let code, name;
      
      var detectedType = locationType;
      if (!detectedType) {
        if (props.GU_A3) detectedType = 'country';
        else if (featureId && typeof featureId === 'string' && featureId.length === 3) detectedType = 'country';
        else if (props['ISO3166-1-Alpha-3'] || props.ISO_A3 || props.ADM0_A3) detectedType = 'country';
        else if (props.name && provNameToCode[props.name]) detectedType = 'province';
        else detectedType = 'state';
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
      const tripInfo = getTripInfo(code);
      const totalPast = tripInfo.workPast + tripInfo.persPast;
      const totalFuture = tripInfo.workFuture + tripInfo.persFuture;
      
      let statusText, statusColor;
      switch(category) {
        case 'work': statusText = 'Work'; statusColor = '#ff9800'; break;
        case 'personal': statusText = 'Personal'; statusColor = '#e91e63'; break;
        case 'both': statusText = 'Work + Personal'; statusColor = '#9c27b0'; break;
        case 'futureOnly': statusText = 'Future trips planned'; statusColor = '#03a9f4'; break;
        default: statusText = 'Not visited'; statusColor = '#999';
      }
      
      let html = '<h4>' + name + '</h4>';
      html += '<div class="status" style="color:' + statusColor + '">' + statusText + '</div>';
      
      if (totalPast > 0) {
        html += '<div class="trips">' + totalPast + ' trip' + (totalPast > 1 ? 's' : '') + '</div>';
        if (tripInfo.workPast > 0 || tripInfo.persPast > 0) {
          html += '<div class="trip-breakdown">';
          if (tripInfo.workPast > 0) html += '<span class="trip-work">' + tripInfo.workPast + ' work</span>';
          if (tripInfo.workPast > 0 && tripInfo.persPast > 0) html += ' · ';
          if (tripInfo.persPast > 0) html += '<span class="trip-personal">' + tripInfo.persPast + ' personal</span>';
          html += '</div>';
        }
      }
      
      if (totalFuture > 0) {
        html += '<div class="trip-breakdown trip-future">';
        html += '+' + totalFuture + ' upcoming';
        if (tripInfo.workFuture > 0) html += ' <span class="trip-work">(' + tripInfo.workFuture + ' work)</span>';
        if (tripInfo.persFuture > 0) html += ' <span class="trip-personal">(' + tripInfo.persFuture + ' pers)</span>';
        html += '</div>';
      }
      
      this._div.innerHTML = html;
    };
    info.addTo(map);

    // Fetch helper with KV caching, timeout and retry logic
    async function fetchGeoDataWithCache(env, cacheKey, url, retries = 3, timeout = 10000) {
      // Try KV cache first (if available)
      if (env.GEO_CACHE) {
        try {
          const cached = await env.GEO_CACHE.get(cacheKey, { type: 'json' });
          if (cached) {
            console.log(\`Cache HIT for \${cacheKey}\`);
            return cached;
          }
          console.log(\`Cache MISS for \${cacheKey}\`);
        } catch (err) {
          console.warn('KV cache read failed:', err.message);
          // Continue to fetch from source
        }
      }

      // Fetch from source with retry logic
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
          }
          const data = await response.json();

          // Store in KV cache for future requests (24 hour TTL)
          if (env.GEO_CACHE) {
            try {
              await env.GEO_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });
              console.log(\`Cached \${cacheKey} for 24 hours\`);
            } catch (err) {
              console.warn('KV cache write failed:', err.message);
              // Non-fatal - continue with data
            }
          }

          return data;
        } catch (err) {
          const isLastRetry = i === retries - 1;
          console.error(\`Fetch attempt \${i + 1}/\${retries} failed for \${url}:\`, err.message);

          if (isLastRetry) {
            throw new Error(\`Failed to fetch \${url} after \${retries} attempts: \${err.message}\`);
          }

          // Exponential backoff: wait 1s, 2s, 4s...
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
      }
    }

    // Fetch countries (Natural Earth map_units - includes UK subdivisions like ENG, SCT, WLS, NIR, IRL)
    // Using 50m resolution for better island coverage (Florida Keys, Hawaii islands, Caribbean, etc.)
    fetchGeoDataWithCache(
      env,
      'geo_countries_50m',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson'
    )
      .then(data => {
        data.features = data.features.filter(f => {
          const code = getCountryCode(f.properties, f.id);
          return code !== 'USA' && code !== 'CAN';
        });
        
        const layer = L.geoJson(data, {
          style: styleCountry,
          pane: 'countries',
          onEachFeature: (f, l) => {
            const code = getCountryCode(f.properties, f.id);
            l.locationType = 'country';
            l.locationCode = code;
            const category = getCategory(code, 'country');
            if (category !== 'unvisited') {
              l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
              addRegionLabel(l, code, 'country');
            }
          }
        }).addTo(map);
        mapLayers.countries = layer;
      })
      .catch(err => {
        console.error('Error loading countries:', err);
        showError('Unable to load country map data. Please refresh the page to try again.');
      });

    // Using Natural Earth 50m US states for better island coverage (includes Florida Keys, Aleutian Islands, etc.)
    fetchGeoDataWithCache(
      env,
      'geo_states_provinces_50m',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
    )
      .then(data => {
        // Filter for only US states (iso_a2 === 'US')
        data.features = data.features.filter(f => f.properties.iso_a2 === 'US');

        const layer = L.geoJson(data, {
          style: styleState,
          pane: 'states',
          onEachFeature: (f, l) => {
            // Natural Earth uses 'postal' property for 2-letter state codes
            const code = f.properties.postal || f.properties.code_hasc?.split('-')[1] || '';
            l.locationType = 'state';
            l.locationCode = code;
            l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
            addRegionLabel(l, code, 'state');
          }
        }).addTo(map);
        mapLayers.states = layer;
      })
      .catch(err => {
        console.error('Error loading US states:', err);
        showError('Unable to load US states map data. Please refresh the page to try again.');
      });

    // Using Natural Earth 50m provinces for better island coverage (includes Canadian Arctic islands, etc.)
    // Note: Uses same data source as US states above, so will benefit from shared cache
    fetchGeoDataWithCache(
      env,
      'geo_states_provinces_50m',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
    )
      .then(data => {
        // Filter for only Canadian provinces (iso_a2 === 'CA')
        data.features = data.features.filter(f => f.properties.iso_a2 === 'CA');

        const layer = L.geoJson(data, {
          style: styleProvince,
          pane: 'provinces',
          onEachFeature: (f, l) => {
            const code = getProvinceCode(f.properties);
            l.locationType = 'province';
            l.locationCode = code;
            l.on({ mouseover: highlightFeature, mouseout: e => resetHighlight(e, layer), click: e => map.fitBounds(e.target.getBounds()) });
            addRegionLabel(l, code, 'province');
          }
        }).addTo(map);
        mapLayers.provinces = layer;
      })
      .catch(err => {
        console.error('Error loading Canadian provinces:', err);
        showError('Unable to load Canadian provinces map data. Please refresh the page to try again.');
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
        <tr><td><code>persCountries</code></td><td>Countries visited personally (3-letter codes)</td><td>IRL,NIR,ENG</td></tr>
        <tr><td><code>workTrips</code></td><td>Work trip counts (total)</td><td>NY:40,CA:9,TX:17</td></tr>
        <tr><td><code>persTrips</code></td><td>Personal trip counts (total)</td><td>OH:3,HI:2,IRL:1</td></tr>
        <tr><td><code>workFuture</code></td><td>States with future work trips</td><td>FL,DE,IL</td></tr>
        <tr><td><code>workTripsFuture</code></td><td>Future work trip counts</td><td>FL:19,DE:1</td></tr>
        <tr><td><code>persTripsFuture</code></td><td>Future personal trip counts</td><td>HI:3,NV:1</td></tr>
        <tr><td><code>title</code></td><td>Custom map title</td><td>My Travel Map</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Features</h2>
      <p>• US states, Canadian provinces, and international countries (including UK subdivisions)</p>
      <p>• Color coding: Work (orange), Personal (pink), Both (purple)</p>
      <p>• Future trips: Faded fill for future-only, dashed border for places with upcoming trips</p>
      <p>• Trip count labels displayed on each visited region</p>
      <p>• Hover tooltip shows work/personal/upcoming breakdown</p>
      <p>• Interactive zoom on click</p>
    </div>
  </div>
</body>
</html>`;
}
