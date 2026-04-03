(function() {
  var HASH_KEY = "share-plan";
  var SHARE_THEME_STORAGE_KEY = "tlc-share-theme-v1";
  var itemIdMaps = null;

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
    return countMapFromPairsByKind(pairs, "foods");
  }

  function namesFromTokensByKind(tokens, kind) {
    if (!Array.isArray(tokens)) return [];
    var seen = {};
    var out = [];
    tokens.forEach(function(token) {
      var name = nameForToken(kind, token);
      if (typeof name === "string") name = name.trim();
      if (!name || seen[name]) return;
      seen[name] = 1;
      out.push(name);
    });
    out.sort(function(a, b) { return a.localeCompare(b); });
    return out;
  }

  function ensureItemIdMaps() {
    if (itemIdMaps) return itemIdMaps;

    itemIdMaps = {
      foods: { idToName: {} },
      memories: { idToName: {} },
      professions: { idToName: {} },
    };

    if (typeof FOODS !== "undefined" && Array.isArray(FOODS)) {
      FOODS.forEach(function(item) {
        if (typeof item.id === "number" && item.id > 0) {
          itemIdMaps.foods.idToName[item.id] = item.name;
        }
      });
    }
    if (typeof MEMORIES !== "undefined" && Array.isArray(MEMORIES)) {
      MEMORIES.forEach(function(item) {
        if (typeof item.id === "number" && item.id > 0) {
          itemIdMaps.memories.idToName[item.id] = item.name;
        }
      });
    }
    if (typeof PROFESSIONS !== "undefined" && Array.isArray(PROFESSIONS)) {
      PROFESSIONS.forEach(function(item) {
        if (typeof item.id === "number" && item.id > 0) {
          itemIdMaps.professions.idToName[item.id] = item.name;
        }
      });
    }

    return itemIdMaps;
  }

  function nameForToken(kind, token) {
    var maps = ensureItemIdMaps();
    var byId = maps[kind] && maps[kind].idToName ? maps[kind].idToName : {};

    if (typeof token === "number") {
      return byId[token] || null;
    }

    if (typeof token === "string") {
      var maybeId = parseInt(token, 10);
      if (!isNaN(maybeId) && byId[maybeId]) return byId[maybeId];
      return token;
    }

    return null;
  }

  function countMapFromPairsByKind(pairs, kind) {
    var out = {};
    if (!Array.isArray(pairs)) return out;
    pairs.forEach(function(pair) {
      if (!Array.isArray(pair) || pair.length < 2) return;
      var k = nameForToken(kind, pair[0]);
      if (typeof k === "string") k = k.trim();
      var v = parseInt(pair[1], 10);
      if (!k || isNaN(v) || v <= 0) return;
      out[k] = v;
    });
    return out;
  }

  function defaultSessionName(id) {
    return "Session " + id;
  }

  function defaultPlanHumanLabel() {
    return "Planned human";
  }

  function decodePlanHumanSource(flags) {
    return (flags & 4) ? "sandbox" : "optimizer";
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
        return { id: id, name: String((row && row[1]) || defaultSessionName(id)) };
      }) : [],
      humans: Array.isArray(payload.h) ? payload.h.map(function(row, idx) {
        var id = parseInt(row && row[0], 10);
        if (isNaN(id) || id <= 0) id = idx + 1;
        var sessionId = parseInt(row && row[1], 10);
        if (isNaN(sessionId) || sessionId <= 0) sessionId = 1;
        var flags = parseInt(row && row[5], 10);
        if (isNaN(flags) || flags < 0) flags = 0;
        var professionName = nameForToken("professions", row && row[2]);
        if (typeof professionName !== "string") professionName = "";
        var flightId = parseInt(row && row[6], 10);
        if (isNaN(flightId) || flightId <= 0) flightId = null;
        return {
          id: id,
          sessionId: sessionId,
          label: String((row && row[7]) || defaultPlanHumanLabel()),
          source: decodePlanHumanSource(flags),
          professionName: professionName,
          chosenFood: countMapFromPairsByKind(row && row[3], "foods"),
          chosenMem: countMapFromPairsByKind(row && row[4], "memories"),
          created: !!(flags & 1),
          sent: !!(flags & 2),
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
      nextSessionId: NaN,
      nextHumanId: NaN,
      nextFlightId: NaN,
    };

    return normalizePlan(rawPlan);
  }

  function expandInventoryPayload(payload) {
    if (!payload || typeof payload !== "object") return { foods: {}, memories: {} };
    return {
      foods: countMapFromPairsByKind(payload.f, "foods"),
      memories: countMapFromPairsByKind(payload.m, "memories"),
    };
  }

  function expandProgressPayload(payload) {
    if (!payload || typeof payload !== "object") return { created: [] };
    return {
      created: namesFromTokensByKind(payload.c, "professions"),
    };
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

  function readSharedStateFromHash() {
    var hash = String(window.location.hash || "");
    var prefix = "#" + HASH_KEY + "=";
    if (hash.indexOf(prefix) !== 0) return null;

    var encoded = hash.slice(prefix.length);
    if (!encoded) return null;

    var parsed = decodePayload(encoded);
    if (!parsed) return null;

    if (parsed.v === 3) {
      var st = parsed.st || "plan";
      if (st === "inventory") {
        return {
          type: "inventory",
          inventory: expandInventoryPayload(parsed.i),
          sharedTheme: normalizeTheme(parsed.th),
        };
      }
      if (st === "progress") {
        return {
          type: "progress",
          progress: expandProgressPayload(parsed.g),
          sharedTheme: normalizeTheme(parsed.th),
        };
      }
      if (st === "plan" && parsed.p) {
        return {
          type: "plan",
          plan: expandPayload(parsed.p),
          sharedTheme: normalizeTheme(parsed.th),
        };
      }
    }

    return null;
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

    var type = state && state.type ? state.type : "plan";
    var plan = state && state.plan ? state.plan : null;
    var inventory = state && state.inventory ? state.inventory : null;
    var progress = state && state.progress ? state.progress : null;
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

    if (!state) {
      status.innerHTML = '<div class="warn">No valid shared plan payload found in this URL.</div>';
      summary.innerHTML = "";
      flights.innerHTML = "";
      sessionsWrap.innerHTML = "";
      return;
    }

    if (type === "inventory") {
      var foods = inventory && inventory.foods ? inventory.foods : {};
      var memories = inventory && inventory.memories ? inventory.memories : {};
      var foodKeys = Object.keys(foods).filter(function(k) { return (foods[k] || 0) > 0; });
      var memKeys = Object.keys(memories).filter(function(k) { return (memories[k] || 0) > 0; });
      var foodTotal = foodKeys.reduce(function(sum, k) { return sum + (foods[k] || 0); }, 0);
      var memTotal = memKeys.reduce(function(sum, k) { return sum + (memories[k] || 0); }, 0);

      status.innerHTML = '<div class="ok">Loaded read-only inventory snapshot.</div>';

      summary.innerHTML = ''
        + '<div class="title">Inventory Summary</div>'
        + '<div class="grid">'
        + '<div class="metric"><div class="k">Food entries</div><div class="v">' + foodKeys.length + '</div></div>'
        + '<div class="metric"><div class="k">Memory entries</div><div class="v">' + memKeys.length + '</div></div>'
        + '<div class="metric"><div class="k">Total units</div><div class="v">' + (foodTotal + memTotal) + '</div></div>'
        + '</div>';

      flights.innerHTML = '<div class="title">Food Inventory</div>' + (foodKeys.length
        ? '<div class="pills">' + foodKeys.sort().map(function(name) {
          return '<span class="pill">' + escapeHtml(name) + ' x' + foods[name] + '</span>';
        }).join('') + '</div>'
        : '<div class="meta">No non-zero food entries.</div>');

      sessionsWrap.innerHTML = '<section class="card"><div class="title">Memory Inventory</div>' + (memKeys.length
        ? '<div class="pills">' + memKeys.sort().map(function(name) {
          return '<span class="pill">' + escapeHtml(name) + ' x' + memories[name] + '</span>';
        }).join('') + '</div>'
        : '<div class="meta">No non-zero memory entries.</div>') + '</section>';

      return;
    }

    if (type === "progress") {
      var created = progress && Array.isArray(progress.created) ? progress.created : [];
      status.innerHTML = '<div class="ok">Loaded read-only created profession snapshot.</div>';

      summary.innerHTML = ''
        + '<div class="title">Created Profession Summary</div>'
        + '<div class="grid">'
        + '<div class="metric"><div class="k">Created professions</div><div class="v">' + created.length + '</div></div>'
        + '<div class="metric"><div class="k">Snapshot type</div><div class="v">Progress</div></div>'
        + '<div class="metric"><div class="k">Read-only</div><div class="v">Yes</div></div>'
        + '</div>';

      flights.innerHTML = '<div class="title">Created professions</div>' + (created.length
        ? '<div class="pills">' + created.map(function(name) { return '<span class="pill">' + escapeHtml(name) + '</span>'; }).join('') + '</div>'
        : '<div class="meta">No created professions in this snapshot.</div>');

      sessionsWrap.innerHTML = '';
      return;
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

  render(readSharedStateFromHash());
})();
