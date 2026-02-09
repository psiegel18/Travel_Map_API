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

  // Location aliases - common nicknames/abbreviations for cities → state codes
  var locationAliases = {
    // Major cities
    'NYC': 'NY', 'NEW YORK CITY': 'NY',
    'SF': 'CA', 'SAN FRAN': 'CA', 'FRISCO': 'CA',
    'LA': 'CA', 'L.A.': 'CA', 'LOS ANGELES': 'CA',
    'CHI': 'IL', 'CHI-TOWN': 'IL', 'CHITOWN': 'IL', 'CHICAGO': 'IL',
    'ATL': 'GA', 'ATLANTA': 'GA',
    'PHILLY': 'PA', 'PHILADELPHIA': 'PA',
    'DC': 'DC', 'D.C.': 'DC', 'WASHINGTON DC': 'DC', 'WASHINGTON D.C.': 'DC',
    'VEGAS': 'NV', 'LAS VEGAS': 'NV',
    'NOLA': 'LA', 'NEW ORLEANS': 'LA',
    'BOSTON': 'MA',
    'MIAMI': 'FL',
    'SEATTLE': 'WA',
    'PORTLAND': 'OR', // Note: could also be ME, but OR is more common
    'DENVER': 'CO',
    'PHOENIX': 'AZ',
    'DALLAS': 'TX',
    'HOUSTON': 'TX',
    'AUSTIN': 'TX',
    'SAN ANTONIO': 'TX',
    'DETROIT': 'MI',
    'MINNEAPOLIS': 'MN', 'MPLS': 'MN',
    'KANSAS CITY': 'MO', // Note: could also be KS
    'ST. LOUIS': 'MO', 'SAINT LOUIS': 'MO', 'STL': 'MO',
    'MILWAUKEE': 'WI',
    'SALT LAKE': 'UT', 'SLC': 'UT', 'SALT LAKE CITY': 'UT',
    // Canadian cities
    'TORONTO': 'ON', 'T.O.': 'ON',
    'VANCOUVER': 'BC',
    'MONTREAL': 'QC',
    'CALGARY': 'AB',
    'EDMONTON': 'AB',
    'OTTAWA': 'ON',
    'WINNIPEG': 'MB'
  };

  // Extract multiple state/province codes from location text (supports "OH & MI", "NY, NJ, PA", etc.)
  function extractAllLocations(text) {
    if (!text) return [];

    var locations = [];

    // Split on common multi-location separators: &, +, /, "and"
    var parts = text.split(/\s*[&+\/]\s*|\s+and\s+/i);

    parts.forEach(function(part) {
      var loc = extractLocation(part.trim());
      if (loc && !locations.some(function(l) { return l.code === loc.code; })) {
        locations.push(loc);
      }
    });

    return locations;
  }

  // Extract single state/province code from location text (improved multi-strategy parser)
  function extractLocation(text) {
    if (!text) return null;

    // Normalize: uppercase for matching
    var upperText = text.toUpperCase();

    // Strategy 0: Check location aliases (city nicknames/abbreviations)
    // Try to match common patterns like "Remote - SF", "SF office", "SF, CA", etc.
    for (var alias in locationAliases) {
      // Match alias as whole word or before punctuation
      var aliasRegex = new RegExp('\\b' + alias.replace(/\./g, '\\.') + '\\b', 'i');
      if (aliasRegex.test(upperText)) {
        var stateCode = locationAliases[alias];
        var isProvince = provCodes.has(stateCode);
        return { code: stateCode, isProvince: isProvince };
      }
    }

    // Strategy 1: Canadian province with "Canada" keyword anywhere in text
    // Matches: "Toronto, ON, Canada", "Vancouver, BC Canada", "Alberta, Canada"
    if (/CANADA/i.test(text)) {
      var provMatch = upperText.match(/\b([A-Z]{2})\b/);
      if (provMatch && provCodes.has(provMatch[1])) {
        return { code: provMatch[1], isProvince: true };
      }
    }

    // Strategy 2: Two-letter code after comma (most common format)
    // Matches: "Madison, WI", "New York, NY", "Portland, OR 97201"
    var commaMatch = text.match(/,\s*([A-Z]{2})(?:\s|$|,|\d)/i);
    if (commaMatch) {
      var code = commaMatch[1].toUpperCase();
      if (stateCodes.has(code)) {
        return { code: code, isProvince: false };
      }
      if (provCodes.has(code)) {
        return { code: code, isProvince: true };
      }
    }

    // Strategy 3: Two-letter code at end of string
    // Matches: "Madison WI", "Portland OR"
    var endMatch = text.match(/\b([A-Z]{2})$/i);
    if (endMatch) {
      var code = endMatch[1].toUpperCase();
      if (stateCodes.has(code)) {
        return { code: code, isProvince: false };
      }
      if (provCodes.has(code)) {
        return { code: code, isProvince: true };
      }
    }

    // Strategy 4: Two-letter code surrounded by word boundaries
    // Matches: "NY office", "CA headquarters", "Remote - TX"
    var boundaryMatch = text.match(/\b([A-Z]{2})\b/i);
    if (boundaryMatch) {
      var code = boundaryMatch[1].toUpperCase();
      if (stateCodes.has(code)) {
        return { code: code, isProvince: false };
      }
      if (provCodes.has(code)) {
        return { code: code, isProvince: true };
      }
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
    // Skip rows marked for exclusion
    if (row.getAttribute('data-exclude') === 'true') {
      return;
    }

    var cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      // Last column is "Nearest Major City" (may contain multiple locations)
      var location = cells[cells.length - 1].textContent.trim();
      var results = extractAllLocations(location);
      results.forEach(function(result) {
        if (result.isProvince) {
          workProvinces[result.code] = (workProvinces[result.code] || 0) + 1;
        } else {
          workStates[result.code] = (workStates[result.code] || 0) + 1;
        }
      });
    }
  });

  // Parse Ad-Hoc trips table (work trips)
  // Format: Customer | Trip | Dates | Location
  document.querySelectorAll('.adhoc-trip-table tr').forEach(function(row) {
    // Skip rows marked for exclusion
    if (row.getAttribute('data-exclude') === 'true') {
      return;
    }

    var cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      var location = cells[3].textContent.trim();
      var results = extractAllLocations(location);
      results.forEach(function(result) {
        if (result.isProvince) {
          workProvinces[result.code] = (workProvinces[result.code] || 0) + 1;
        } else {
          workStates[result.code] = (workStates[result.code] || 0) + 1;
        }
      });
    }
  });

  // Parse Personal trips table
  // Format: Destination | Dates
  document.querySelectorAll('.personal-trips-table tr').forEach(function(row) {
    // Skip rows marked for exclusion
    if (row.getAttribute('data-exclude') === 'true') {
      return;
    }

    var cells = row.querySelectorAll('td');
    if (cells.length >= 1) {
      var destination = cells[0].textContent.trim();
      var results = extractAllLocations(destination);
      results.forEach(function(result) {
        if (!result.isProvince) {
          personalStates[result.code] = (personalStates[result.code] || 0) + 1;
        }
      });
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

  // Send work trip counts (states + provinces combined)
  var workTripPairs = [];
  for (var s in workStates) {
    workTripPairs.push(s + ':' + workStates[s]);
  }
  for (var p in workProvinces) {
    workTripPairs.push(p + ':' + workProvinces[p]);
  }
  if (workTripPairs.length > 0) {
    params.push('workTrips=' + workTripPairs.join(','));
  }

  // Send personal trip counts separately
  var persTripPairs = [];
  for (var s in personalStates) {
    persTripPairs.push(s + ':' + personalStates[s]);
  }
  if (persTripPairs.length > 0) {
    params.push('persTrips=' + persTripPairs.join(','));
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

    // Debug: log excluded rows
    var excludedCount = document.querySelectorAll('[data-exclude="true"]').length;
    console.log('Travel Map - Excluded rows:', excludedCount);

    // Debug: log what was parsed
    console.log('Travel Map - Work States:', workStates);
    console.log('Travel Map - Personal States:', personalStates);
    console.log('Travel Map - Provinces:', workProvinces);
    console.log('Travel Map - Multi-location support enabled');
    console.log('Travel Map - Parameters sent:', params.join('&'));
    console.log('Travel Map - URL:', iframe.src);
  } else {
    console.error('Travel Map: Could not find #travel-map-container element');
  }
})();
