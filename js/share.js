(function() {
  var HASH_KEY = "share-plan";
  var SHARE_THEME_STORAGE_KEY = "tlc-share-theme-v1";

  function el(id) { return document.getElementById(id); }
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function countMapFromPairs(pairs) {
    var out = {};
    if (!Array.isArray(pairs)) return out;
    pairs.forEach(function(pair) {
      if (!Array.isArray(pair) || pair.length < 2) return;
      var k = String(pair[0] || "").trim();
      var v = parseInt(pair[1], 10);
      if (!k || isNaN(v) || v <= 0) return;
      out[k] = v;
    });
    return out;
  }

  function normalizeTheme(raw) {
    return raw === "peco" ? "peco" : "default";
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-peco", theme === "peco");
    var sel = el("share-theme-select");
    if (sel) sel.value = normalizeTheme(theme);
  }

  function saveThemeChoice(theme) {
    try {
      localStorage.setItem(SHARE_THEME_STORAGE_KEY, normalizeTheme(theme));
    } catch (err) {
      // ignore storage failures
    }
  }

  function loadThemeChoice() {
    try {
      var raw = localStorage.getItem(SHARE_THEME_STORAGE_KEY);
      if (raw !== "default" && raw !== "peco") return null;
      return raw;
    } catch (err) {
      return null;
    }
  }

  function normalizePlan(raw) {
    var base = {
      sessions: [{ id: 1, name: "Session 1" }],
      humans: [],
      flights: [],
      nextSessionId: 2,
      nextHumanId: 1,
      nextFlightId: 1,
    };

    if (!raw || typeof raw !== "object") return base;

    var sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
    base.sessions = sessions.map(function(s, idx) {
      var id = parseInt(s && s.id, 10);
      if (isNaN(id) || id <= 0) id = idx + 1;
      return { id: id, name: String((s && s.name) || ("Session " + id)) };
    });
    if (!base.sessions.length) base.sessions = [{ id: 1, name: "Session 1" }];

    var validSession = {};
    base.sessions.forEach(function(s) { validSession[s.id] = 1; });

    var humans = Array.isArray(raw.humans) ? raw.humans : [];
    base.humans = humans.map(function(h, idx) {
      var id = parseInt(h && h.id, 10);
      if (isNaN(id) || id <= 0) id = idx + 1;
      var sessionId = parseInt(h && h.sessionId, 10);
      if (!validSession[sessionId]) sessionId = base.sessions[0].id;
      var flightId = parseInt(h && h.flightId, 10);
      if (isNaN(flightId) || flightId <= 0) flightId = null;
      return {
        id: id,
        sessionId: sessionId,
        label: String((h && h.label) || "Planned human"),
        source: (h && h.source) === "sandbox" ? "sandbox" : "optimizer",
        professionName: String((h && h.professionName) || ""),
        chosenFood: (h && h.chosenFood) || {},
        chosenMem: (h && h.chosenMem) || {},
        created: !!(h && h.created),
        sent: !!(h && h.sent),
        flightId: flightId,
      };
    });

    var flights = Array.isArray(raw.flights) ? raw.flights : [];
    base.flights = flights.map(function(f, idx) {
      var id = parseInt(f && f.id, 10);
      if (isNaN(id) || id <= 0) id = idx + 1;
      var ids = Array.isArray(f && f.humanIds)
        ? f.humanIds.map(function(v) { return parseInt(v, 10); }).filter(function(v) { return !isNaN(v) && v > 0; })
        : [];
      return { id: id, humanIds: ids.slice(0, 3) };
    });

    return base;
  }

  function expandPayload(payload) {
    if (!payload || typeof payload !== "object") return null;

    var rawPlan = {
      sessions: Array.isArray(payload.s) ? payload.s.map(function(row, idx) {
        var id = parseInt(row && row[0], 10);
        if (isNaN(id) || id <= 0) id = idx + 1;
        return { id: id, name: String((row && row[1]) || ("Session " + id)) };
      }) : [],
      humans: Array.isArray(payload.h) ? payload.h.map(function(row, idx) {
        var id = parseInt(row && row[0], 10);
        if (isNaN(id) || id <= 0) id = idx + 1;
        var sessionId = parseInt(row && row[1], 10);
        if (isNaN(sessionId) || sessionId <= 0) sessionId = 1;
        var flightId = parseInt(row && row[9], 10);
        if (isNaN(flightId) || flightId <= 0) flightId = null;
        return {
          id: id,
          sessionId: sessionId,
          label: String((row && row[2]) || "Planned human"),
          source: (row && row[3]) === "sandbox" ? "sandbox" : "optimizer",
          professionName: String((row && row[4]) || ""),
          chosenFood: countMapFromPairs(row && row[5]),
          chosenMem: countMapFromPairs(row && row[6]),
          created: !!(row && row[7]),
          sent: !!(row && row[8]),
          flightId: flightId,
        };
      }) : [],
      flights: Array.isArray(payload.f) ? payload.f.map(function(row, idx) {
        var id = parseInt(row && row[0], 10);
        if (isNaN(id) || id <= 0) id = idx + 1;
        var humanIds = Array.isArray(row && row[1])
          ? row[1].map(function(v) { return parseInt(v, 10); }).filter(function(v) { return !isNaN(v) && v > 0; })
          : [];
        return { id: id, humanIds: humanIds.slice(0, 3) };
      }) : [],
      nextSessionId: parseInt(payload.ns, 10),
      nextHumanId: parseInt(payload.nh, 10),
      nextFlightId: parseInt(payload.nf, 10),
    };

    return normalizePlan(rawPlan);
  }

  function decodePayload(raw) {
    if (!raw) return null;
    var json = null;

    if (typeof LZString !== "undefined" && LZString && typeof LZString.decompressFromEncodedURIComponent === "function") {
      try {
        json = LZString.decompressFromEncodedURIComponent(raw);
      } catch (err) {
        json = null;
      }
    }

    if (!json) {
      try {
        json = decodeURIComponent(raw);
      } catch (err2) {
        json = null;
      }
    }

    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (err3) {
      return null;
    }
  }

  function readPlanFromHash() {
    var hash = String(window.location.hash || "");
    var prefix = "#" + HASH_KEY + "=";
    if (hash.indexOf(prefix) !== 0) return null;

    var encoded = hash.slice(prefix.length);
    if (!encoded) return null;

    var parsed = decodePayload(encoded);
    if (!parsed || parsed.v !== 1 || !parsed.p) return null;
    return {
      plan: expandPayload(parsed.p),
      sharedTheme: normalizeTheme(parsed.t),
    };
  }

  function formatPills(countMap) {
    var keys = Object.keys(countMap || {});
    if (!keys.length) return '<div class="meta">None</div>';
    keys.sort(function(a, b) {
      var diff = (countMap[b] || 0) - (countMap[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    return '<div class="pills">' + keys.map(function(name) {
      return '<span class="pill">' + escapeHtml(name) + ' x' + (countMap[name] || 0) + '</span>';
    }).join("") + '</div>';
  }

  function render(state) {
    var status = el("status");
    var summary = el("summary");
    var flights = el("flights");
    var sessionsWrap = el("sessions");

    var plan = state && state.plan ? state.plan : null;
    var sharedTheme = state ? normalizeTheme(state.sharedTheme) : "default";

    var savedTheme = loadThemeChoice();
    var initialTheme = savedTheme || sharedTheme;
    applyTheme(initialTheme);

    var themeSelect = el("share-theme-select");
    if (themeSelect) {
      themeSelect.value = initialTheme;
      themeSelect.addEventListener("change", function() {
        var next = normalizeTheme(themeSelect.value);
        applyTheme(next);
        saveThemeChoice(next);
      });
    }

    if (!plan) {
      status.innerHTML = '<div class="warn">No valid shared plan payload found in this URL.</div>';
      summary.innerHTML = "";
      flights.innerHTML = "";
      sessionsWrap.innerHTML = "";
      return;
    }

    status.innerHTML = '<div class="ok">Loaded shared plan snapshot. This page is read-only.</div>';

    var fullAppUrl = new URL("index.html", window.location.href);
    fullAppUrl.hash = window.location.hash;
    el("open-full-app").href = fullAppUrl.toString();

    summary.innerHTML = ''
      + '<div class="title">Summary</div>'
      + '<div class="grid">'
      + '<div class="metric"><div class="k">Sessions</div><div class="v">' + plan.sessions.length + '</div></div>'
      + '<div class="metric"><div class="k">Planned humans</div><div class="v">' + plan.humans.length + '</div></div>'
      + '<div class="metric"><div class="k">Rockets</div><div class="v">' + plan.flights.length + '</div></div>'
      + '</div>';

    var byHumanId = {};
    plan.humans.forEach(function(h) { byHumanId[h.id] = h; });

    if (!plan.flights.length) {
      flights.innerHTML = '<div class="title">Rockets</div><div class="meta">No rocket assignments.</div>';
    } else {
      flights.innerHTML = '<div class="title">Rockets</div>' + plan.flights.slice().sort(function(a, b) {
        return a.id - b.id;
      }).map(function(flight) {
        var names = (flight.humanIds || []).map(function(id) {
          var human = byHumanId[id];
          return human ? human.label : ("#" + id);
        }).join(", ");
        return '<div class="row"><div class="name">Rocket ' + flight.id + '</div><div class="meta">'
          + (flight.humanIds || []).length + '/3 • ' + escapeHtml(names || "Empty") + '</div></div>';
      }).join("");
    }

    sessionsWrap.innerHTML = plan.sessions.slice().sort(function(a, b) {
      return a.id - b.id;
    }).map(function(session) {
      var humans = plan.humans.filter(function(h) { return h.sessionId === session.id; });
      humans.sort(function(a, b) { return a.id - b.id; });

      var content = humans.length ? humans.map(function(human) {
        var foodCount = Object.keys(human.chosenFood || {}).reduce(function(sum, k) { return sum + (human.chosenFood[k] || 0); }, 0);
        var memCount = Object.keys(human.chosenMem || {}).reduce(function(sum, k) { return sum + (human.chosenMem[k] || 0); }, 0);
        return ''
          + '<div class="row">'
          + '<div class="name">' + escapeHtml(human.label) + '</div>'
          + '<div class="meta">' + escapeHtml(human.source === "sandbox" ? "Sandbox" : "Optimizer")
          + (human.professionName ? (' • ' + escapeHtml(human.professionName)) : '') + '</div>'
          + '<div class="meta">Food items: ' + foodCount + ' • Memory items: ' + memCount + '</div>'
          + '<div class="meta">Food assignment</div>' + formatPills(human.chosenFood)
          + '<div class="meta">Memory assignment</div>' + formatPills(human.chosenMem)
          + '<div class="meta">Status: ' + (human.sent ? "Sent to space" : (human.created ? "Created (not sent)" : "Planned"))
          + (human.flightId ? (' • Rocket ' + human.flightId) : '') + '</div>'
          + '</div>';
      }).join("") : '<div class="meta">No planned humans in this session.</div>';

      return '<section class="card">'
        + '<div class="title">' + escapeHtml(session.name) + '</div>'
        + '<div class="meta">' + humans.length + '/4 planned</div>'
        + content
        + '</section>';
    }).join("");
  }

  render(readPlanFromHash());
})();
