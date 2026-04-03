// js/share_codec.js
// Share payload encode/decode helpers for plan, inventory, and progress snapshots.
// Loaded before ui.js so UI orchestration can call these functions.

var PLAN_SHARE_HASH_KEY = "share-plan";
var itemIdMaps = null;

function ensureItemIdMaps() {
  if (itemIdMaps) return itemIdMaps;

  itemIdMaps = {
    foods: { nameToId: {}, idToName: {} },
    memories: { nameToId: {}, idToName: {} },
    professions: { nameToId: {}, idToName: {} },
  };

  FOODS.forEach(function(item) {
    if (typeof item.id === "number" && item.id > 0) {
      itemIdMaps.foods.nameToId[item.name] = item.id;
      itemIdMaps.foods.idToName[item.id] = item.name;
    }
  });
  MEMORIES.forEach(function(item) {
    if (typeof item.id === "number" && item.id > 0) {
      itemIdMaps.memories.nameToId[item.name] = item.id;
      itemIdMaps.memories.idToName[item.id] = item.name;
    }
  });
  PROFESSIONS.forEach(function(item) {
    if (typeof item.id === "number" && item.id > 0) {
      itemIdMaps.professions.nameToId[item.name] = item.id;
      itemIdMaps.professions.idToName[item.id] = item.name;
    }
  });

  return itemIdMaps;
}

function tokenForName(kind, name) {
  var maps = ensureItemIdMaps();
  var byName = maps[kind] && maps[kind].nameToId ? maps[kind].nameToId : {};
  var id = byName[name];
  return (typeof id === "number" && id > 0) ? id : name;
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

function countMapToPairs(countMap, kind) {
  var out = [];
  Object.keys(countMap || {}).forEach(function(name) {
    var v = parseInt(countMap[name], 10);
    if (!isNaN(v) && v > 0) out.push([tokenForName(kind, name), v]);
  });
  out.sort(function(a, b) {
    var ak = String(a[0]);
    var bk = String(b[0]);
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return 0;
  });
  return out;
}

function pairsToCountMap(pairs, kind) {
  var out = {};
  if (!Array.isArray(pairs)) return out;
  pairs.forEach(function(pair) {
    if (!Array.isArray(pair) || pair.length < 2) return;
    var name = nameForToken(kind, pair[0]);
    if (typeof name === "string") name = name.trim();
    var count = parseInt(pair[1], 10);
    if (!name || isNaN(count) || count <= 0) return;
    out[name] = count;
  });
  return out;
}

function defaultSessionName(id) {
  return "Session " + id;
}

function defaultPlanHumanLabel() {
  return "Planned human";
}

function encodePlanHumanFlags(human) {
  var flags = 0;
  if (human && human.created) flags |= 1;
  if (human && human.sent) flags |= 2;
  if (human && human.source === "sandbox") flags |= 4;
  return flags;
}

function decodePlanHumanSource(flags) {
  return (flags & 4) ? "sandbox" : "optimizer";
}

function compactPlanForShare(plan, selectedSessionIds) {
  var normalized = normalizePlan(plan);
  var selectedSet = null;

  if (Array.isArray(selectedSessionIds) && selectedSessionIds.length) {
    selectedSet = {};
    selectedSessionIds.forEach(function(id) {
      var n = parseInt(id, 10);
      if (!isNaN(n) && n > 0) selectedSet[n] = 1;
    });
  }

  var sessions = selectedSet
    ? normalized.sessions.filter(function(session) { return !!selectedSet[session.id]; })
    : normalized.sessions.slice();
  var validSession = {};
  sessions.forEach(function(session) { validSession[session.id] = 1; });

  var humans = selectedSet
    ? normalized.humans.filter(function(human) { return !!validSession[human.sessionId]; })
    : normalized.humans.slice();
  var validHuman = {};
  humans.forEach(function(human) { validHuman[human.id] = 1; });

  var flights = normalized.flights.map(function(flight) {
    return {
      id: flight.id,
      humanIds: (flight.humanIds || []).filter(function(humanId) { return !!validHuman[humanId]; }).slice(0, 3),
    };
  }).filter(function(flight) {
    return flight.humanIds.length > 0;
  });

  return {
    s: sessions.map(function(session) {
      var out = [session.id];
      if (String(session.name || "") !== defaultSessionName(session.id)) out.push(session.name);
      return out;
    }),
    h: humans.map(function(human) {
      var professionToken = tokenForName("professions", human.professionName);
      if (typeof professionToken !== "number" || professionToken <= 0) professionToken = 0;
      var row = [
        human.id,
        human.sessionId,
        professionToken,
        countMapToPairs(human.chosenFood, "foods"),
        countMapToPairs(human.chosenMem, "memories"),
        encodePlanHumanFlags(human),
      ];
      var hasLabelOverride = String(human.label || "") !== defaultPlanHumanLabel();
      var flightId = parseInt(human.flightId, 10);
      if (isNaN(flightId) || flightId <= 0) flightId = 0;
      if (flightId > 0 || hasLabelOverride) row.push(flightId);
      if (hasLabelOverride) row.push(human.label);
      return row;
    }),
    f: flights.map(function(flight) {
      return [flight.id, (flight.humanIds || []).slice(0, 3)];
    }),
  };
}

function expandSharedPlanPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  var rawPlan = {
    sessions: Array.isArray(payload.s) ? payload.s.map(function(row, idx) {
      var id = parseInt(row && row[0], 10);
      if (isNaN(id) || id <= 0) id = idx + 1;
      return {
        id: id,
        name: String((row && row[1]) || defaultSessionName(id)),
      };
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
        chosenFood: pairsToCountMap(row && row[3], "foods"),
        chosenMem: pairsToCountMap(row && row[4], "memories"),
        created: !!(flags & 1),
        sent: !!(flags & 2),
        flightId: flightId,
      };
    }) : [],
    flights: Array.isArray(payload.f) ? payload.f.map(function(row, idx) {
      var id = parseInt(row && row[0], 10);
      if (isNaN(id) || id <= 0) id = idx + 1;
      var humanIds = Array.isArray(row && row[1])
        ? row[1].map(function(v) { return parseInt(v, 10); }).filter(function(v) { return !isNaN(v) && v > 0; }).slice(0, 3)
        : [];
      return { id: id, humanIds: humanIds };
    }) : [],
    nextSessionId: NaN,
    nextHumanId: NaN,
    nextFlightId: NaN,
  };

  return normalizePlan(rawPlan);
}

function encodeSharePayload(payload) {
  var json = JSON.stringify(payload);
  if (typeof LZString !== "undefined" && LZString && typeof LZString.compressToEncodedURIComponent === "function") {
    return LZString.compressToEncodedURIComponent(json);
  }
  return encodeURIComponent(json);
}

function decodeSharePayload(raw) {
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

function getShareBaseUrl() {
  var base = "";
  try {
    base = new URL("share.html", window.location.href).toString().split("#")[0];
  } catch (err) {
    base = window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "share.html";
  }
  return base;
}

function buildPlanSharePayload(selectedSessionIds) {
  var compact = compactPlanForShare(appState.plan, selectedSessionIds);
  return { v: 3, st: "plan", th: normalizeTheme(appState.theme), p: compact };
}

function buildInventorySharePayload() {
  return {
    v: 3,
    st: "inventory",
    th: normalizeTheme(appState.theme),
    i: {
      f: countMapToPairs(appState.inventory && appState.inventory.foods ? appState.inventory.foods : {}, "foods"),
      m: countMapToPairs(appState.inventory && appState.inventory.memories ? appState.inventory.memories : {}, "memories"),
    },
  };
}

function buildProgressSharePayload() {
  var created = [];
  Object.keys(appState.createdProfessions || {}).forEach(function(name) {
    if (appState.createdProfessions[name]) {
      created.push(tokenForName("professions", name));
    }
  });
  created.sort(function(a, b) {
    var as = String(a), bs = String(b);
    if (as < bs) return -1;
    if (as > bs) return 1;
    return 0;
  });

  return {
    v: 3,
    st: "progress",
    th: normalizeTheme(appState.theme),
    g: { c: created },
  };
}

function buildShareUrlForMode(mode, selectedSessionIds) {
  var payload = null;
  if (mode === "inventory") payload = buildInventorySharePayload();
  else if (mode === "progress") payload = buildProgressSharePayload();
  else payload = buildPlanSharePayload(selectedSessionIds);

  var encoded = encodeSharePayload(payload);
  if (!encoded) return "";
  return getShareBaseUrl() + "#" + PLAN_SHARE_HASH_KEY + "=" + encoded;
}

function buildPlanShareUrl(selectedSessionIds) {
  return buildShareUrlForMode("plan", selectedSessionIds);
}

function readSharedPlanFromLocationHash() {
  var hash = String(window.location.hash || "");
  var prefix = "#" + PLAN_SHARE_HASH_KEY + "=";
  if (hash.indexOf(prefix) !== 0) return null;
  var encoded = hash.slice(prefix.length);
  if (!encoded) return null;

  var parsed = decodeSharePayload(encoded);
  if (!parsed) return null;

  if (parsed.v === 3 && parsed.st === "plan" && parsed.p) {
    return expandSharedPlanPayload(parsed.p);
  }

  return null;
}

function clearPlanShareHash() {
  if (!window.location.hash) return;
  var noHashUrl = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", noHashUrl);
}
