/**
 * Travel Map Wiki Embed Script
 *
 * Add this to your MediaWiki page inside <html><script>...</script></html> tags
 * It parses your trip tables and embeds an interactive travel map
 *
 * Required table classes:
 *   .golive-table      - Go-Live trips (work) - uses "Nearest Major City" column
 *   .immersion-table   - Immersion trips (work) - uses "Location" column
 *   .adhoc-trip-table  - Ad-hoc trips (work) - uses "Location" column
 *   .personal-trips-table - Personal trips - uses "Destination" column
 */
(function() {
  // Valid US state codes
  var stateCodes = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);

  // Valid Canadian province codes
  var provCodes = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']);

  // Extract state/province code from location text
  function extractLocation(text) {
    if (!text) return null;

    // Check for Canadian province first: ", XX, Canada"
    var provMatch = text.match(/,\s*([A-Z]{2})\s*,\s*Canada/i);
    if (provMatch && provCodes.has(provMatch[1].toUpperCase())) {
      return { code: provMatch[1].toUpperCase(), isProvince: true };
    }

    // Check for US state: ", XX" at end or before non-letter
    var stateMatch = text.match(/,\s*([A-Z]{2})(?:\s*$|[^a-zA-Z])/);
    if (stateMatch && stateCodes.has(stateMatch[1].toUpperCase())) {
      return { code: stateMatch[1].toUpperCase(), isProvince: false };
    }

    return null;
  }

  // Counters for trips
  var workStates = {};
  var personalStates = {};
  var workProvinces = {};

  // Parse Go-Live and Immersion tables (work trips)
  // These have "Nearest Major City" as the last column
  document.querySelectorAll('.golive-table tr, .immersion-table tr').forEach(function(row) {
    var cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      // Last column is "Nearest Major City"
      var location = cells[cells.length - 1].textContent.trim();
      var result = extractLocation(location);
      if (result) {
        if (result.isProvince) {
          workProvinces[result.code] = (workProvinces[result.code] || 0) + 1;
        } else {
          workStates[result.code] = (workStates[result.code] || 0) + 1;
        }
      }
    }
  });

  // Parse Ad-Hoc trips table (work trips)
  // Format: Customer | Trip | Dates | Location
  document.querySelectorAll('.adhoc-trip-table tr').forEach(function(row) {
    var cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      var location = cells[3].textContent.trim();
      var result = extractLocation(location);
      if (result) {
        if (result.isProvince) {
          workProvinces[result.code] = (workProvinces[result.code] || 0) + 1;
        } else {
          workStates[result.code] = (workStates[result.code] || 0) + 1;
        }
      }
    }
  });

  // Parse Personal trips table
  // Format: Destination | Dates
  document.querySelectorAll('.personal-trips-table tr').forEach(function(row) {
    var cells = row.querySelectorAll('td');
    if (cells.length >= 1) {
      var destination = cells[0].textContent.trim();
      var result = extractLocation(destination);
      if (result && !result.isProvince) {
        personalStates[result.code] = (personalStates[result.code] || 0) + 1;
      }
    }
  });

  // Build URL parameters
  var params = [];

  var workList = Object.keys(workStates);
  var personalList = Object.keys(personalStates);
  var provList = Object.keys(workProvinces);

  if (workList.length > 0) {
    params.push('work=' + workList.join(','));
  }
  if (personalList.length > 0) {
    params.push('personal=' + personalList.join(','));
  }
  if (provList.length > 0) {
    params.push('prov=' + provList.join(','));
  }

  // Calculate trip counts for intensity shading
  var allTrips = {};
  for (var s in workStates) {
    allTrips[s] = (allTrips[s] || 0) + workStates[s];
  }
  for (var s in personalStates) {
    allTrips[s] = (allTrips[s] || 0) + personalStates[s];
  }
  for (var p in workProvinces) {
    allTrips[p] = (allTrips[p] || 0) + workProvinces[p];
  }

  var tripPairs = [];
  for (var code in allTrips) {
    tripPairs.push(code + ':' + allTrips[code]);
  }
  if (tripPairs.length > 0) {
    params.push('trips=' + tripPairs.join(','));
  }

  // Add custom title
  params.push('title=' + encodeURIComponent("Preston's Travel Map"));

  // Create and insert iframe
  var container = document.getElementById('travel-map-container');
  if (container) {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://travelmap.psiegel.org/?' + params.join('&');
    iframe.style.cssText = 'width:100%;height:650px;border:none;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
    iframe.setAttribute('loading', 'lazy');
    container.appendChild(iframe);

    // Debug: log what was parsed
    console.log('Travel Map - Work States:', workStates);
    console.log('Travel Map - Personal States:', personalStates);
    console.log('Travel Map - Provinces:', workProvinces);
    console.log('Travel Map - URL:', iframe.src);
  } else {
    console.error('Travel Map: Could not find #travel-map-container element');
  }
})();
