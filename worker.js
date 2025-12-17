/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
// ============================================
// CLOUDFLARE WORKER: Travel Map with Real State Shapes
// ============================================
// Deployed to: https://travelmap.psiegel.org/
// Usage: ?work=NY,CA,TX&personal=OH,HI&prov=NL
// ============================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    var workParam = url.searchParams.get('work') || '';
    var persParam = url.searchParams.get('personal') || '';
    var provParam = url.searchParams.get('prov') || '';
    
    var workStates = workParam.toUpperCase().split(',').filter(function(s) { return s.trim().length > 0; });
    var personalStates = persParam.toUpperCase().split(',').filter(function(s) { return s.trim().length > 0; });
    var workProvinces = provParam.toUpperCase().split(',').filter(function(s) { return s.trim().length > 0; });
    
    var allStatesSet = {};
    workStates.forEach(function(s) { allStatesSet[s] = true; });
    personalStates.forEach(function(s) { allStatesSet[s] = true; });
    var allStates = Object.keys(allStatesSet);
    
    var bothStates = workStates.filter(function(s) { return personalStates.indexOf(s) >= 0; });
    var workOnly = workStates.filter(function(s) { return personalStates.indexOf(s) < 0; });
    var personalOnly = personalStates.filter(function(s) { return workStates.indexOf(s) < 0; });
    
    var pct = allStates.length > 0 ? Math.round(allStates.length / 50 * 100) : 0;

    var stateNames = {
      AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
      CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
      IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
      ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
      MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
      NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
      OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
      TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
      WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
    };
    
    var provNames = {
      AB:'Alberta',BC:'British Columbia',MB:'Manitoba',NB:'New Brunswick',
      NL:'Newfoundland',NS:'Nova Scotia',NT:'NW Territories',
      NU:'Nunavut',ON:'Ontario',PE:'PEI',QC:'Quebec',SK:'Saskatchewan',YT:'Yukon'
    };

    function getClass(code, isProv) {
      if (isProv) {
        return workProvinces.indexOf(code) >= 0 ? 'work' : '';
      }
      var inWork = workStates.indexOf(code) >= 0;
      var inPers = personalStates.indexOf(code) >= 0;
      if (inWork && inPers) return 'both';
      if (inWork) return 'work';
      if (inPers) return 'personal';
      return '';
    }

    function getTip(code, isProv) {
      var name = isProv ? (provNames[code] || code) : (stateNames[code] || code);
      var status = [];
      if (isProv) {
        if (workProvinces.indexOf(code) >= 0) status.push('Work');
      } else {
        if (workStates.indexOf(code) >= 0) status.push('Work');
        if (personalStates.indexOf(code) >= 0) status.push('Personal');
      }
      return status.length > 0 ? name + ' (' + status.join(' + ') + ')' : name;
    }

    // Accurate US state paths (scaled to viewBox 0 0 960 600)
    var statePaths = {
      WA: "M91,33L93,27L99,24L105,24L119,27L133,30L146,33L161,37L167,47L165,61L171,75L178,93L183,96L133,90L92,85L89,43Z",
      OR: "M89,85L133,90L138,104L142,123L145,141L139,149L91,143L74,142L72,129L70,111L68,97Z",
      CA: "M68,97L70,111L72,129L74,142L91,168L100,199L108,241L99,256L86,263L81,248L71,227L57,194L49,166L52,139L58,116Z",
      NV: "M100,114L139,120L136,158L124,200L111,242L99,256L100,199L91,168L91,143Z",
      ID: "M133,90L178,93L196,70L203,72L204,95L204,118L197,138L191,163L179,163L167,149L160,141L142,123L138,104Z",
      MT: "M196,70L203,72L281,78L290,78L290,129L281,139L203,135L204,95Z",
      WY: "M203,135L281,139L284,198L208,195L204,163L204,140Z",
      UT: "M139,157L167,160L179,163L183,203L178,243L143,239L136,198L136,158Z",
      AZ: "M108,241L143,239L178,243L185,304L181,320L134,318L114,285Z",
      CO: "M208,195L284,198L290,262L213,259L208,203Z",
      NM: "M185,264L213,262L218,321L222,376L164,373L148,318L181,320L185,304Z",
      ND: "M290,78L368,80L371,129L290,129Z",
      SD: "M290,129L371,129L374,182L290,180Z",
      NE: "M290,180L374,182L378,220L396,248L304,246L290,232Z",
      KS: "M304,246L396,248L400,306L307,304Z",
      OK: "M307,304L400,306L404,333L404,355L357,357L312,353L297,324Z",
      TX: "M222,376L297,374L312,353L357,357L404,355L414,400L433,463L404,498L355,520L295,502L256,458L232,414Z",
      MN: "M400,73L459,76L468,88L472,136L465,167L413,164L407,129Z",
      IA: "M413,164L465,167L475,200L478,232L417,229L404,200Z",
      MO: "M417,229L478,232L486,264L492,302L446,306L427,290L417,260Z",
      AR: "M446,306L492,302L498,350L500,383L448,380Z",
      LA: "M448,380L500,383L515,410L525,456L490,468L463,450L448,418Z",
      WI: "M468,88L513,92L524,103L529,150L520,178L476,175L472,136Z",
      IL: "M513,155L537,152L549,175L553,220L549,270L515,275L502,250L502,215L509,175Z",
      MS: "M515,350L549,346L557,408L555,450L520,456L515,410Z",
      MI: "M533,70L545,66L571,80L582,106L574,140L555,150L540,145L530,125L521,100L526,80ZM555,150L586,146L598,175L590,195L555,193Z",
      IN: "M549,175L577,172L584,220L582,265L549,270Z",
      KY: "M549,270L582,265L623,260L648,275L635,302L583,310L557,295Z",
      TN: "M557,295L583,310L635,302L673,296L679,318L579,328L557,322Z",
      AL: "M579,328L609,324L617,390L615,422L580,420L570,365Z",
      OH: "M590,175L623,170L640,190L643,240L623,260L590,260Z",
      WV: "M640,215L668,200L688,225L680,260L658,273L648,275L640,250Z",
      VA: "M648,260L688,250L742,245L755,270L748,290L695,300L665,295Z",
      NC: "M665,295L695,300L748,290L780,300L770,335L690,345L665,330Z",
      SC: "M690,325L740,318L755,355L720,380L685,365Z",
      GA: "M617,360L685,355L720,380L713,430L665,440L615,435Z",
      FL: "M665,440L713,430L755,455L770,520L735,560L690,540L665,490L650,455Z",
      PA: "M690,165L760,155L770,185L770,215L700,228L690,210Z",
      NY: "M720,105L765,98L790,115L798,145L780,163L760,155L715,162L700,155L703,125Z",
      VT: "M782,85L798,82L800,120L790,130L782,118Z",
      NH: "M798,82L818,85L815,130L803,145L798,145L800,120Z",
      ME: "M818,55L850,65L848,110L830,140L815,130L818,85Z",
      MA: "M798,145L815,142L838,145L840,162L820,168L798,165Z",
      RI: "M838,160L850,158L852,175L840,177Z",
      CT: "M815,170L838,165L840,190L815,195Z",
      NJ: "M770,185L788,180L798,215L790,245L770,250Z",
      DE: "M778,248L795,243L800,280L785,285Z",
      MD: "M742,245L770,242L778,248L785,285L750,295L742,270Z",
      AK: "M78,445L145,455L162,500L145,530L95,540L50,515L38,475L50,448Z",
      HI: "M205,515L260,520L275,548L262,570L220,565L195,545Z"
    };

    // Label positions [x, y]
    var labelPos = {
      WA:[125,60],OR:[105,118],CA:[75,180],NV:[115,175],ID:[175,120],MT:[240,105],
      WY:[243,165],UT:[155,200],AZ:[148,280],CO:[248,228],NM:[188,330],
      ND:[328,103],SD:[330,155],NE:[340,215],KS:[352,275],OK:[355,335],TX:[340,435],
      MN:[435,120],IA:[443,198],MO:[453,265],AR:[472,343],LA:[480,430],
      WI:[495,133],IL:[528,215],MS:[538,400],MI:[555,115],IN:[565,220],
      KY:[595,285],TN:[618,312],AL:[593,375],OH:[615,218],WV:[663,238],
      VA:[705,270],NC:[720,315],SC:[710,355],GA:[665,395],FL:[705,495],
      PA:[728,190],NY:[748,132],VT:[790,100],NH:[808,108],ME:[833,90],
      MA:[820,153],RI:[845,167],CT:[827,182],NJ:[782,218],DE:[787,265],MD:[758,268],
      AK:[100,490],HI:[235,543]
    };

    var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n';
    html += '<title>Preston\'s Travel Map</title>\n';
    html += '<style>\n';
    html += '*{margin:0;padding:0;box-sizing:border-box}\n';
    html += 'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:linear-gradient(135deg,#f0f4f8,#d9e2ec);padding:12px}\n';
    html += '.ctr{max-width:960px;margin:0 auto}\n';
    html += '.leg{display:flex;justify-content:center;gap:20px;margin-bottom:12px;flex-wrap:wrap}\n';
    html += '.leg-i{display:flex;align-items:center;gap:6px;font-size:13px;color:#444;font-weight:500}\n';
    html += '.sw{width:20px;height:20px;border-radius:4px;border:1px solid #777}\n';
    html += '.sw.w{background:#ff9800}.sw.p{background:#e91e63}\n';
    html += '.sw.b{background:linear-gradient(135deg,#ff9800 50%,#e91e63 50%)}\n';
    html += '.sw.u{background:#c8d4de}\n';
    html += '.box{background:#fff;border-radius:12px;padding:15px 10px;box-shadow:0 4px 20px rgba(0,0,0,0.12)}\n';
    html += 'svg{width:100%;height:auto;display:block}\n';
    html += '.st{fill:#c8d4de;stroke:#fff;stroke-width:1.5;cursor:pointer;transition:all .15s ease}\n';
    html += '.st:hover{filter:brightness(0.88);stroke:#444;stroke-width:2}\n';
    html += '.st.work{fill:#ff9800}\n';
    html += '.st.personal{fill:#e91e63}\n';
    html += '.st.both{fill:url(#gr)}\n';
    html += '.pr{fill:#c8d4de;stroke:#fff;stroke-width:1.5;cursor:pointer;transition:all .15s ease;rx:4}\n';
    html += '.pr:hover{filter:brightness(0.88);stroke:#444}\n';
    html += '.pr.work{fill:#ff9800}\n';
    html += '.stats{text-align:center;margin-top:14px;font-size:14px;color:#555}\n';
    html += '.stats strong{color:#222}\n';
    html += '.tip{position:fixed;background:rgba(30,30,30,0.95);color:#fff;padding:8px 14px;border-radius:6px;font-size:14px;pointer-events:none;z-index:999;display:none;box-shadow:0 4px 15px rgba(0,0,0,0.3);font-weight:500}\n';
    html += '.lbl{font-size:11px;fill:#777;text-anchor:middle;font-weight:600;letter-spacing:1.5px}\n';
    html += '.stlbl{font-size:9px;fill:#445;text-anchor:middle;pointer-events:none;font-weight:700}\n';
    html += '.stlbl.light{fill:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3)}\n';
    html += '</style>\n</head>\n<body>\n';
    html += '<div class="ctr">\n';
    html += '<div class="leg">\n';
    html += '<div class="leg-i"><span class="sw w"></span>Work</div>\n';
    html += '<div class="leg-i"><span class="sw p"></span>Personal</div>\n';
    html += '<div class="leg-i"><span class="sw b"></span>Both</div>\n';
    html += '<div class="leg-i"><span class="sw u"></span>Not Yet Visited</div>\n';
    html += '</div>\n';
    html += '<div class="box">\n';
    html += '<svg viewBox="0 0 900 590" xmlns="http://www.w3.org/2000/svg">\n';
    html += '<defs><linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="100%">\n';
    html += '<stop offset="0%" stop-color="#ff9800"/><stop offset="50%" stop-color="#ff9800"/>\n';
    html += '<stop offset="50%" stop-color="#e91e63"/><stop offset="100%" stop-color="#e91e63"/>\n';
    html += '</linearGradient></defs>\n';
    
    // Canada provinces
    html += '<text x="450" y="20" class="lbl">CANADA</text>\n';
    var provs = ['BC','AB','SK','MB','ON','QC','NB','PE','NS','NL'];
    var provX = [85,150,215,280,365,470,575,630,675,740];
    var provW = [55,55,55,55,95,95,45,35,55,65];
    
    for (var p = 0; p < provs.length; p++) {
      var pCode = provs[p];
      var cls = getClass(pCode, true);
      var tip = getTip(pCode, true);
      html += '<rect class="pr ' + cls + '" x="' + provX[p] + '" y="30" width="' + provW[p] + '" height="28" rx="4" data-t="' + tip + '"><title>' + tip + '</title></rect>\n';
      html += '<text x="' + (provX[p] + provW[p]/2) + '" y="49" class="stlbl' + (cls ? ' light' : '') + '">' + pCode + '</text>\n';
    }
    
    html += '<line x1="40" y1="70" x2="860" y2="70" stroke="#aab5c0" stroke-dasharray="6,4"/>\n';
    
    // US states
    var stateKeys = Object.keys(statePaths);
    for (var s = 0; s < stateKeys.length; s++) {
      var code = stateKeys[s];
      var cls = getClass(code, false);
      var tip = getTip(code, false);
      var path = statePaths[code];
      html += '<path class="st ' + cls + '" d="' + path + '" data-t="' + tip + '"><title>' + tip + '</title></path>\n';
    }
    
    // State labels
    for (var s = 0; s < stateKeys.length; s++) {
      var code = stateKeys[s];
      var cls = getClass(code, false);
      var pos = labelPos[code];
      if (pos) {
        html += '<text x="' + pos[0] + '" y="' + pos[1] + '" class="stlbl' + (cls ? ' light' : '') + '">' + code + '</text>\n';
      }
    }
    
    html += '</svg>\n</div>\n';
    
    // Stats
    html += '<div class="stats">\n';
    html += '<strong>' + allStates.length + '</strong>/50 states (' + pct + '%) &bull; ';
    html += '<span style="color:#ff9800">' + workOnly.length + ' work</span> &bull; ';
    html += '<span style="color:#e91e63">' + personalOnly.length + ' personal</span> &bull; ';
    html += '<span style="color:#9c27b0">' + bothStates.length + ' both</span>';
    if (workProvinces.length > 0) {
      html += ' &bull; <strong>' + workProvinces.length + '</strong> province' + (workProvinces.length > 1 ? 's' : '');
    }
    html += '\n</div>\n</div>\n';
    
    // Tooltip script
    html += '<div class="tip" id="tip"></div>\n';
    html += '<script>\n';
    html += 'var t=document.getElementById("tip");\n';
    html += 'document.querySelectorAll(".st,.pr").forEach(function(e){\n';
    html += 'e.onmouseenter=function(v){var x=v.target.getAttribute("data-t");if(x){t.textContent=x;t.style.display="block";}};\n';
    html += 'e.onmousemove=function(v){t.style.left=(v.clientX+14)+"px";t.style.top=(v.clientY+14)+"px";};\n';
    html += 'e.onmouseleave=function(){t.style.display="none";};\n';
    html += '});\n';
    html += '<\/script>\n';
    html += '</body>\n</html>';

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
