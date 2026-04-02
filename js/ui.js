// js/ui.js
// UI rendering and event handling for The Last Caretaker optimizer.
// Depends on: optimizer.js and all data files.

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function setHTML(id, html) { el(id).innerHTML = html; }

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAssetStem(name) {
  return String(name || "").trim().replace(/\s+/g, "_");
}

function getFoodImagePath(name) {
  return "images/food/" + encodeURIComponent(toAssetStem(name)) + ".png";
}

var MEMORY_IMAGE_ALIASES = {
  "Teddy Bear (Brown)": "Teddy_Bear",
  "Teddy Bear (White)": "Teddy_Bear",
};

function getMemoryImagePath(name) {
  var stem = MEMORY_IMAGE_ALIASES[name] || toAssetStem(name);
  return "images/memories/" + encodeURIComponent(stem) + ".png";
}

var FOOD_MAT_IMAGE_BY_ING = {
  carbs: "Carbohydrate",
  protein: "Protein",
  fat: "Fat",
  omega3: "Omega-3",
  vitd: "Vitamin_D",
  calcium: "Calcium",
  mito: "Mitochondrial_Amplifier",
  nanite: "Nanite_Nutrient",
  bio: "Bioregulator",
};

function getFoodMatImagePath(ingKey) {
  var stem = FOOD_MAT_IMAGE_BY_ING[ingKey];
  if (!stem) return "";
  return "images/food_mats/" + encodeURIComponent(stem) + ".png";
}

function getOrganicImagePath(name) {
  return "images/organics/" + encodeURIComponent(toAssetStem(name)) + ".png";
}

function buildImageTag(path, alt, cssClass) {
  if (!path) return "";
  return '<img class="' + cssClass + '" src="' + path + '" alt="' + escapeHtml(alt || "") + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=&quot;images/placeholder.png&quot;;">';
}

var referenceState = {
  professionCommittee: "all",
  professionTier: "all",
  professionStatus: "all",
  foodLevel: "all",
  foodSource: "all",
  memoryRank: "all",
  memoryType: "all",
  memoryTrait: "all",
};

var resultNotice = "";
var lastOptimizerResult = null;
var lastSandboxSnapshot = null;

// ─── Baseline helper ──────────────────────────────────────────────────────────

function getBaseline() {
  return {
    lifeExp: parseInt(el("b-life").value)   || 10,
    height:  parseInt(el("b-height").value) || 30,
    weight:  parseInt(el("b-weight").value) || 20,
  };
}

function getWeights() {
  return {
    craft: 5,
    farm: 5,
    mem: 5,
  };
}

// ─── Inventory and planning persistence helpers ──────────────────────────────

var PROFILE_STORAGE_KEY = "tlc-human-optimizer-profile-v2";
var LEGACY_INVENTORY_STORAGE_KEY = "tlc-human-optimizer-inventory-v1";

function defaultInventory() {
  var inv = { foods: {}, memories: {} };
  FOODS.forEach(function(f) { inv.foods[f.name] = 0; });
  MEMORIES.forEach(function(m) { inv.memories[m.name] = 0; });
  return inv;
}

function defaultSandbox() {
  var box = { foods: {}, memories: {} };
  FOODS.forEach(function(f) { box.foods[f.name] = 0; });
  MEMORIES.forEach(function(m) { box.memories[m.name] = 0; });
  return box;
}

function defaultSandboxFilters() {
  return { memories: [] };
}

function defaultPlan() {
  return {
    sessions: [{ id: 1, name: "Session 1" }],
    humans: [],
    flights: [],
    nextSessionId: 2,
    nextHumanId: 1,
    nextFlightId: 1,
  };
}

function defaultCreatedProfessions() {
  return {};
}

function normalizeInventory(raw) {
  var base = defaultInventory();
  if (!raw || typeof raw !== "object") return base;

  if (raw.foods && typeof raw.foods === "object") {
    FOODS.forEach(function(f) {
      var v = parseInt(raw.foods[f.name], 10);
      base.foods[f.name] = isNaN(v) ? 0 : Math.max(0, v);
    });
  }

  if (raw.memories && typeof raw.memories === "object") {
    MEMORIES.forEach(function(m) {
      var v = parseInt(raw.memories[m.name], 10);
      base.memories[m.name] = isNaN(v) ? 0 : Math.max(0, v);
    });
  }

  return base;
}

function normalizeSandbox(raw) {
  var base = defaultSandbox();
  if (!raw || typeof raw !== "object") return base;

  if (raw.foods && typeof raw.foods === "object") {
    FOODS.forEach(function(f) {
      var v = parseInt(raw.foods[f.name], 10);
      base.foods[f.name] = isNaN(v) ? 0 : Math.max(0, v);
    });
  }

  if (raw.memories && typeof raw.memories === "object") {
    MEMORIES.forEach(function(m) {
      var v = parseInt(raw.memories[m.name], 10);
      base.memories[m.name] = isNaN(v) ? 0 : Math.max(0, v);
    });
  }

  return base;
}

function normalizeCreatedProfessions(raw) {
  var out = defaultCreatedProfessions();
  if (!raw || typeof raw !== "object") return out;
  PROFESSIONS.forEach(function(p) {
    out[p.name] = !!raw[p.name];
  });
  return out;
}

function normalizeSandboxFilters(raw) {
  var out = defaultSandboxFilters();
  if (!raw || typeof raw !== "object") return out;
  var validMem = {};
  MEM_TRAITS.concat(SPECIAL_TRAITS).forEach(function(t) { validMem[t] = 1; });

  if (Array.isArray(raw.memories)) {
    out.memories = raw.memories.filter(function(t, idx, arr) {
      return !!validMem[t] && arr.indexOf(t) === idx;
    });
  }

  return out;
}

function cloneCountMap(raw) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  Object.keys(raw).forEach(function(k) {
    var v = parseInt(raw[k], 10);
    if (!isNaN(v) && v > 0) out[k] = v;
  });
  return out;
}

function normalizePlan(raw) {
  var base = defaultPlan();
  if (!raw || typeof raw !== "object") return base;

  var sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  base.sessions = sessions.map(function(s, idx) {
    var id = parseInt(s && s.id, 10);
    if (isNaN(id) || id <= 0) id = idx + 1;
    return {
      id: id,
      name: String((s && s.name) || ("Session " + id)),
    };
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
    var created = !!(h && h.created);
    var sent = !!(h && h.sent);
    var flightId = parseInt(h && h.flightId, 10);
    if (isNaN(flightId) || flightId <= 0) flightId = null;
    return {
      id: id,
      sessionId: sessionId,
      label: String((h && h.label) || "Planned human"),
      source: (h && h.source) === "sandbox" ? "sandbox" : "optimizer",
      professionName: String((h && h.professionName) || ""),
      chosenFood: cloneCountMap(h && h.chosenFood),
      chosenMem: cloneCountMap(h && h.chosenMem),
      created: created,
      sent: sent,
      flightId: sent ? flightId : null,
    };
  });

  var flights = Array.isArray(raw.flights) ? raw.flights : [];
  base.flights = flights.map(function(f, idx) {
    var id = parseInt(f && f.id, 10);
    if (isNaN(id) || id <= 0) id = idx + 1;
    var ids = Array.isArray(f && f.humanIds) ? f.humanIds.map(function(v) {
      var n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    }).filter(function(v) { return v !== null; }) : [];
    return { id: id, humanIds: ids.slice(0, 3) };
  });

  var maxSessionId = base.sessions.reduce(function(m, s) { return Math.max(m, s.id); }, 0);
  var maxHumanId = base.humans.reduce(function(m, h) { return Math.max(m, h.id); }, 0);
  var maxFlightId = base.flights.reduce(function(m, f) { return Math.max(m, f.id); }, 0);

  base.nextSessionId = Math.max(maxSessionId + 1, parseInt(raw.nextSessionId, 10) || 1);
  base.nextHumanId = Math.max(maxHumanId + 1, parseInt(raw.nextHumanId, 10) || 1);
  base.nextFlightId = Math.max(maxFlightId + 1, parseInt(raw.nextFlightId, 10) || 1);

  return base;
}

function normalizeTheme(raw) {
  return raw === "peco" ? "peco" : "default";
}

function normalizeTab(raw) {
  var valid = { optimizer:1, sandbox:1, plan:1, progress:1, professions:1, foods:1, memories:1, data:1 };
  return valid[raw] ? raw : "optimizer";
}

function normalizeProfessionMode(raw) {
  return raw === "direct" ? "direct" : "committee";
}

function normalizeBaseline(raw) {
  var out = { lifeExp: 10, height: 30, weight: 20 };
  if (!raw || typeof raw !== "object") return out;
  var le = parseInt(raw.lifeExp, 10);
  var ht = parseInt(raw.height, 10);
  var wt = parseInt(raw.weight, 10);
  out.lifeExp = isNaN(le) ? 10 : Math.max(10, le);
  out.height = isNaN(ht) ? 30 : Math.max(30, ht);
  out.weight = isNaN(wt) ? 20 : Math.max(20, wt);
  return out;
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-peco", theme === "peco");
}

function defaultProfile() {
  return {
    version: 2,
    inventory: defaultInventory(),
    sandbox: defaultSandbox(),
    sandboxFilters: defaultSandboxFilters(),
    sandboxHideCreated: false,
    plan: defaultPlan(),
    createdProfessions: defaultCreatedProfessions(),
    theme: "default",
    useInventory: true,
    excludeBioFlesh: false,
    excludeArtifact: false,
    activeTab: "optimizer",
    optimizerSessionAware: false,
    optimizerSessionNoDeficit: false,
    optimizerSessionId: null,
    professionMode: "committee",
    selectedProfession: null,
    baseline: { lifeExp: 10, height: 30, weight: 20 },
    ashAllowMultiPerProfession: false,
  };
}

function normalizeProfile(raw) {
  var base = defaultProfile();
  if (!raw || typeof raw !== "object") return base;
  base.inventory = normalizeInventory(raw.inventory);
  base.sandbox = normalizeSandbox(raw.sandbox);
  base.sandboxFilters = normalizeSandboxFilters(raw.sandboxFilters);
  base.sandboxHideCreated = !!raw.sandboxHideCreated;
  base.plan = normalizePlan(raw.plan);
  base.createdProfessions = normalizeCreatedProfessions(raw.createdProfessions);
  base.theme = normalizeTheme(raw.theme);
  base.useInventory = raw.useInventory !== false;
  base.excludeBioFlesh = !!raw.excludeBioFlesh;
  base.excludeArtifact = !!raw.excludeArtifact;
  base.activeTab = normalizeTab(raw.activeTab);
  base.optimizerSessionAware = !!raw.optimizerSessionAware;
  base.optimizerSessionNoDeficit = !!raw.optimizerSessionNoDeficit;
  base.optimizerSessionId = raw.optimizerSessionId == null ? null : parseInt(raw.optimizerSessionId, 10);
  if (isNaN(base.optimizerSessionId)) base.optimizerSessionId = null;
  base.professionMode = normalizeProfessionMode(raw.professionMode);
  base.selectedProfession = typeof raw.selectedProfession === "string" ? raw.selectedProfession : null;
  base.baseline = normalizeBaseline(raw.baseline);
  base.ashAllowMultiPerProfession = !!raw.ashAllowMultiPerProfession;
  return base;
}

function loadProfile() {
  try {
    var raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return normalizeProfile(JSON.parse(raw));

    var legacyRaw = localStorage.getItem(LEGACY_INVENTORY_STORAGE_KEY);
    if (legacyRaw) {
      return {
        version: 2,
        inventory: normalizeInventory(JSON.parse(legacyRaw)),
        sandbox: defaultSandbox(),
        sandboxFilters: defaultSandboxFilters(),
        plan: defaultPlan(),
        createdProfessions: defaultCreatedProfessions(),
      };
    }

    return defaultProfile();
  } catch (err) {
    return defaultProfile();
  }
}

function buildProfilePayload() {
  return {
    version: 2,
    inventory: appState.inventory,
    sandbox: appState.sandbox,
    sandboxFilters: normalizeSandboxFilters(appState.sandboxFilters),
    sandboxHideCreated: !!appState.sandboxHideCreated,
    plan: normalizePlan(appState.plan),
    createdProfessions: appState.createdProfessions,
    theme: normalizeTheme(appState.theme),
    useInventory: !!appState.useInventory,
    excludeBioFlesh: !!appState.excludeBioFlesh,
    excludeArtifact: !!appState.excludeArtifact,
    activeTab: normalizeTab(appState.activeTab),
    optimizerSessionAware: !!appState.optimizerSessionAware,
    optimizerSessionNoDeficit: !!appState.optimizerSessionNoDeficit,
    optimizerSessionId: appState.optimizerSessionId == null ? null : appState.optimizerSessionId,
    professionMode: normalizeProfessionMode(el("prof-mode") ? el("prof-mode").value : "committee"),
    selectedProfession: getSelectedProfessionName(),
    baseline: getBaseline(),
    ashAllowMultiPerProfession: !!(el("ash-allow-multi-prof") && el("ash-allow-multi-prof").checked),
  };
}

function setExcludeToggleUI(trackId, chipsId, stateKey, items) {
  var track = el(trackId);
  var chips = el(chipsId);
  if (!track || !chips) return;
  if (appState[stateKey]) {
    track.classList.add("on");
    chips.innerHTML = items.map(function(f) {
      return '<span class="chip">' + f + '</span>';
    }).join("");
  } else {
    track.classList.remove("on");
    chips.innerHTML = "";
  }
}

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(buildProfilePayload()));
  } catch (err) {
    // Ignore storage failures (private mode, quota, disabled storage).
  }
}

function setInventoryToggleUI() {
  if (appState.useInventory) el("inv-track").classList.add("on");
  else el("inv-track").classList.remove("on");
}

function createInventoryRow(kind, item, metaLabel) {
  var row = document.createElement("div");
  row.className = "inventory-row";

  var left = document.createElement("div");
  left.className = "inventory-name";
  left.textContent = item.name;

  if (metaLabel) {
    var meta = document.createElement("span");
    meta.className = "inventory-meta";
    meta.textContent = metaLabel;
    left.appendChild(meta);
  }

  var input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.className = "inv-input";
  input.value = String(appState.inventory[kind][item.name] || 0);

  input.addEventListener("change", function() {
    var v = parseInt(input.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    appState.inventory[kind][item.name] = v;
    input.value = String(v);
    saveProfile();
    renderSandboxEditors();
    renderPlanTab();
  });

  row.appendChild(left);
  row.appendChild(input);
  return row;
}

function renderInventoryEditors() {
  var foodWrap = el("food-inventory-list");
  var memWrap = el("memory-inventory-list");
  if (!foodWrap || !memWrap) return;
  foodWrap.innerHTML = "";
  memWrap.innerHTML = "";

  FOODS.slice().sort(function(a, b) {
    if (b.level !== a.level) return b.level - a.level;
    return a.name.localeCompare(b.name);
  }).forEach(function(food) {
    foodWrap.appendChild(createInventoryRow("foods", food, "Lv " + food.level));
  });

  MEMORIES.slice().sort(function(a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.name.localeCompare(b.name);
  }).forEach(function(mem) {
    var rankLabel = MEM_RANK_LABELS[mem.rank] || "Rank " + mem.rank;
    memWrap.appendChild(createInventoryRow("memories", mem, rankLabel));
  });
}

function getTraitHue(trait) {
  var hash = 0;
  for (var i = 0; i < trait.length; i++) {
    hash = ((hash * 31) + trait.charCodeAt(i)) % 360;
  }
  return hash;
}

function appendSandboxTraitPills(container, item, traitKeys) {
  var row = document.createElement("div");
  row.className = "trait-pill-row sandbox-trait-row";
  var hasAny = false;

  traitKeys.forEach(function(t) {
    var val = item[t] || 0;
    if (val <= 0) return;
    hasAny = true;

    var pill = document.createElement("span");
    pill.className = "trait-pill sandbox-trait-pill";
    pill.style.setProperty("--trait-h", String(getTraitHue(t)));
    pill.textContent = (TRAIT_LABELS[t] || t) + " +" + val;
    row.appendChild(pill);
  });

  if (!hasAny) {
    var none = document.createElement("span");
    none.className = "muted-inline";
    none.textContent = "No traits";
    row.appendChild(none);
  }

  container.appendChild(row);
}

function formatSandboxNeedPills(missing) {
  if (!missing || !missing.length) {
    return '<span class="trait-pill secondary">Complete</span>';
  }
  return '<div class="sandbox-need-pill-row">' + missing.map(function(x) {
    return '<span class="trait-pill sandbox-trait-pill" style="--trait-h:' + getTraitHue(x.trait) + '">' +
      escapeHtml(TRAIT_LABELS[x.trait] || x.trait) + ' +' + x.need +
      '</span>';
  }).join("") + '</div>';
}

function renderSandboxTraitFilters() {
  var memWrap = el("sandbox-memory-trait-filters");
  if (!memWrap) return;

  var memSelected = normalizeSandboxFilters(appState.sandboxFilters).memories;
  var memSet = {};
  memSelected.forEach(function(t) { memSet[t] = 1; });

  memWrap.innerHTML = MEM_TRAITS.concat(SPECIAL_TRAITS).map(function(t) {
    return '<button type="button" class="filter-chip sandbox-trait-filter' + (memSet[t] ? ' active' : '') + '" data-trait="' + escapeHtml(t) + '" style="--trait-h:' + getTraitHue(t) + '">' + escapeHtml(TRAIT_LABELS[t]) + '</button>';
  }).join("");

  Array.prototype.forEach.call(memWrap.querySelectorAll(".filter-chip"), function(node) {
    node.addEventListener("click", function() {
      var trait = node.getAttribute("data-trait");
      var next = (appState.sandboxFilters && appState.sandboxFilters.memories) ? appState.sandboxFilters.memories.slice() : [];
      var idx = next.indexOf(trait);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(trait);
      appState.sandboxFilters.memories = next;
      saveProfile();
      renderSandboxEditors();
    });
  });
}

function createSandboxRow(kind, item, metaLabel, imagePath, traitKeys) {
  var card = document.createElement("article");
  card.className = "sandbox-card";

  var head = document.createElement("div");
  head.className = "sandbox-card-head";

  var main = document.createElement("div");
  main.className = "sandbox-card-main";

  var img = document.createElement("img");
  img.className = "sandbox-thumb";
  img.src = imagePath;
  img.alt = item.name;
  img.loading = "lazy";
  img.decoding = "async";
  img.onerror = function() { this.onerror = null; this.src = "images/placeholder.png"; };
  main.appendChild(img);

  var nameWrap = document.createElement("span");
  nameWrap.className = "sandbox-name-wrap";

  var title = document.createElement("span");
  title.textContent = item.name;
  nameWrap.appendChild(title);

  if (metaLabel) {
    var meta = document.createElement("span");
    meta.className = "inventory-meta";
    meta.textContent = metaLabel;
    nameWrap.appendChild(meta);
  }

  main.appendChild(nameWrap);
  head.appendChild(main);

  var invCount = kind === "foods"
    ? (appState.inventory.foods[item.name] || 0)
    : (appState.inventory.memories[item.name] || 0);
  var stock = document.createElement("span");
  stock.className = "sandbox-stock";
  stock.textContent = "Inv " + invCount;
  head.appendChild(stock);

  card.appendChild(head);
  appendSandboxTraitPills(card, item, traitKeys);

  var qtyRow = document.createElement("div");
  qtyRow.className = "sandbox-qty-row";

  var qtyLabel = document.createElement("label");
  qtyLabel.className = "sandbox-qty-label";
  qtyLabel.textContent = "Sandbox qty";

  var input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.className = "inv-input sandbox-input";
  input.value = String(appState.sandbox[kind][item.name] || 0);

  input.id = "sandbox-qty-" + kind + "-" + toAssetStem(item.name);
  qtyLabel.setAttribute("for", input.id);

  input.addEventListener("change", function() {
    var v = parseInt(input.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    appState.sandbox[kind][item.name] = v;
    input.value = String(v);
    saveProfile();
    renderSandboxResults();
  });

  qtyRow.appendChild(qtyLabel);
  qtyRow.appendChild(input);
  card.appendChild(qtyRow);

  return card;
}

function renderSandboxEditors() {
  var foodWrap = el("sandbox-food-list");
  var memWrap = el("sandbox-memory-list");
  if (!foodWrap || !memWrap) return;
  appState.sandboxFilters = normalizeSandboxFilters(appState.sandboxFilters);
  renderSandboxTraitFilters();
  foodWrap.innerHTML = "";
  memWrap.innerHTML = "";

  var activeMemTraits = appState.sandboxFilters.memories || [];

  FOODS.slice().sort(function(a, b) {
    if (b.level !== a.level) return b.level - a.level;
    return a.name.localeCompare(b.name);
  }).forEach(function(food) {
    foodWrap.appendChild(createSandboxRow("foods", food, "Lv " + food.level, getFoodImagePath(food.name), PHYS_TRAITS));
  });

  MEMORIES.slice().sort(function(a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.name.localeCompare(b.name);
  }).filter(function(mem) {
    return activeMemTraits.every(function(t) { return (mem[t] || 0) > 0; });
  }).forEach(function(mem) {
    var rankLabel = MEM_RANK_LABELS[mem.rank] || ("Rank " + mem.rank);
    memWrap.appendChild(createSandboxRow("memories", mem, rankLabel, getMemoryImagePath(mem.name), MEM_TRAITS.concat(SPECIAL_TRAITS)));
  });

  if (!foodWrap.children.length) {
    foodWrap.innerHTML = '<div class="info-box">No foods match the active trait filters.</div>';
  }
  if (!memWrap.children.length) {
    memWrap.innerHTML = '<div class="info-box">No memories match the active trait filters.</div>';
  }
}

function getSandboxProfessionProgressRows(achieved) {
  var allTraits = PHYS_TRAITS.concat(PERS_TRAITS, SPECIAL_TRAITS);
  var rows = [];

  PROFESSIONS.forEach(function(prof) {
    var reqByTrait = {};
    var reqTotal = 0;
    var gotTotal = 0;

    allTraits.forEach(function(t) {
      var req = Math.max(prof[t] || 0, HARD_MIN[t] || 0);
      if (req <= 0) return;
      reqByTrait[t] = req;
      reqTotal += req;
      gotTotal += Math.min(req, achieved[t] || 0);
    });

    var pct = reqTotal > 0 ? Math.round((gotTotal / reqTotal) * 100) : 0;
    var missing = Object.keys(reqByTrait).map(function(t) {
      return { trait: t, need: Math.max(0, reqByTrait[t] - (achieved[t] || 0)) };
    }).filter(function(x) { return x.need > 0; })
      .sort(function(a, b) { return b.need - a.need; });

    rows.push({
      prof: prof,
      pct: pct,
      gotTotal: gotTotal,
      reqTotal: reqTotal,
      missing: missing,
    });
  });

  rows.sort(function(a, b) {
    if (b.pct !== a.pct) return b.pct - a.pct;
    if ((b.prof.tier || 0) !== (a.prof.tier || 0)) return (b.prof.tier || 0) - (a.prof.tier || 0);
    if (b.gotTotal !== a.gotTotal) return b.gotTotal - a.gotTotal;
    return a.prof.name.localeCompare(b.prof.name);
  });

  return rows;
}

function renderSandboxResults() {
  var out = el("sandbox-results");
  if (!out) return;

  var achievedFood = {};
  PHYS_TRAITS.forEach(function(t) { achievedFood[t] = 0; });

  var achievedMem = {};
  PERS_TRAITS.forEach(function(t) { achievedMem[t] = 0; });
  achievedMem.starChild = 0;

  var foodCount = 0;
  var memoryCount = 0;

  for (var fname in appState.sandbox.foods) {
    var fc = appState.sandbox.foods[fname] || 0;
    if (fc <= 0) continue;
    var f = getFood(fname);
    if (!f) continue;
    foodCount += fc;
    PHYS_TRAITS.forEach(function(t) { achievedFood[t] += (f[t] || 0) * fc; });
  }

  for (var mname in appState.sandbox.memories) {
    var mc = appState.sandbox.memories[mname] || 0;
    if (mc <= 0) continue;
    var m = getMemory(mname);
    if (!m) continue;
    memoryCount += mc;
    PERS_TRAITS.forEach(function(t) { achievedMem[t] += (m[t] || 0) * mc; });
    achievedMem.starChild += (m.starChild || 0) * mc;
  }

  var achieved = {};
  PHYS_TRAITS.forEach(function(t) { achieved[t] = achievedFood[t] || 0; });
  PERS_TRAITS.forEach(function(t) { achieved[t] = achievedMem[t] || 0; });
  achieved.starChild = achievedMem.starChild || 0;

  var progressRows = getSandboxProfessionProgressRows(achieved);
  if (appState.sandboxHideCreated) {
    progressRows = progressRows.filter(function(row) {
      return !appState.createdProfessions[row.prof.name];
    });
  }
  var qualifiedCount = progressRows.filter(function(row) { return row.pct >= 100; }).length;
  var topQualified = progressRows.find(function(row) { return row.pct >= 100; }) || null;
  var closest = progressRows.length ? progressRows[0] : null;

  var h = "";
  h += '<div class="section-label">Sandbox summary</div>';
  h += '<div class="score-grid">';
  h += '<div class="sc"><div class="sl">Food items</div><div class="sv">' + foodCount + '</div></div>';
  h += '<div class="sc"><div class="sl">Memory items</div><div class="sv">' + memoryCount + '</div></div>';
  h += '<div class="sc"><div class="sl">Qualified professions</div><div class="sv">' + qualifiedCount + '</div></div>';
  h += '</div>';

  if (topQualified) {
    h += '<div class="info-box sandbox-likely">Most likely resulting profession: <strong>' + escapeHtml(topQualified.prof.name) + '</strong> (Tier ' + topQualified.prof.tier + ', ' + escapeHtml(topQualified.prof.committee || 'No committee') + ').</div>';
  } else if (closest) {
    h += '<div class="info-box sandbox-likely">No profession is fully satisfied yet. Closest match: <strong>' + escapeHtml(closest.prof.name) + '</strong> at ' + closest.pct + '%.</div>';
  }
  h += '<div class="inventory-actions">';
  h += '<button type="button" class="mini-btn" id="sandbox-add-plan-btn">Add Sandbox human to Plan</button>';
  h += '</div>';

  h += '<div class="section-label">Physical traits from sandbox</div>';
  h += '<div class="cov-grid">';
  PHYS_TRAITS.forEach(function(t) {
    var v = achieved[t] || 0;
    if (v <= 0) return;
    h += '<div class="cv">';
    h += '<div class="cn">' + TRAIT_LABELS[t] + '</div>';
    h += '<div class="cnum">' + v + '</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '<div class="section-label">Personality traits from sandbox</div>';
  h += '<div class="cov-grid">';
  PERS_TRAITS.concat(SPECIAL_TRAITS).forEach(function(t) {
    var v = achieved[t] || 0;
    if (v <= 0) return;
    h += '<div class="cv cv-mem">';
    h += '<div class="cn">' + TRAIT_LABELS[t] + '</div>';
    h += '<div class="cnum">' + v + '</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '<div class="section-label">Profession fulfillment</div>';
  if (!progressRows.length) {
    h += '<div class="info-box">' + (appState.sandboxHideCreated ? 'No remaining professions to show. Try turning off "Hide professions marked as created".' : 'No profession data available.') + '</div>';
  } else {
    h += '<div class="table-wrap"><table class="simple-table sandbox-fulfillment-table"><thead><tr><th class="sandbox-prof-head">Profession</th><th>Tier</th><th class="sandbox-committee-head">Committee</th><th>Fulfillment</th><th class="sandbox-need-head">What to add</th></tr></thead><tbody>';
    progressRows.slice(0, 40).forEach(function(q) {
      h += '<tr>';
      h += '<td class="sandbox-prof-cell">' + escapeHtml(q.prof.name) + '</td>';
      h += '<td>Tier ' + q.prof.tier + '</td>';
      h += '<td class="sandbox-committee-cell">' + escapeHtml(q.prof.committee || '—') + '</td>';
      h += '<td>' + q.pct + '% (' + q.gotTotal + '/' + q.reqTotal + ')</td>';
      h += '<td class="sandbox-need-cell">' + formatSandboxNeedPills(q.missing) + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table></div>';
  }

  out.innerHTML = h;

  lastSandboxSnapshot = {
    label: topQualified ? topQualified.prof.name : (closest ? (closest.prof.name + " (closest)") : "Sandbox custom"),
    professionName: topQualified ? topQualified.prof.name : (closest ? closest.prof.name : ""),
    chosenFood: cloneCountMap(appState.sandbox.foods),
    chosenMem: cloneCountMap(appState.sandbox.memories),
  };

  var sandboxAddPlanBtn = el("sandbox-add-plan-btn");
  if (sandboxAddPlanBtn) {
    sandboxAddPlanBtn.addEventListener("click", function() {
      if (!lastSandboxSnapshot) return;
      addHumanPlanEntry("sandbox", lastSandboxSnapshot.label, lastSandboxSnapshot.professionName, lastSandboxSnapshot.chosenFood, lastSandboxSnapshot.chosenMem);
    });
  }
}

function getPlanSessionById(sessionId) {
  if (!appState.plan || !Array.isArray(appState.plan.sessions)) return null;
  for (var i = 0; i < appState.plan.sessions.length; i++) {
    if (appState.plan.sessions[i].id === sessionId) return appState.plan.sessions[i];
  }
  return null;
}

function getPlanHumanById(humanId) {
  if (!appState.plan || !Array.isArray(appState.plan.humans)) return null;
  for (var i = 0; i < appState.plan.humans.length; i++) {
    if (appState.plan.humans[i].id === humanId) return appState.plan.humans[i];
  }
  return null;
}

function countHumansInSession(sessionId) {
  if (!appState.plan || !Array.isArray(appState.plan.humans)) return 0;
  return appState.plan.humans.filter(function(h) { return h.sessionId === sessionId; }).length;
}

function getFirstSessionWithCapacity() {
  var sessions = (appState.plan && appState.plan.sessions) ? appState.plan.sessions.slice() : [];
  sessions.sort(function(a, b) { return a.id - b.id; });
  for (var i = 0; i < sessions.length; i++) {
    if (countHumansInSession(sessions[i].id) < 4) return sessions[i];
  }
  return null;
}

function addPlanSession() {
  if (!appState.plan) appState.plan = defaultPlan();
  var id = appState.plan.nextSessionId || 1;
  appState.plan.nextSessionId = id + 1;
  appState.plan.sessions.push({ id: id, name: "Session " + id });
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function removePlanSession(sessionId) {
  if (countHumansInSession(sessionId) > 0) {
    window.alert("Move or remove humans from this session before deleting it.");
    return;
  }
  if ((appState.plan.sessions || []).length <= 1) {
    window.alert("At least one session is required.");
    return;
  }
  appState.plan.sessions = appState.plan.sessions.filter(function(s) { return s.id !== sessionId; });
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function getOpenFlight() {
  var flights = appState.plan.flights || [];
  flights.sort(function(a, b) { return a.id - b.id; });
  for (var i = flights.length - 1; i >= 0; i--) {
    if ((flights[i].humanIds || []).length < 3) return flights[i];
  }
  return null;
}

function getFlightById(flightId) {
  var flights = appState.plan.flights || [];
  for (var i = 0; i < flights.length; i++) {
    if (flights[i].id === flightId) return flights[i];
  }
  return null;
}

function ensureFlightForHuman(human) {
  var flight = getOpenFlight();
  if (!flight) {
    flight = { id: appState.plan.nextFlightId || 1, humanIds: [] };
    appState.plan.nextFlightId = (flight.id || 0) + 1;
    appState.plan.flights.push(flight);
  }
  if (flight.humanIds.indexOf(human.id) < 0) {
    flight.humanIds.push(human.id);
  }
  human.sent = true;
  human.flightId = flight.id;
}

function removeHumanFromFlight(human) {
  if (!human.flightId) {
    human.sent = false;
    return;
  }
  appState.plan.flights.forEach(function(f) {
    f.humanIds = (f.humanIds || []).filter(function(id) { return id !== human.id; });
  });
  appState.plan.flights = appState.plan.flights.filter(function(f) { return (f.humanIds || []).length > 0; });
  human.sent = false;
  human.flightId = null;
}

function assignHumanToRocket(humanId, target) {
  var human = getPlanHumanById(humanId);
  if (!human) return;

  if (target !== "none" && !human.created) {
    window.alert("Mark this human as created before assigning to a rocket.");
    renderPlanTab();
    return;
  }

  if (target === "none") {
    removeHumanFromFlight(human);
    saveProfile();
    renderPlanTab();
    refreshProgressViews();
    return;
  }

  if (human.sent) removeHumanFromFlight(human);

  if (target === "new") {
    ensureFlightForHuman(human);
    saveProfile();
    renderPlanTab();
    refreshProgressViews();
    return;
  }

  var rocketId = parseInt(target, 10);
  if (isNaN(rocketId)) {
    renderPlanTab();
    return;
  }

  var rocket = getFlightById(rocketId);
  if (!rocket) {
    window.alert("Selected rocket no longer exists.");
    renderPlanTab();
    return;
  }

  if ((rocket.humanIds || []).length >= 3) {
    window.alert("That rocket is full (max 3 humans).");
    renderPlanTab();
    return;
  }

  rocket.humanIds.push(human.id);
  human.sent = true;
  human.flightId = rocket.id;
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function setHumanSession(humanId, sessionId) {
  var human = getPlanHumanById(humanId);
  if (!human) return;
  if (human.sessionId === sessionId) return;
  if (countHumansInSession(sessionId) >= 4) {
    window.alert("That session already has 4 planned humans.");
    renderPlanTab();
    return;
  }
  human.sessionId = sessionId;
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function setHumanCreated(humanId, created) {
  var human = getPlanHumanById(humanId);
  if (!human) return;
  human.created = !!created;
  if (!human.created && human.sent) {
    removeHumanFromFlight(human);
  }
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function toggleHumanSent(humanId) {
  var human = getPlanHumanById(humanId);
  if (!human) return;
  if (!human.sent) {
    if (!human.created) {
      window.alert("Mark this human as created before sending to space.");
      return;
    }
    ensureFlightForHuman(human);
  } else {
    removeHumanFromFlight(human);
  }
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function removePlanHuman(humanId) {
  var human = getPlanHumanById(humanId);
  if (!human) return;
  if (human.sent) removeHumanFromFlight(human);
  appState.plan.humans = appState.plan.humans.filter(function(h) { return h.id !== humanId; });
  saveProfile();
  renderPlanTab();
  refreshProgressViews();
}

function addHumanPlanEntry(source, label, professionName, chosenFood, chosenMem) {
  appState.plan = normalizePlan(appState.plan);
  var session = getFirstSessionWithCapacity();
  if (!session) {
    window.alert("All sessions are full (max 4 each). Add another session first.");
    setActiveTab("plan");
    return;
  }

  var totalFood = Object.keys(chosenFood || {}).reduce(function(sum, k) { return sum + (chosenFood[k] || 0); }, 0);
  var totalMem = Object.keys(chosenMem || {}).reduce(function(sum, k) { return sum + (chosenMem[k] || 0); }, 0);
  if (totalFood <= 0 && totalMem <= 0) {
    window.alert("Nothing to add. This plan has zero food and memory quantities.");
    return;
  }

  var humanId = appState.plan.nextHumanId || 1;
  appState.plan.nextHumanId = humanId + 1;

  appState.plan.humans.push({
    id: humanId,
    sessionId: session.id,
    label: label || "Planned human",
    source: source === "sandbox" ? "sandbox" : "optimizer",
    professionName: professionName || "",
    chosenFood: cloneCountMap(chosenFood),
    chosenMem: cloneCountMap(chosenMem),
    created: false,
    sent: false,
    flightId: null,
  });

  saveProfile();
  renderPlanTab();
  refreshProgressViews();
  setActiveTab("plan");
}

function buildPlanInventoryUsage() {
  var usage = { foods: {}, memories: {} };
  (appState.plan.humans || []).forEach(function(h) {
    if (h.sent) return;
    Object.keys(h.chosenFood || {}).forEach(function(name) {
      usage.foods[name] = (usage.foods[name] || 0) + (h.chosenFood[name] || 0);
    });
    Object.keys(h.chosenMem || {}).forEach(function(name) {
      usage.memories[name] = (usage.memories[name] || 0) + (h.chosenMem[name] || 0);
    });
  });
  return usage;
}

function buildSessionInventoryUsage(sessionId) {
  var usage = { foods: {}, memories: {} };
  (appState.plan.humans || []).forEach(function(h) {
    if (h.sent) return;
    if (h.sessionId !== sessionId) return;
    Object.keys(h.chosenFood || {}).forEach(function(name) {
      usage.foods[name] = (usage.foods[name] || 0) + (h.chosenFood[name] || 0);
    });
    Object.keys(h.chosenMem || {}).forEach(function(name) {
      usage.memories[name] = (usage.memories[name] || 0) + (h.chosenMem[name] || 0);
    });
  });
  return usage;
}

function getShortageRowsForUsage(usage) {
  var rows = [];
  Object.keys(usage.foods || {}).forEach(function(name) {
    var need = usage.foods[name] || 0;
    var have = appState.inventory.foods[name] || 0;
    if (need > have) rows.push({ kind: "Food", name: name, need: need, have: have, short: need - have });
  });
  Object.keys(usage.memories || {}).forEach(function(name) {
    var need = usage.memories[name] || 0;
    var have = appState.inventory.memories[name] || 0;
    if (need > have) rows.push({ kind: "Memory", name: name, need: need, have: have, short: need - have });
  });
  rows.sort(function(a, b) { return b.short - a.short; });
  return rows;
}

function formatPlanLoadoutPills(countMap, itemKind) {
  var keys = Object.keys(countMap || {});
  if (!keys.length) {
    return '<span class="muted-inline">No ' + itemKind + ' assigned</span>';
  }
  keys.sort(function(a, b) {
    var diff = (countMap[b] || 0) - (countMap[a] || 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  return '<div class="plan-loadout-row">' + keys.map(function(name) {
    return '<span class="trait-pill secondary plan-item-pill">' + escapeHtml(name) + ' x' + (countMap[name] || 0) + '</span>';
  }).join('') + '</div>';
}

function renderPlanTab() {
  var summaryEl = el("plan-summary");
  var flightEl = el("plan-flight-list");
  var sessionsEl = el("plan-session-list");
  if (!summaryEl || !flightEl || !sessionsEl) return;

  appState.plan = normalizePlan(appState.plan);
  populateOptimizerSessionSelect();

  var usage = buildPlanInventoryUsage();
  var totalHumans = (appState.plan.humans || []).length;
  var createdCount = (appState.plan.humans || []).filter(function(h) { return h.created; }).length;
  var sentCount = (appState.plan.humans || []).filter(function(h) { return h.sent; }).length;

  var shortageRows = getShortageRowsForUsage(usage);

  var s = "";
  s += '<div class="score-grid">';
  s += '<div class="sc"><div class="sl">Sessions</div><div class="sv">' + appState.plan.sessions.length + '</div></div>';
  s += '<div class="sc"><div class="sl">Planned humans</div><div class="sv">' + totalHumans + '</div></div>';
  s += '<div class="sc"><div class="sl">Created</div><div class="sv">' + createdCount + '</div></div>';
  s += '<div class="sc"><div class="sl">Sent to space</div><div class="sv">' + sentCount + '</div></div>';
  s += '</div>';

  s += '<div class="section-label">Inventory impact (not yet sent)</div>';
  if (!Object.keys(usage.foods).length && !Object.keys(usage.memories).length) {
    s += '<div class="info-box">No planned inventory usage yet.</div>';
  } else {
    s += '<div class="table-wrap"><table class="simple-table"><thead><tr><th>Type</th><th>Item</th><th>Current</th><th>Planned</th><th>Remaining</th></tr></thead><tbody>';
    Object.keys(usage.foods).sort().forEach(function(name) {
      var need = usage.foods[name] || 0;
      var have = appState.inventory.foods[name] || 0;
      s += '<tr><td>Food</td><td>' + escapeHtml(name) + '</td><td>' + have + '</td><td>' + need + '</td><td>' + (have - need) + '</td></tr>';
    });
    Object.keys(usage.memories).sort().forEach(function(name) {
      var need = usage.memories[name] || 0;
      var have = appState.inventory.memories[name] || 0;
      s += '<tr><td>Memory</td><td>' + escapeHtml(name) + '</td><td>' + have + '</td><td>' + need + '</td><td>' + (have - need) + '</td></tr>';
    });
    s += '</tbody></table></div>';
  }

  s += '<div class="section-label">Need to craft (deficit)</div>';
  if (!shortageRows.length) {
    s += '<div class="info-box">No deficit. Current inventory fully covers unsent planned humans.</div>';
  } else {
    s += '<div class="table-wrap"><table class="simple-table"><thead><tr><th>Type</th><th>Item</th><th>Short</th><th>Current</th><th>Planned</th></tr></thead><tbody>';
    shortageRows.forEach(function(r) {
      s += '<tr><td>' + r.kind + '</td><td>' + escapeHtml(r.name) + '</td><td>' + r.short + '</td><td>' + r.have + '</td><td>' + r.need + '</td></tr>';
    });
    s += '</tbody></table></div>';
  }
  summaryEl.innerHTML = s;

  var flightHtml = "";
  if (!appState.plan.flights.length) {
    flightHtml = '<div class="info-box">No rockets assigned yet. Assign created humans to rockets (max 3 per rocket).</div>';
  } else {
    appState.plan.flights.slice().sort(function(a, b) { return a.id - b.id; }).forEach(function(flight) {
      var names = (flight.humanIds || []).map(function(id) {
        var h = getPlanHumanById(id);
        return h ? escapeHtml(h.label) : ("#" + id);
      }).join(", ");
      flightHtml += '<div class="info-box">Rocket ' + flight.id + ' (' + (flight.humanIds || []).length + '/3): ' + (names || 'Empty') + '</div>';
    });
  }
  flightEl.innerHTML = flightHtml;

  var sessionsHtml = "";
  appState.plan.sessions.slice().sort(function(a, b) { return a.id - b.id; }).forEach(function(session) {
    var count = countHumansInSession(session.id);
    sessionsHtml += '<article class="reference-card">';
    sessionsHtml += '<div class="reference-card-header">';
    sessionsHtml += '<div class="reference-card-head-main"><div>';
    sessionsHtml += '<input type="text" class="number-input plan-session-name" data-session-id="' + session.id + '" value="' + escapeHtml(session.name) + '">';
    sessionsHtml += '<div class="reference-card-meta">' + count + ' / 4 planned</div>';
    sessionsHtml += '</div></div>';
    sessionsHtml += '<button type="button" class="mini-btn plan-remove-session-btn" data-session-id="' + session.id + '" title="Delete empty session">Delete</button>';
    sessionsHtml += '</div>';

    var humans = appState.plan.humans.filter(function(h) { return h.sessionId === session.id; });
    humans.sort(function(a, b) { return a.id - b.id; });

    if (!humans.length) {
      sessionsHtml += '<div class="muted-inline">No planned humans in this session.</div>';
    } else {
      humans.forEach(function(human) {
        var foodTotal = Object.keys(human.chosenFood || {}).reduce(function(sum, k) { return sum + (human.chosenFood[k] || 0); }, 0);
        var memTotal = Object.keys(human.chosenMem || {}).reduce(function(sum, k) { return sum + (human.chosenMem[k] || 0); }, 0);
        sessionsHtml += '<div class="plan-human-row">';
        sessionsHtml += '<div class="plan-human-main">';
        sessionsHtml += '<div class="fname">' + escapeHtml(human.label) + '</div>';
        sessionsHtml += '<div class="fsub">Source: ' + (human.source === 'sandbox' ? 'Sandbox' : 'Optimizer') + (human.professionName ? (' • Profession: ' + escapeHtml(human.professionName)) : '') + '</div>';
        sessionsHtml += '<div class="fsub">Food items: ' + foodTotal + ' • Memory items: ' + memTotal + '</div>';
        sessionsHtml += '<div class="fsub plan-loadout-label">Food assignment</div>';
        sessionsHtml += formatPlanLoadoutPills(human.chosenFood, 'foods');
        sessionsHtml += '<div class="fsub plan-loadout-label">Memory assignment</div>';
        sessionsHtml += formatPlanLoadoutPills(human.chosenMem, 'memories');
        sessionsHtml += '<div class="fsub">Status: ' + (human.sent ? 'Sent to space' : (human.created ? 'Created (not sent)' : 'Planned')) + (human.flightId ? (' • Rocket ' + human.flightId) : '') + '</div>';
        sessionsHtml += '</div>';
        sessionsHtml += '<div class="plan-human-actions">';
        sessionsHtml += '<select class="plan-move-select" data-human-id="' + human.id + '" title="Move to another session">';
        appState.plan.sessions.forEach(function(ses) {
          sessionsHtml += '<option value="' + ses.id + '"' + (ses.id === human.sessionId ? ' selected' : '') + '>' + escapeHtml(ses.name) + '</option>';
        });
        sessionsHtml += '</select>';
        sessionsHtml += '<button type="button" class="mini-btn plan-created-btn" data-human-id="' + human.id + '">' + (human.created ? 'Mark uncreated' : 'Mark created') + '</button>';
        sessionsHtml += '<select class="plan-rocket-select" data-human-id="' + human.id + '" title="Assign rocket">';
        sessionsHtml += '<option value="none"' + (!human.sent ? ' selected' : '') + '>Not sent</option>';
        (appState.plan.flights || []).slice().sort(function(a, b) { return a.id - b.id; }).forEach(function(flight) {
          var countInRocket = (flight.humanIds || []).length;
          var inThisRocket = human.flightId === flight.id;
          var disabled = (!inThisRocket && countInRocket >= 3) ? ' disabled' : '';
          sessionsHtml += '<option value="' + flight.id + '"' + (inThisRocket ? ' selected' : '') + disabled + '>Rocket ' + flight.id + ' (' + countInRocket + '/3)</option>';
        });
        sessionsHtml += '<option value="new">New rocket</option>';
        sessionsHtml += '</select>';
        sessionsHtml += '<button type="button" class="mini-btn mini-btn-danger plan-remove-human-btn" data-human-id="' + human.id + '">Remove</button>';
        sessionsHtml += '</div>';
        sessionsHtml += '</div>';
      });

      var sessionUsage = buildSessionInventoryUsage(session.id);
      var sessionShortages = getShortageRowsForUsage(sessionUsage);
      sessionsHtml += '<div class="section-label">Need to craft for this session</div>';
      if (!sessionShortages.length) {
        sessionsHtml += '<div class="info-box">No session deficit against current inventory.</div>';
      } else {
        sessionsHtml += '<div class="table-wrap"><table class="simple-table"><thead><tr><th>Type</th><th>Item</th><th>Short</th><th>Current</th><th>Session need</th></tr></thead><tbody>';
        sessionShortages.forEach(function(r) {
          sessionsHtml += '<tr><td>' + r.kind + '</td><td>' + escapeHtml(r.name) + '</td><td>' + r.short + '</td><td>' + r.have + '</td><td>' + r.need + '</td></tr>';
        });
        sessionsHtml += '</tbody></table></div>';
      }
    }

    sessionsHtml += '</article>';
  });
  sessionsEl.innerHTML = sessionsHtml;

  Array.prototype.forEach.call(document.querySelectorAll('.plan-session-name'), function(node) {
    node.addEventListener('change', function() {
      var sessionId = parseInt(node.getAttribute('data-session-id'), 10);
      var session = getPlanSessionById(sessionId);
      if (!session) return;
      var nextName = String(node.value || '').trim();
      session.name = nextName || ('Session ' + session.id);
      node.value = session.name;
      saveProfile();
      renderPlanTab();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.plan-remove-session-btn'), function(node) {
    node.addEventListener('click', function() {
      var sessionId = parseInt(node.getAttribute('data-session-id'), 10);
      removePlanSession(sessionId);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.plan-move-select'), function(node) {
    node.addEventListener('change', function() {
      var humanId = parseInt(node.getAttribute('data-human-id'), 10);
      var targetSessionId = parseInt(node.value, 10);
      setHumanSession(humanId, targetSessionId);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.plan-created-btn'), function(node) {
    node.addEventListener('click', function() {
      var humanId = parseInt(node.getAttribute('data-human-id'), 10);
      var human = getPlanHumanById(humanId);
      if (!human) return;
      setHumanCreated(humanId, !human.created);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.plan-rocket-select'), function(node) {
    node.addEventListener('change', function() {
      var humanId = parseInt(node.getAttribute('data-human-id'), 10);
      assignHumanToRocket(humanId, node.value);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.plan-remove-human-btn'), function(node) {
    node.addEventListener('click', function() {
      var humanId = parseInt(node.getAttribute('data-human-id'), 10);
      removePlanHuman(humanId);
    });
  });
}

function exportInventoryJson() {
  var payload = buildProfilePayload();
  payload.exportedAt = new Date().toISOString();
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "tlc-human-optimizer-plan.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importInventoryText(text) {
  try {
    var parsed = JSON.parse(text);

    // Backward compatibility: older files may only contain inventory payload.
    if (parsed && parsed.foods && parsed.memories) {
      appState.inventory = normalizeInventory(parsed);
      appState.sandbox = defaultSandbox();
      appState.sandboxFilters = defaultSandboxFilters();
      appState.sandboxHideCreated = false;
      appState.plan = defaultPlan();
      appState.ashAllowMultiPerProfession = false;
      appState.optimizerSessionAware = false;
      appState.optimizerSessionNoDeficit = false;
      appState.optimizerSessionId = null;
    } else if (parsed && parsed.inventory && !parsed.baseline && !parsed.professionMode && parsed.version === 2) {
      appState.inventory = normalizeInventory(parsed.inventory);
      appState.sandbox = normalizeSandbox(parsed.sandbox);
      appState.sandboxFilters = normalizeSandboxFilters(parsed.sandboxFilters);
      appState.sandboxHideCreated = !!parsed.sandboxHideCreated;
      appState.plan = normalizePlan(parsed.plan);
      appState.ashAllowMultiPerProfession = !!parsed.ashAllowMultiPerProfession;
      appState.optimizerSessionAware = !!parsed.optimizerSessionAware;
      appState.optimizerSessionNoDeficit = !!parsed.optimizerSessionNoDeficit;
      appState.optimizerSessionId = parsed.optimizerSessionId == null ? null : parseInt(parsed.optimizerSessionId, 10);
      if (isNaN(appState.optimizerSessionId)) appState.optimizerSessionId = null;
      appState.createdProfessions = normalizeCreatedProfessions(parsed && parsed.createdProfessions);
    } else {
      var normalized = normalizeProfile(parsed);
      appState.inventory = normalized.inventory;
      appState.sandbox = normalized.sandbox;
      appState.sandboxFilters = normalized.sandboxFilters;
      appState.sandboxHideCreated = !!normalized.sandboxHideCreated;
      appState.plan = normalized.plan;
      appState.createdProfessions = normalized.createdProfessions;
      appState.theme = normalized.theme;
      appState.useInventory = normalized.useInventory;
      appState.excludeBioFlesh = normalized.excludeBioFlesh;
      appState.excludeArtifact = normalized.excludeArtifact;
      appState.activeTab = normalized.activeTab;
      appState.optimizerSessionAware = !!normalized.optimizerSessionAware;
      appState.optimizerSessionNoDeficit = !!normalized.optimizerSessionNoDeficit;
      appState.optimizerSessionId = normalized.optimizerSessionId;

      el("prof-mode").value = normalizeProfessionMode(normalized.professionMode);
      setProfessionModeUI();

      var baseline = normalizeBaseline(normalized.baseline);
      el("b-life").value = String(baseline.lifeExp);
      el("b-height").value = String(baseline.height);
      el("b-weight").value = String(baseline.weight);

      if (normalized.selectedProfession) {
        setSelectedProfessionName(normalized.selectedProfession);
      }

      el("ash-allow-multi-prof").checked = !!normalized.ashAllowMultiPerProfession;
      appState.ashAllowMultiPerProfession = !!normalized.ashAllowMultiPerProfession;
      el("theme-select").value = normalized.theme;
      applyTheme(normalized.theme);
    }

    el("sandbox-hide-created").checked = !!appState.sandboxHideCreated;
    el("opt-session-aware").checked = !!appState.optimizerSessionAware;
    el("opt-session-no-deficit").checked = !!appState.optimizerSessionNoDeficit;
    populateOptimizerSessionSelect();
    updateOptimizerSessionControlsUI();

    saveProfile();
    renderInventoryEditors();
    renderSandboxEditors();
    setInventoryToggleUI();
    setExcludeToggleUI("bf-track", "bf-chips", "excludeBioFlesh", BIO_FLESH_FOODS);
    setExcludeToggleUI("art-track", "art-chips", "excludeArtifact", ARTIFACT_MEMORIES);
    updateCreatedProfessionUI();
    showTraits();
    onBaselineChange();
    refreshProgressViews();
    refreshReferenceViews();
    renderSandboxResults();
    renderPlanTab();
    setActiveTab(appState.activeTab || "optimizer");
    setHTML("results", '<div class="info-box">Plan imported successfully.</div>');
  } catch (err) {
    setHTML("results", '<div class="warn-box">Import failed. Please provide valid JSON.</div>');
  }
}

function onInventoryFilePicked(evt) {
  var file = evt.target.files && evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(loadEvt) {
    importInventoryText(String(loadEvt.target.result || ""));
    evt.target.value = "";
  };
  reader.onerror = function() {
    setHTML("results", '<div class="warn-box">Could not read selected file.</div>');
    evt.target.value = "";
  };
  reader.readAsText(file);
}

function resetInventoryToZero() {
  appState.inventory = defaultInventory();
  saveProfile();
  renderInventoryEditors();
  renderSandboxEditors();
  renderPlanTab();
  refreshReferenceViews();
}

function countCreatedProfessions() {
  var count = 0;
  for (var name in appState.createdProfessions) {
    if (appState.createdProfessions[name]) count++;
  }
  return count;
}

function updateCreatedProfessionUI() {
  var count = countCreatedProfessions();
  var selected = getSelectedProfessionName();
  var selectedCreated = !!appState.createdProfessions[selected];
  var selectedText = selected
    ? (selectedCreated ? " (selected is marked created)" : " (selected is not marked)")
    : "";
  el("created-prof-summary").textContent = "Created professions: " + count + " / " + PROFESSIONS.length + selectedText;
}

function markSelectedProfessionCreated(created) {
  var selected = getSelectedProfessionName();
  if (!selected) return;
  appState.createdProfessions[selected] = !!created;
  saveProfile();
  updateCreatedProfessionUI();
  refreshProgressViews();
  refreshReferenceViews();
}

function applyPlanToInventory(result) {
  if (!result || !appState.useInventory) return;

  var consumedFoods = 0;
  var consumedMems = 0;

  for (var fname in result.chosenFood) {
    var fcount = result.chosenFood[fname] || 0;
    var favail = appState.inventory.foods[fname] || 0;
    var fused = Math.min(favail, fcount);
    appState.inventory.foods[fname] = Math.max(0, favail - fcount);
    consumedFoods += fused;
  }

  for (var mname in result.chosenMem) {
    var mcount = result.chosenMem[mname] || 0;
    var mavail = appState.inventory.memories[mname] || 0;
    var mused = Math.min(mavail, mcount);
    appState.inventory.memories[mname] = Math.max(0, mavail - mcount);
    consumedMems += mused;
  }

  saveProfile();
  renderInventoryEditors();
  renderSandboxEditors();
  renderPlanTab();
  refreshReferenceViews();

  resultNotice = 'Plan marked as crafted. Inventory reduced by ' + consumedFoods + ' food item' + (consumedFoods === 1 ? '' : 's') + ' and ' + consumedMems + ' memory item' + (consumedMems === 1 ? '' : 's') + '.';

  var nextResult = optimize(getSelectedProfessionName(), getBaseline(), getWeights());
  renderResults(nextResult);
}

function setActiveTab(tabName) {
  appState.activeTab = normalizeTab(tabName);
  ["optimizer", "sandbox", "plan", "progress", "professions", "foods", "memories", "data"].forEach(function(tab) {
    var button = el("tab-btn-" + tab);
    var panel = el("tab-" + tab);
    var isActive = tab === appState.activeTab;
    button.classList.toggle("active", isActive);
    panel.classList.toggle("is-hidden", !isActive);
  });
  saveProfile();
}

function renderFilterChips(containerId, options, selectedValue, onSelect) {
  var wrap = el(containerId);
  var h = "";
  options.forEach(function(option) {
    h += '<button type="button" class="filter-chip' + (option.value === selectedValue ? ' active' : '') + '" data-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</button>';
  });
  wrap.innerHTML = h;
  Array.prototype.forEach.call(wrap.querySelectorAll('.filter-chip'), function(node) {
    node.addEventListener('click', function() {
      onSelect(node.getAttribute('data-value'));
    });
  });
}

function formatTraitList(item, traits) {
  return traits.filter(function(t) { return (item[t] || 0) > 0; })
    .map(function(t) {
      return '<span class="trait-pill">' + escapeHtml(TRAIT_LABELS[t]) + ' ' + (item[t] || 0) + '</span>';
    }).join('');
}

function renderProfessionReferenceFilters() {
  var committeeOptions = [{ value: 'all', label: 'All committees' }].concat(getCommittees().map(function(c) {
    return { value: c, label: c };
  }));
  var tierOptions = [
    { value: 'all', label: 'All tiers' },
    { value: '1', label: 'Tier 1' },
    { value: '2', label: 'Tier 2' },
    { value: '3', label: 'Tier 3' },
    { value: '4', label: 'Tier 4' }
  ];
  var statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'created', label: 'Created' },
    { value: 'remaining', label: 'Remaining' }
  ];

  renderFilterChips('ref-committee-filters', committeeOptions, referenceState.professionCommittee, function(value) {
    referenceState.professionCommittee = value;
    renderProfessionReference();
  });
  renderFilterChips('ref-tier-filters', tierOptions, referenceState.professionTier, function(value) {
    referenceState.professionTier = value;
    renderProfessionReference();
  });
  renderFilterChips('ref-status-filters', statusOptions, referenceState.professionStatus, function(value) {
    referenceState.professionStatus = value;
    renderProfessionReference();
  });
}

function renderProfessionReference() {
  renderProfessionReferenceFilters();

  var cards = PROFESSIONS.filter(function(p) {
    if (referenceState.professionCommittee !== 'all' && p.committee !== referenceState.professionCommittee) return false;
    if (referenceState.professionTier !== 'all' && String(p.tier) !== referenceState.professionTier) return false;
    var created = !!appState.createdProfessions[p.name];
    if (referenceState.professionStatus === 'created' && !created) return false;
    if (referenceState.professionStatus === 'remaining' && created) return false;
    return true;
  }).sort(function(a, b) {
    if (b.tier !== a.tier) return b.tier - a.tier;
    if (a.committee !== b.committee) return (a.committee || '').localeCompare(b.committee || '');
    return a.name.localeCompare(b.name);
  });

  el('profession-reference-meta').textContent = cards.length + ' profession' + (cards.length === 1 ? '' : 's') + ' shown.';

  if (!cards.length) {
    setHTML('profession-reference-list', '<div class="info-box">No professions match the current filters.</div>');
    return;
  }

  var h = '';
  cards.forEach(function(p) {
    var created = !!appState.createdProfessions[p.name];
    h += '<article class="reference-card">';
    h += '<div class="reference-card-header">';
    h += '<div>';
    h += '<div class="reference-card-title">' + escapeHtml(p.name) + '</div>';
    h += '<div class="reference-card-meta">' + escapeHtml(p.committee || '—') + ' • ' + (created ? 'Created' : 'Remaining') + '</div>';
    h += '</div>';
    h += '<div><span class="tier-badge ' + TIER_CSS[p.tier] + '">Tier ' + p.tier + '</span></div>';
    h += '</div>';
    h += '<div class="reference-section-title">Physical requirements</div>';
    h += '<div class="trait-pill-row">' + (formatTraitList(p, PHYS_TRAITS) || '<span class="muted-inline">None</span>') + '</div>';
    h += '<div class="reference-section-title">Personality requirements</div>';
    h += '<div class="trait-pill-row">' + (formatTraitList(p, PERS_TRAITS.concat(SPECIAL_TRAITS)) || '<span class="muted-inline">None</span>') + '</div>';
    h += '<div class="reference-actions">';
    h += '<button type="button" class="mini-btn ref-created-toggle-btn" data-prof="' + escapeHtml(p.name) + '" data-created="' + (created ? '1' : '0') + '">' + (created ? 'Mark uncreated' : 'Mark created') + '</button>';
    h += '<button type="button" class="mini-btn ref-open-prof-btn" data-prof="' + escapeHtml(p.name) + '">Open in optimizer</button>';
    h += '</div>';
    h += '</article>';
  });

  setHTML('profession-reference-list', h);
  Array.prototype.forEach.call(document.querySelectorAll('.ref-created-toggle-btn'), function(node) {
    node.addEventListener('click', function() {
      var profName = node.getAttribute('data-prof');
      var isCreated = node.getAttribute('data-created') === '1';
      appState.createdProfessions[profName] = !isCreated;
      saveProfile();
      updateCreatedProfessionUI();
      refreshProgressViews();
      refreshReferenceViews();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.ref-open-prof-btn'), function(node) {
    node.addEventListener('click', function() {
      setSelectedProfessionName(node.getAttribute('data-prof'));
      updateCreatedProfessionUI();
      setActiveTab('optimizer');
    });
  });
}

function renderFoodReferenceFilters() {
  var levels = FOODS.map(function(f) { return f.level; }).filter(function(v, i, arr) { return arr.indexOf(v) === i; }).sort(function(a, b) { return b - a; });
  var levelOptions = [{ value: 'all', label: 'All levels' }].concat(levels.map(function(level) {
    return { value: String(level), label: 'Lv ' + level };
  }));
  var sourceOptions = [
    { value: 'all', label: 'All recipes' },
    { value: 'bioflesh', label: 'Uses Bio Flesh' },
    { value: 'standard', label: 'No Bio Flesh' }
  ];

  renderFilterChips('food-level-filters', levelOptions, referenceState.foodLevel, function(value) {
    referenceState.foodLevel = value;
    renderFoodReference();
  });
  renderFilterChips('food-source-filters', sourceOptions, referenceState.foodSource, function(value) {
    referenceState.foodSource = value;
    renderFoodReference();
  });
}

function renderFoodReference() {
  renderFoodReferenceFilters();

  var cards = FOODS.slice().filter(function(food) {
    if (referenceState.foodLevel !== 'all' && String(food.level) !== referenceState.foodLevel) return false;
    var bio = usesBioFlesh(food);
    if (referenceState.foodSource === 'bioflesh' && !bio) return false;
    if (referenceState.foodSource === 'standard' && bio) return false;
    return true;
  }).sort(function(a, b) {
    if (b.level !== a.level) return b.level - a.level;
    return a.name.localeCompare(b.name);
  });

  el('food-reference-meta').textContent = cards.length + ' food' + (cards.length === 1 ? '' : 's') + ' shown.';

  if (!cards.length) {
    setHTML('food-reference-list', '<div class="info-box">No foods match the current filters.</div>');
    return;
  }

  var h = '';
  cards.forEach(function(food) {
    var ingredients = getFoodIngredients(food);
    var rankLabel = (food.rank === 4 ? 'Rare' : food.rank === 3 ? 'Uncommon' : food.rank === 2 ? 'Common' : String(food.rank || '-'));
    var invCount = appState.inventory.foods[food.name] || 0;
    h += '<article class="reference-card">';
    h += '<div class="reference-card-header">';
    h += '<div class="reference-card-head-main">';
    h += buildImageTag(getFoodImagePath(food.name), food.name, 'reference-thumb');
    h += '<div>';
    h += '<div class="reference-card-title">' + escapeHtml(food.name) + '</div>';
    h += '<div class="reference-card-meta">' + (usesBioFlesh(food) ? 'Uses Bio Flesh ingredients' : 'Standard recipe') + '</div>';
    h += '</div></div>';
    h += '<div><span class="rank-tag r' + (food.rank || 2) + '">Lv ' + food.level + '</span></div>';
    h += '</div>';
    h += '<div class="reference-section-title">Details</div>';
    h += '<div class="trait-pill-row">';
    h += '<span class="trait-pill secondary">Rank ' + (food.rank || '-') + ' (' + rankLabel + ')</span>';
    if (food.craftTime) h += '<span class="trait-pill secondary">Craft ' + escapeHtml(food.craftTime) + '</span>';
    h += '</div>';
    h += '<div class="reference-section-title">Physical output</div>';
    h += '<div class="trait-pill-row">' + (formatTraitList(food, PHYS_TRAITS) || '<span class="muted-inline">None</span>') + '</div>';
    h += '<div class="reference-section-title">Recipe</div>';
    h += '<div class="trait-pill-row">' + ingredients.map(function(x) {
      return '<span class="trait-pill secondary">' + buildImageTag(getFoodMatImagePath(x.ing), ING_LABELS[x.ing], 'pill-icon') + escapeHtml(ING_LABELS[x.ing]) + ' ' + x.qty + '</span>';
    }).join('') + '</div>';
    if (food.tooltip) {
      h += '<div class="reference-section-title">Tooltip</div>';
      h += '<div class="reference-tooltip">' + escapeHtml(food.tooltip) + '</div>';
    }
    h += '<div class="reference-section-title">Inventory</div>';
    h += '<div class="reference-inventory-row">';
    h += '<label for="food-inv-' + escapeHtml(toAssetStem(food.name)) + '">Available</label>';
    h += '<input id="food-inv-' + escapeHtml(toAssetStem(food.name)) + '" type="number" min="0" step="1" class="number-input ref-inv-input food-ref-inv-input" data-food="' + escapeHtml(food.name) + '" value="' + invCount + '">';
    h += '</div>';
    h += '</article>';
  });

  setHTML('food-reference-list', h);
  Array.prototype.forEach.call(document.querySelectorAll('.food-ref-inv-input'), function(node) {
    node.addEventListener('change', function() {
      var name = node.getAttribute('data-food');
      var v = parseInt(node.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      appState.inventory.foods[name] = v;
      node.value = String(v);
      saveProfile();
      renderSandboxEditors();
      renderPlanTab();
    });
  });
}

function renderMemoryReferenceFilters() {
  var rankOptions = [{ value: 'all', label: 'All ranks' }].concat([1,2,3,4,5].map(function(rank) {
    return { value: String(rank), label: MEM_RANK_LABELS[rank] };
  }));
  var typeOptions = [
    { value: 'all', label: 'All memories' },
    { value: 'artifact', label: 'Artifact only' },
    { value: 'standard', label: 'Non-artifact only' }
  ];
  var traitOptions = [{ value: 'all', label: 'All traits' }].concat(MEM_TRAITS.concat(SPECIAL_TRAITS).map(function(trait) {
    return { value: trait, label: TRAIT_LABELS[trait] };
  }));

  renderFilterChips('memory-rank-filters', rankOptions, referenceState.memoryRank, function(value) {
    referenceState.memoryRank = value;
    renderMemoryReference();
  });
  renderFilterChips('memory-type-filters', typeOptions, referenceState.memoryType, function(value) {
    referenceState.memoryType = value;
    renderMemoryReference();
  });
  renderFilterChips('memory-trait-filters', traitOptions, referenceState.memoryTrait, function(value) {
    referenceState.memoryTrait = value;
    renderMemoryReference();
  });
}

function renderMemoryReference() {
  renderMemoryReferenceFilters();

  var cards = MEMORIES.slice().filter(function(mem) {
    if (referenceState.memoryRank !== 'all' && String(mem.rank) !== referenceState.memoryRank) return false;
    var artifact = mem.rank === 5;
    if (referenceState.memoryType === 'artifact' && !artifact) return false;
    if (referenceState.memoryType === 'standard' && artifact) return false;
    if (referenceState.memoryTrait !== 'all' && (mem[referenceState.memoryTrait] || 0) <= 0) return false;
    return true;
  }).sort(function(a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.name.localeCompare(b.name);
  });

  el('memory-reference-meta').textContent = cards.length + ' memor' + (cards.length === 1 ? 'y' : 'ies') + ' shown.';

  if (!cards.length) {
    setHTML('memory-reference-list', '<div class="info-box">No memories match the current filters.</div>');
    return;
  }

  var h = '';
  cards.forEach(function(mem) {
    var invCount = appState.inventory.memories[mem.name] || 0;
    h += '<article class="reference-card">';
    h += '<div class="reference-card-header">';
    h += '<div class="reference-card-head-main">';
    h += buildImageTag(getMemoryImagePath(mem.name), mem.name, 'reference-thumb');
    h += '<div>';
    h += '<div class="reference-card-title">' + escapeHtml(mem.name) + '</div>';
    h += '<div class="reference-card-meta">' + (mem.rank === 5 ? 'Artifact memory' : 'Standard memory') + '</div>';
    h += '</div></div>';
    h += '<div><span class="rank-tag ' + (MEM_RANK_CSS[mem.rank] || 'r1') + '">' + escapeHtml(MEM_RANK_LABELS[mem.rank] || ('Rank ' + mem.rank)) + '</span></div>';
    h += '</div>';
    h += '<div class="reference-section-title">Trait output</div>';
    h += '<div class="trait-pill-row">' + (formatTraitList(mem, MEM_TRAITS.concat(SPECIAL_TRAITS)) || '<span class="muted-inline">None</span>') + '</div>';
    if (mem.tooltip) {
      h += '<div class="reference-section-title">Tooltip</div>';
      h += '<div class="reference-tooltip">' + escapeHtml(mem.tooltip) + '</div>';
    }
    h += '<div class="reference-section-title">Inventory</div>';
    h += '<div class="reference-inventory-row">';
    h += '<label for="memory-inv-' + escapeHtml(toAssetStem(mem.name)) + '">Available</label>';
    h += '<input id="memory-inv-' + escapeHtml(toAssetStem(mem.name)) + '" type="number" min="0" step="1" class="number-input ref-inv-input memory-ref-inv-input" data-memory="' + escapeHtml(mem.name) + '" value="' + invCount + '">';
    h += '</div>';
    h += '</article>';
  });

  setHTML('memory-reference-list', h);
  Array.prototype.forEach.call(document.querySelectorAll('.memory-ref-inv-input'), function(node) {
    node.addEventListener('change', function() {
      var name = node.getAttribute('data-memory');
      var v = parseInt(node.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      appState.inventory.memories[name] = v;
      node.value = String(v);
      saveProfile();
      renderSandboxEditors();
      renderPlanTab();
    });
  });
}

function refreshReferenceViews() {
  renderProfessionReference();
  renderFoodReference();
  renderMemoryReference();
}

function getPlannedProfessionCounts() {
  var counts = {};
  var humans = (appState.plan && Array.isArray(appState.plan.humans)) ? appState.plan.humans : [];
  humans.forEach(function(h) {
    if (h.sent) return;
    var name = String(h.professionName || "").trim();
    if (!name) return;
    if (!getProf(name)) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function countPlannedProfessions() {
  var counts = getPlannedProfessionCounts();
  return Object.keys(counts).length;
}

function getCommitteeProgressRows() {
  var plannedCounts = getPlannedProfessionCounts();
  return getCommittees().map(function(committee) {
    var profs = PROFESSIONS.filter(function(p) { return p.committee === committee; });
    var created = profs.filter(function(p) { return !!appState.createdProfessions[p.name]; }).length;
    var planned = profs.filter(function(p) { return (plannedCounts[p.name] || 0) > 0; }).length;
    var covered = profs.filter(function(p) {
      return !!appState.createdProfessions[p.name] || (plannedCounts[p.name] || 0) > 0;
    }).length;
    var plannedHumans = profs.reduce(function(sum, p) { return sum + (plannedCounts[p.name] || 0); }, 0);
    return {
      committee: committee,
      total: profs.length,
      created: created,
      planned: planned,
      covered: covered,
      plannedHumans: plannedHumans,
      remaining: profs.length - covered,
      pctCreated: profs.length ? Math.round((created / profs.length) * 100) : 0,
      pctCovered: profs.length ? Math.round((covered / profs.length) * 100) : 0,
      highestTier: profs.reduce(function(maxTier, p) { return Math.max(maxTier, p.tier || 0); }, 0),
    };
  }).sort(function(a, b) {
    if (b.pctCovered !== a.pctCovered) return b.pctCovered - a.pctCovered;
    if (b.pctCreated !== a.pctCreated) return b.pctCreated - a.pctCreated;
    if (b.created !== a.created) return b.created - a.created;
    return (a.committee || '').localeCompare(b.committee || '');
  });
}

function renderProgressSummary() {
  var createdCount = countCreatedProfessions();
  var plannedCount = countPlannedProfessions();
  var remainingCount = PROFESSIONS.length - createdCount;
  var committeeRows = getCommitteeProgressRows();
  var completedCommittees = committeeRows.filter(function(row) { return row.remaining === 0; }).length;

  var h = "";
  h += '<div class="sc"><div class="sl">Professions created</div><div class="sv">' + createdCount + ' / ' + PROFESSIONS.length + '</div></div>';
  h += '<div class="sc"><div class="sl">Professions planned</div><div class="sv">' + plannedCount + '</div></div>';
  h += '<div class="sc"><div class="sl">Professions remaining</div><div class="sv">' + remainingCount + '</div></div>';
  h += '<div class="sc"><div class="sl">Committees complete</div><div class="sv">' + completedCommittees + ' / ' + committeeRows.length + '</div></div>';
  setHTML("progress-summary", h);
}

function renderCommitteeProgress() {
  var rows = getCommitteeProgressRows();
  var h = "";

  rows.forEach(function(row) {
    h += '<div class="progress-card">';
    h += '<div class="progress-card-header">';
    h += '<div>';
    h += '<div class="progress-card-title">' + escapeHtml(row.committee) + '</div>';
    h += '<div class="progress-card-meta">Highest tier: ' + row.highestTier + ' • ' + row.created + ' created • ' + row.planned + ' planned • ' + row.covered + ' covered of ' + row.total + '</div>';
    h += '</div>';
    h += '<div class="progress-card-value">' + row.pctCreated + '% created • ' + row.pctCovered + '% incl planned</div>';
    h += '</div>';
    h += '<div class="progress-bar-bg">';
    h += '<div class="progress-bar-fill progress-bar-fill-planned" style="width:' + row.pctCovered + '%;"></div>';
    h += '<div class="progress-bar-fill progress-bar-fill-created" style="width:' + row.pctCreated + '%;"></div>';
    h += '</div>';
    h += '<div class="progress-card-meta">Remaining uncovered professions: ' + row.remaining + '</div>';
    h += '</div>';
  });

  setHTML("committee-progress-list", h);
}

function renderProfessionProgressList() {
  var statusFilter = el("progress-status-filter").value || "all";
  var plannedCounts = getPlannedProfessionCounts();

  var committees = getCommittees().map(function(committee) {
    var profs = PROFESSIONS.filter(function(p) {
      if (p.committee !== committee) return false;
      var created = !!appState.createdProfessions[p.name];
      var planned = (plannedCounts[p.name] || 0) > 0;
      if (statusFilter === "created" && !created) return false;
      if (statusFilter === "planned" && !planned) return false;
      if (statusFilter === "remaining" && (created || planned)) return false;
      return true;
    }).sort(function(a, b) {
      var aCreated = !!appState.createdProfessions[a.name];
      var bCreated = !!appState.createdProfessions[b.name];
      var aPlanned = (plannedCounts[a.name] || 0) > 0;
      var bPlanned = (plannedCounts[b.name] || 0) > 0;
      if (aCreated !== bCreated) return aCreated ? 1 : -1;
      if (aPlanned !== bPlanned) return aPlanned ? -1 : 1;
      if (b.tier !== a.tier) return b.tier - a.tier;
      return a.name.localeCompare(b.name);
    });

    var total = PROFESSIONS.filter(function(p) { return p.committee === committee; }).length;
    var createdTotal = PROFESSIONS.filter(function(p) {
      return p.committee === committee && !!appState.createdProfessions[p.name];
    }).length;
    var plannedTotal = PROFESSIONS.filter(function(p) {
      return p.committee === committee && (plannedCounts[p.name] || 0) > 0;
    }).length;
    var plannedHumanTotal = PROFESSIONS.filter(function(p) { return p.committee === committee; })
      .reduce(function(sum, p) { return sum + (plannedCounts[p.name] || 0); }, 0);

    return {
      committee: committee,
      profs: profs,
      total: total,
      createdTotal: createdTotal,
      coveredTotal: PROFESSIONS.filter(function(p) {
        return p.committee === committee && (!!appState.createdProfessions[p.name] || (plannedCounts[p.name] || 0) > 0);
      }).length,
      plannedTotal: plannedTotal,
      plannedHumanTotal: plannedHumanTotal,
      pctCreated: total ? Math.round((createdTotal / total) * 100) : 0,
      pctCovered: total ? Math.round((PROFESSIONS.filter(function(p) {
        return p.committee === committee && (!!appState.createdProfessions[p.name] || (plannedCounts[p.name] || 0) > 0);
      }).length / total) * 100) : 0,
    };
  });

  var visibleCommittees = committees.filter(function(group) { return group.profs.length > 0; });

  if (!visibleCommittees.length) {
    setHTML("profession-progress-list", '<div class="info-box">No professions match the current filters.</div>');
    return;
  }

  var h = "";
  visibleCommittees.forEach(function(group) {
    h += '<section class="committee-group">';
    h += '<div class="committee-group-header">';
    h += '<div>';
    h += '<div class="committee-group-title">' + escapeHtml(group.committee) + '</div>';
    h += '<div class="committee-group-meta">' + group.createdTotal + ' created • ' + group.plannedTotal + ' planned • ' + group.coveredTotal + ' covered of ' + group.total + ' (' + group.plannedHumanTotal + ' planned humans)</div>';
    h += '</div>';
    h += '<div class="committee-group-pct">' + group.pctCreated + '% / ' + group.pctCovered + '%</div>';
    h += '</div>';
    h += '<div class="progress-bar-bg committee-group-bar">';
    h += '<div class="progress-bar-fill progress-bar-fill-planned" style="width:' + group.pctCovered + '%;"></div>';
    h += '<div class="progress-bar-fill progress-bar-fill-created" style="width:' + group.pctCreated + '%;"></div>';
    h += '</div>';
    h += '<div class="committee-prof-list">';

    group.profs.forEach(function(p) {
      var created = !!appState.createdProfessions[p.name];
      var plannedCount = plannedCounts[p.name] || 0;
      h += '<div class="profession-row">';
      h += '<label class="profession-check">';
      h += '<input type="checkbox" class="profession-created-toggle" data-prof="' + escapeHtml(p.name) + '"' + (created ? ' checked' : '') + ' title="Toggle created profession state">';
      h += '<span></span>';
      h += '</label>';
      h += '<div class="profession-main">';
      h += '<div class="profession-title-row">';
      h += '<span class="profession-name">' + escapeHtml(p.name) + '</span>';
      h += '<span class="tier-badge ' + TIER_CSS[p.tier] + '">Tier ' + p.tier + '</span>';
      h += '</div>';
      h += '<div class="profession-meta">' + (created ? 'Created' : 'Remaining') + (plannedCount > 0 ? (' • Planned x' + plannedCount) : '') + '</div>';
      h += '</div>';
      h += '<button type="button" class="mini-btn jump-opt-btn" data-prof="' + escapeHtml(p.name) + '">Open in optimizer</button>';
      h += '</div>';
    });

    h += '</div>';
    h += '</section>';
  });

  setHTML("profession-progress-list", h);

  Array.prototype.forEach.call(document.querySelectorAll('.profession-created-toggle'), function(node) {
    node.addEventListener('change', function() {
      var profName = this.getAttribute('data-prof');
      appState.createdProfessions[profName] = !!this.checked;
      saveProfile();
      updateCreatedProfessionUI();
      refreshProgressViews();
      refreshReferenceViews();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.jump-opt-btn'), function(node) {
    node.addEventListener('click', function() {
      var profName = this.getAttribute('data-prof');
      setSelectedProfessionName(profName);
      updateCreatedProfessionUI();
      setActiveTab('optimizer');
    });
  });
}

function refreshProgressViews() {
  renderProgressSummary();
  renderCommitteeProgress();
  renderProfessionProgressList();
}

function buildAshRecommendationRow(prof, allowMultiPerProfession, globalCap) {
  if ((prof.tier || 0) < 4) return null;

  var totalLoad = 0;
  var coveredByOne = 0;
  var uncoveredAfterOne = 0;
  var traitsUsed = 0;
  var neededForFullCoverage = 0;

  PERS_TRAITS.forEach(function(t) {
    var req = prof[t] || 0;
    if (req <= 0) return;
    traitsUsed++;
    totalLoad += req;
    coveredByOne += Math.min(100, req);
    uncoveredAfterOne += Math.max(0, req - 100);
    neededForFullCoverage = Math.max(neededForFullCoverage, Math.ceil(req / 100));
  });

  if (totalLoad <= 0) return null;

  var perProfCap = allowMultiPerProfession ? Math.max(1, globalCap) : 1;
  var ashRecommended = Math.min(perProfCap, neededForFullCoverage);
  var fullyCoveredByRecommendation = ashRecommended >= neededForFullCoverage;

  // Static strategy score, independent of current sliders/toggles/inventory.
  var strategicScore =
    (coveredByOne * 2) +
    (traitsUsed * 35) +
    (prof.tier * 160) -
    (uncoveredAfterOne * 1.5);

  return {
    prof: prof,
    created: !!appState.createdProfessions[prof.name],
    totalLoad: totalLoad,
    traitsUsed: traitsUsed,
    coveredByOne: coveredByOne,
    uncoveredAfterOne: uncoveredAfterOne,
    neededForFullCoverage: neededForFullCoverage,
    ashRecommended: ashRecommended,
    fullyCoveredByRecommendation: fullyCoveredByRecommendation,
    strategicScore: strategicScore,
  };
}

function analyzeAshNotebookValue() {
  var maxCap = 10;
  var allowMultiPerProfession = !!el("ash-allow-multi-prof").checked;
  var rows = [];

  PROFESSIONS.forEach(function(p) {
    var row = buildAshRecommendationRow(p, allowMultiPerProfession, maxCap);
    if (row) rows.push(row);
  });

  if (!rows.length) {
    setHTML("results", '<div class="info-box">No professions currently have personality trait requirements that benefit from Ash Notebook.</div>');
    return;
  }

  rows.sort(function(a, b) {
    if (a.created !== b.created) return a.created ? 1 : -1;
    if (b.strategicScore !== a.strategicScore) return b.strategicScore - a.strategicScore;
    if (b.prof.tier !== a.prof.tier) return b.prof.tier - a.prof.tier;
    return b.totalLoad - a.totalLoad;
  });

  var h = '<hr class="div">';
  h += '<div class="section-label">Ash Notebook recommendations (static strategy)</div>';
  h += '<div class="info-box">These recommendations are static and do not use current optimizer sliders, baseline, or inventory. Default policy is 1 Ash per profession; enable override to allow more.</div>';
  h += '<div class="table-wrap"><table class="simple-table"><thead><tr>';
  h += '<th>Profession</th><th>Tier</th><th>Committee</th><th>Ash rec.</th><th>One-Ash coverage</th><th>Status</th>';
  h += '</tr></thead><tbody>';
  rows.slice(0, Math.max(1, maxCap)).forEach(function(r) {
    h += '<tr>';
    h += '<td>' + r.prof.name + '</td>';
    h += '<td>' + r.prof.tier + '</td>';
    h += '<td>' + r.prof.committee + '</td>';
    h += '<td>' + r.ashRecommended + ' / ' + (allowMultiPerProfession ? maxCap : 1) + '</td>';
    h += '<td>' + r.coveredByOne + ' / ' + r.totalLoad + '</td>';
    h += '<td>' + (r.created ? 'already created' : 'candidate') + '</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';

  h += '<div class="info-box">';
  h += 'Policy used: <strong>' + (allowMultiPerProfession ? 'multi-Ash override enabled' : 'max 1 Ash per profession') + '</strong>. ';
  h += 'Current Ash cap: <strong>' + maxCap + '</strong>.';
  h += '</div>';
  setHTML("results", h);
}

// ─── Baseline warning ─────────────────────────────────────────────────────────

function baselineSatisfiesProf(prof, baseline) {
  // Only fires for professions with no strength/intellect requirement
  if ((prof.strength || 0) > 0 || (prof.intellect || 0) > 0) return false;
  var le = Math.max(prof.lifeExp || 0, HARD_MIN.lifeExp);
  var ht = Math.max(prof.height  || 0, HARD_MIN.height);
  var wt = Math.max(prof.weight  || 0, HARD_MIN.weight);
  return baseline.lifeExp >= le && baseline.height >= ht && baseline.weight >= wt;
}

function onBaselineChange() {
  el("bl-val").textContent = el("b-life").value;
  el("bh-val").textContent = el("b-height").value;
  el("bw-val").textContent = el("b-weight").value;
  var baseline     = getBaseline();
  var currentName  = getSelectedProfessionName();
  var triggered    = PROFESSIONS.filter(function(p) {
    return p.name !== currentName && baselineSatisfiesProf(p, baseline);
  });
  if (!triggered.length) { setHTML("baseline-warnings", ""); return; }
  var list = triggered.map(function(p) {
    return "<strong>" + p.name + "</strong> (Tier " + p.tier + ")";
  }).join(", ");
  setHTML("baseline-warnings",
    '<div class="info-box" style="margin-top:.5rem;margin-bottom:.25rem;">' +
    "Baseline alone fully satisfies physical requirements for: " + list + "</div>");
}

// ─── Toggles ──────────────────────────────────────────────────────────────────

function initToggle(toggleId, trackId, chipsId, stateKey, items) {
  setExcludeToggleUI(trackId, chipsId, stateKey, items);
  el(toggleId).addEventListener("click", function() {
    appState[stateKey] = !appState[stateKey];
    setExcludeToggleUI(trackId, chipsId, stateKey, items);
    saveProfile();
  });
}

// ─── Profession selector ──────────────────────────────────────────────────────

function populateCommittees() {
  var cs = el("csel");
  cs.innerHTML = "";
  getCommittees().forEach(function(c) {
    var o = document.createElement("option");
    o.value = c; o.textContent = c;
    cs.appendChild(o);
  });
}

function populateAllProfs() {
  var sel = el("psel-all");
  sel.innerHTML = "";
  PROFESSIONS.slice().sort(function(a, b) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  }).forEach(function(p) {
    var o = document.createElement("option");
    o.value = p.name;
    o.textContent = p.name + " (Tier " + p.tier + ", " + p.committee + ")";
    sel.appendChild(o);
  });
}

function populateProfs() {
  var committee = el("csel").value;
  var sel = el("psel");
  sel.innerHTML = "";
  PROFESSIONS.filter(function(p) { return p.committee === committee; })
    .forEach(function(p) {
      var o = document.createElement("option");
      o.value = p.name;
      o.textContent = p.name + " (Tier " + p.tier + ")";
      sel.appendChild(o);
    });
  if (sel.options.length && !sel.value) sel.selectedIndex = 0;
  if (el("prof-mode").value === "committee") {
    var directSel = el("psel-all");
    if (sel.value) directSel.value = sel.value;
  }
  showTraits();
  onBaselineChange();
}

function getSelectedProfessionName() {
  if (el("prof-mode").value === "direct") return el("psel-all").value;
  return el("psel").value;
}

function setSelectedProfessionName(name) {
  if (!name) return;
  var target = getProf(name);
  if (!target) return;

  el("psel-all").value = name;
  el("csel").value = target.committee;
  populateProfs();
  el("psel").value = name;
}

function setProfessionModeUI() {
  var committeeMode = el("prof-mode").value === "committee";
  el("committee-wrap").style.display = committeeMode ? "block" : "none";
  el("committee-prof-wrap").style.display = committeeMode ? "block" : "none";
  el("direct-prof-wrap").style.display = committeeMode ? "none" : "block";
  showTraits();
  onBaselineChange();
}

// ─── Trait display ────────────────────────────────────────────────────────────

function showTraits() {
  var prof = getProf(getSelectedProfessionName());
  if (!prof) { setHTML("trait-display", ""); return; }
  var baseline = getBaseline();
  var h = "";

  // Physical targets
  var physReqs = {};
  PHYS_TRAITS.forEach(function(t) {
    var target = Math.max(prof[t] || 0, HARD_MIN[t] || 0, baseline[t] || 0);
    if (target > 0) physReqs[t] = target;
  });
  if (Object.keys(physReqs).length) {
    h += '<div class="section-label">Physical targets <span class="label-note">(food)</span></div>';
    h += '<div class="trait-grid">';
    PHYS_TRAITS.forEach(function(t) {
      if (!physReqs[t]) return;
      var raised = (baseline[t] || 0) > Math.max(prof[t] || 0, HARD_MIN[t] || 0);
      h += '<div class="tc">';
      h += '<div class="tn">' + TRAIT_LABELS[t];
      if (raised) h += ' <span class="note-info">(+baseline)</span>';
      h += "</div>";
      h += '<div class="tv">' + physReqs[t] + "</div>";
      h += "</div>";
    });
    h += "</div>";
  }

  // Personality targets
  var persReqs = {};
  PERS_TRAITS.forEach(function(t) { if ((prof[t] || 0) > 0) persReqs[t] = prof[t]; });
  if ((prof.starChild || 0) > 0) persReqs.starChild = prof.starChild;

  if (Object.keys(persReqs).length) {
    h += '<div class="section-label">Personality targets <span class="label-note">(memories)</span></div>';
    h += '<div class="trait-grid">';
    var persAndSpecial = PERS_TRAITS.concat(SPECIAL_TRAITS);
    persAndSpecial.forEach(function(t) {
      if (!persReqs[t]) return;
      h += '<div class="tc mem">';
      h += '<div class="tn">' + TRAIT_LABELS[t] + "</div>";
      h += '<div class="tv">' + persReqs[t] + "</div>";
      h += "</div>";
    });
    h += "</div>";
  }

  setHTML("trait-display", h);
  setHTML("results", "");
}

// ─── Results rendering ────────────────────────────────────────────────────────

function renderResults(result, renderContext) {
  if (!result) {
    setHTML("results", '<p class="muted">Please select a profession.</p>');
    return;
  }

  var ctx = renderContext || {};
  var sessionCaps = ctx.sessionCaps || null;

  var h = '<hr class="div">';
  var prof     = result.prof;
  var targets  = result.targets;
  var achieved = result.achieved;
  var baseline = result.baseline;

  // ── Profession outcome warning ──
  if (result.qualified.length) {
    var higher   = result.qualified.filter(function(q) { return q.prof.tier > prof.tier; });
    var same     = result.qualified.filter(function(q) { return q.prof.tier === prof.tier; });
    var lowerOnly = !higher.length && !same.length;
    h += '<div class="warn-box">';
    h += '<div class="warn-title">Profession outcome</div>';
    if (higher.length) {
      h += "<div>Higher-tier professions also satisfied — human may become one of these:</div>";
      higher.forEach(function(q) {
        h += '<div class="overlap-row">';
        h += '<span class="overlap-name">' + q.prof.name + "</span>";
        h += '<span class="tier-badge ' + TIER_CSS[q.prof.tier] + '">Tier ' + q.prof.tier + "</span>";
        h += ' <span class="muted">' + q.prof.committee + "</span>";
        h += "</div>";
      });
    }
    if (same.length) {
      h += "<div>Same-tier professions also satisfied:</div>";
      same.forEach(function(q) {
        h += '<div class="overlap-row">';
        h += '<span class="overlap-name">' + q.prof.name + "</span>";
        h += '<span class="tier-badge ' + TIER_CSS[q.prof.tier] + '">Tier ' + q.prof.tier + "</span>";
        h += ' <span class="muted">' + q.prof.committee + "</span>";
        h += "</div>";
      });
    }
    if (lowerOnly) {
      h += "<div>Only lower-tier professions also satisfied — no promotion risk.</div>";
      result.qualified.forEach(function(q) {
        h += '<div class="overlap-row">';
        h += '<span class="overlap-name">' + q.prof.name + "</span>";
        h += '<span class="tier-badge ' + TIER_CSS[q.prof.tier] + '">Tier ' + q.prof.tier + "</span>";
        h += "</div>";
      });
    }
    h += "</div>";
  }

  // ── Shortfall warning ──
  if (result.stillShort.length) {
    h += '<div class="warn-box">Could not fully meet: <strong>' +
      result.stillShort.map(function(t) { return TRAIT_LABELS[t]; }).join(", ") +
      "</strong>. Try enabling Bio Flesh foods or adjusting weights.</div>";
  }

  // ── Legend ──
  h += '<div class="legend">';
  h += '<span class="legend-item"><span class="legend-dot legend-dot-mem"></span>Memory / personality</span>';
  h += '<span class="legend-item"><span class="legend-dot legend-dot-food"></span>Food / physical</span>';
  h += "</div>";

  // ── Score summary ──
  h += '<div class="score-grid">';
  h += '<div class="sc"><div class="sl">Food items</div><div class="sv">' + result.totalFoodItems + "</div></div>";
  h += '<div class="sc"><div class="sl">Memory items</div><div class="sv">' + result.totalMemItems + "</div></div>";
  h += '<div class="sc"><div class="sl">Craft cost (level sum)</div><div class="sv">' + result.totalLevel + "</div></div>";
  h += "</div>";

  h += '<div class="info-box">';
  h += 'Inventory mode: <strong>' + (appState.useInventory ? 'enabled' : 'disabled') + '</strong>.';
  h += '</div>';

  h += '<div class="inventory-actions">';
  h += '<button type="button" class="mini-btn" id="optimizer-add-plan-btn">Add Optimizer human to Plan</button>';
  h += '</div>';

  if (resultNotice) {
    h += '<div class="info-box">' + escapeHtml(resultNotice) + '</div>';
    resultNotice = "";
  }

  if (appState.useInventory && (result.totalFoodItems > 0 || result.totalMemItems > 0)) {
    h += '<div class="inventory-actions">';
    h += '<button type="button" class="mini-btn" id="apply-plan-btn" title="Deduct planned items from inventory">Mark Plan As Crafted</button>';
    h += '</div>';
  }

  // ── Food plan ──
  var foodKeys = Object.keys(result.chosenFood);
  if (foodKeys.length) {
    h += '<div class="section-label">Food plan</div>';
    foodKeys.sort(function(a, b) {
      var fa = getFood(a), fb = getFood(b);
      return (fb ? fb.level : 0) - (fa ? fa.level : 0);
    });
    foodKeys.forEach(function(fname) {
      var count = result.chosenFood[fname];
      var food  = getFood(fname);
      if (!food) return;
      var bifs = {};
      getFoodIngredients(food).forEach(function(x) { bifs[x.bio] = 1; });
      var maxRank = 0;
      for (var bname in bifs) {
        var bd = getBioStuff(bname);
        if (bd && bd.rank > maxRank) maxRank = bd.rank;
      }
      var rankColor = BIO_RANK_COLORS[maxRank] || "#888";
      var reqC = PHYS_TRAITS
        .filter(function(t) { return targets[t] && (food[t] || 0) > 0; })
        .map(function(t) { return TRAIT_LABELS[t] + " +" + (food[t] * count); })
        .join(", ");
      var bonC = PHYS_TRAITS
        .filter(function(t) { return !targets[t] && (food[t] || 0) > 0; })
        .map(function(t) { return TRAIT_LABELS[t] + " +" + (food[t] * count); })
        .join(", ");
      var ingList = getFoodIngredients(food)
        .map(function(x) { return ING_LABELS[x.ing] + ": " + x.qty; })
        .join(", ");

      h += '<div class="plan-row">';
      h += '<span class="badge badge-blue">\xd7' + count + "</span>";
      h += buildImageTag(getFoodImagePath(fname), fname, 'plan-thumb');
      h += "<div>";
      h += '<div class="fname">' + fname + ' <span class="lv">Lv ' + food.level + "</span></div>";
      if (reqC) h += '<div class="fsub">' + reqC + "</div>";
      if (bonC) h += '<div class="fsub-bonus">also: ' + bonC + "</div>";
      h += '<div class="fsub ing-list">' + ingList + "</div>";
      var foodAvail = appState.inventory.foods[fname] || 0;
      var foodShort = Math.max(0, count - foodAvail);
      if (appState.useInventory) {
        if (sessionCaps && sessionCaps.foods) {
          var foodSessionAvail = sessionCaps.foods[fname] || 0;
          var foodSessionShort = Math.max(0, count - foodSessionAvail);
          var anyShortFood = foodShort > 0 || foodSessionShort > 0;
          h += '<div class="inv-status ' + (anyShortFood ? 'inv-status-short' : 'inv-status-ok') + '">Current inv: ' + foodAvail + ' • Session-aware inv: ' + foodSessionAvail + ' • Plan needs ' + count;
          if (anyShortFood) {
            h += ' • Short: current ' + foodShort + ', session-aware ' + foodSessionShort;
          } else {
            h += ' • In stock (both)';
          }
          h += '</div>';
        } else {
          h += '<div class="inv-status ' + (foodShort > 0 ? 'inv-status-short' : 'inv-status-ok') + '">Inventory: ' + foodAvail + ' • Plan needs ' + count + (foodShort > 0 ? (' • Short by ' + foodShort) : ' • In stock') + '</div>';
        }
      } else {
        h += '<div class="inv-status inv-status-off">Inventory available: ' + foodAvail + ' (not enforced)</div>';
      }
      h += "</div>";
      h += '<div class="farm-rank" style="color:' + rankColor + '">Farm rank ' + maxRank + "</div>";
      h += "</div>";
    });
  }

  // ── Memory plan ──
  var memKeys = Object.keys(result.chosenMem);
  if (memKeys.length) {
    h += '<div class="section-label">Memory plan</div>';
    memKeys.sort(function(a, b) {
      var ma = getMemory(a), mb = getMemory(b);
      return (mb ? mb.rank : 0) - (ma ? ma.rank : 0);
    });
    memKeys.forEach(function(mname) {
      var count = result.chosenMem[mname];
      var mem   = getMemory(mname);
      if (!mem) return;
      var rankLabel = MEM_RANK_LABELS[mem.rank] || "";
      var rankClass = MEM_RANK_CSS[mem.rank]    || "r1";
      var badgeClass = mem.rank === 5 ? "badge-gold" : "badge-purple";
      var persAndSpecial = MEM_TRAITS.concat(SPECIAL_TRAITS);
      var reqC = persAndSpecial
        .filter(function(t) { return targets[t] && (mem[t] || 0) > 0; })
        .map(function(t) { return TRAIT_LABELS[t] + " +" + (mem[t] * count); })
        .join(", ");
      var bonC = persAndSpecial
        .filter(function(t) { return !targets[t] && (mem[t] || 0) > 0; })
        .map(function(t) { return TRAIT_LABELS[t] + " +" + (mem[t] * count); })
        .join(", ");

      h += '<div class="plan-row">';
      h += '<span class="badge ' + badgeClass + '">\xd7' + count + "</span>";
      h += buildImageTag(getMemoryImagePath(mname), mname, 'plan-thumb');
      h += "<div>";
      h += '<div class="fname">' + mname + ' <span class="rank-tag ' + rankClass + '">' + rankLabel + "</span></div>";
      if (reqC) h += '<div class="fsub">' + reqC + "</div>";
      if (bonC) h += '<div class="fsub-bonus">also: ' + bonC + "</div>";
      var memAvail = appState.inventory.memories[mname] || 0;
      var memShort = Math.max(0, count - memAvail);
      if (appState.useInventory) {
        if (sessionCaps && sessionCaps.memories) {
          var memSessionAvail = sessionCaps.memories[mname] || 0;
          var memSessionShort = Math.max(0, count - memSessionAvail);
          var anyShortMem = memShort > 0 || memSessionShort > 0;
          h += '<div class="inv-status ' + (anyShortMem ? 'inv-status-short' : 'inv-status-ok') + '">Current inv: ' + memAvail + ' • Session-aware inv: ' + memSessionAvail + ' • Plan needs ' + count;
          if (anyShortMem) {
            h += ' • Short: current ' + memShort + ', session-aware ' + memSessionShort;
          } else {
            h += ' • In stock (both)';
          }
          h += '</div>';
        } else {
          h += '<div class="inv-status ' + (memShort > 0 ? 'inv-status-short' : 'inv-status-ok') + '">Inventory: ' + memAvail + ' • Plan needs ' + count + (memShort > 0 ? (' • Short by ' + memShort) : ' • In stock') + '</div>';
        }
      } else {
        h += '<div class="inv-status inv-status-off">Inventory available: ' + memAvail + ' (not enforced)</div>';
      }
      h += "</div>";
      h += "<div></div>";
      h += "</div>";
    });
  } else if (PERS_TRAITS.some(function(t) { return targets[t] > 0; }) || (targets.starChild > 0)) {
    h += '<div class="section-label">Memory plan</div>';
    h += '<p class="muted">No personality traits required for this profession.</p>';
  }

  // ── Physical coverage (required + bonus traits) ──
  if (PHYS_TRAITS.some(function(t) { return (targets[t] || 0) > 0 || (achieved[t] || 0) > 0; })) {
    h += '<div class="section-label">Physical trait coverage</div>';
    h += '<div class="cov-grid">';
    PHYS_TRAITS.forEach(function(t) {
      var got = achieved[t] || 0;
      var req = targets[t] || 0;
      if (req <= 0 && got <= 0) return;
      var pct = req > 0 ? Math.min(100, Math.round((got / req) * 100)) : 100;
      var barColor = req > 0 ? (pct >= 100 ? "#3B6D11" : "#BA7517") : "#3B6D11";
      var raised = req > 0 && (baseline[t] || 0) > Math.max(prof[t] || 0, HARD_MIN[t] || 0);
      h += '<div class="cv">';
      h += '<div class="cn">' + TRAIT_LABELS[t];
      if (raised) h += ' <span class="note-info">raised</span>';
      if (req <= 0) h += ' <span class="note-info">bonus</span>';
      h += "</div>";
      h += '<div class="cv-bar-bg"><div class="cv-bar" style="width:' + pct + '%;background:' + barColor + ';"></div></div>';
      h += '<div class="cnum">' + got + "/" + req;
      if (req > 0 && got > req) h += ' <span class="over">+' + (got - req) + "</span>";
      h += "</div></div>";
    });
    h += "</div>";
  }

  // ── Personality coverage (required + bonus traits) ──
  var persAndSpecial = PERS_TRAITS.concat(SPECIAL_TRAITS);
  var hasPers = persAndSpecial.some(function(t) { return (targets[t] || 0) > 0 || (achieved[t] || 0) > 0; });
  if (hasPers) {
    h += '<div class="section-label">Personality trait coverage</div>';
    h += '<div class="cov-grid">';
    persAndSpecial.forEach(function(t) {
      var got = achieved[t] || 0;
      var req = targets[t] || 0;
      if (req <= 0 && got <= 0) return;
      var pct = req > 0 ? Math.min(100, Math.round((got / req) * 100)) : 100;
      var barColor = req > 0 ? (pct >= 100 ? "#3B6D11" : "#BA7517") : "#3B6D11";
      h += '<div class="cv cv-mem">';
      h += '<div class="cn">' + TRAIT_LABELS[t] + (req <= 0 ? ' <span class="note-info">bonus</span>' : '') + "</div>";
      h += '<div class="cv-bar-bg"><div class="cv-bar" style="width:' + pct + '%;background:' + barColor + ';"></div></div>';
      h += '<div class="cnum">' + got + "/" + req;
      if (req > 0 && got > req) h += ' <span class="over">+' + (got - req) + "</span>";
      h += "</div></div>";
    });
    h += "</div>";
  }

  var hasFoodShortageInInventory = false;
  if (appState.useInventory) {
    for (var plannedFood in result.chosenFood) {
      var plannedCount = result.chosenFood[plannedFood] || 0;
      var availableCount = appState.inventory.foods[plannedFood] || 0;
      if (plannedCount > availableCount) {
        hasFoodShortageInInventory = true;
        break;
      }
    }
  }
  var showResourceBreakdown = !appState.useInventory || hasFoodShortageInInventory;

  // ── Ingredient totals ──
  var ingKeys = Object.keys(result.ingTotals);
  if (showResourceBreakdown && ingKeys.length) {
    h += '<div class="section-label">Ingredient totals</div>';
    ingKeys.sort(function(a, b) {
      var ra = 0, rb = 0;
      BIO_STUFF.forEach(function(x) {
        if (x.ingredients.indexOf(a) >= 0) ra = x.rank;
        if (x.ingredients.indexOf(b) >= 0) rb = x.rank;
      });
      return rb - ra;
    });
    ingKeys.forEach(function(ing) {
      var qty   = result.ingTotals[ing];
      var bname = ING_TO_BIO[ing];
      var bd    = getBioStuff(bname);
      var rc    = bd ? BIO_RANK_COLORS[bd.rank] : "#888";
      var rl    = bd ? BIO_RANK_LABELS[bd.rank]  : "";
      h += '<div class="bio-row">';
      h += "<div>";
      h += buildImageTag(getFoodMatImagePath(ing), ING_LABELS[ing], 'row-icon');
      h += '<div class="bname">' + ING_LABELS[ing] + "</div>";
      h += '<div class="bsub">from ' + bname + "</div>";
      h += "</div>";
      h += '<div class="bio-qty">' + qty + " units</div>";
      h += '<div class="bio-rank" style="color:' + rc + '">' + rl + "</div>";
      h += "</div>";
    });
  }

  // ── Bio-stuff farming ──
  if (showResourceBreakdown && Object.keys(result.bioNeeded).length) {
    h += '<div class="section-label">Bio-stuff farming <span class="label-note">(1:1 baseline — actual yield ~10–20% higher)</span></div>';
    var bioKeys = Object.keys(result.bioNeeded).sort(function(a, b) {
      var ra = 0, rb = 0;
      BIO_STUFF.forEach(function(x) {
        if (x.name === a) ra = x.rank;
        if (x.name === b) rb = x.rank;
      });
      return ra - rb;
    });
    bioKeys.forEach(function(bname) {
      var qty = result.bioNeeded[bname];
      var bd  = getBioStuff(bname);
      var rc  = bd ? BIO_RANK_COLORS[bd.rank] : "#888";
      var rl  = bd ? BIO_RANK_LABELS[bd.rank]  : "";
      var pips = "";
      for (var i = 0; i < 5; i++) {
        pips += '<span class="diff-pip" style="background:' +
          (i < (bd ? bd.rank : 0) ? rc : "var(--color-border-tertiary)") + '"></span>';
      }
      var isFlesh = bname === "Bio Flesh";
      var ingDetail = bd ? bd.ingredients.map(function(ing) {
        var n = result.ingTotals[ing] || 0;
        return ING_LABELS[ing] + (n ? ": " + n : "");
      }).join(", ") : "";

      h += '<div class="bio-row">';
      h += "<div>";
      h += buildImageTag(getOrganicImagePath(bname), bname, 'row-icon');
      h += '<div class="bname">' + bname + "</div>";
      if (bd) h += '<div class="bsub">' + bd.source + "</div>";
      if (ingDetail) h += '<div class="bsub">' + ingDetail + "</div>";
      if (isFlesh) h += '<div class="flesh-note">1 unit yields ~1 each of Mito. Amp., Nanite Nutrient, Bioregulator simultaneously</div>';
      h += "</div>";
      h += "<div>";
      h += '<div class="bio-qty">' + qty + " units</div>";
      h += '<div class="bio-qty-note">~' + Math.ceil(qty * 0.85) + " at full power</div>";
      h += "</div>";
      h += '<div style="white-space:nowrap;text-align:right;">' + pips + '<br>';
      h += '<span style="font-size:10px;color:' + rc + '">' + rl + "</span></div>";
      h += "</div>";
    });
  }

  setHTML("results", h);

  lastOptimizerResult = {
    label: prof ? prof.name : "Optimizer plan",
    professionName: prof ? prof.name : "",
    chosenFood: cloneCountMap(result.chosenFood),
    chosenMem: cloneCountMap(result.chosenMem),
  };

  var optimizerAddPlanBtn = el("optimizer-add-plan-btn");
  if (optimizerAddPlanBtn) {
    optimizerAddPlanBtn.addEventListener("click", function() {
      if (!lastOptimizerResult) return;
      addHumanPlanEntry("optimizer", lastOptimizerResult.label, lastOptimizerResult.professionName, lastOptimizerResult.chosenFood, lastOptimizerResult.chosenMem);
    });
  }

  var applyPlanButton = el("apply-plan-btn");
  if (applyPlanButton) {
    applyPlanButton.addEventListener("click", function() {
      if (!window.confirm("Deduct all planned food and memory quantities from your inventory?")) return;
      applyPlanToInventory(result);
    });
  }
}

function updateOptimizerSessionControlsUI() {
  var controls = el("opt-session-controls");
  if (!controls) return;
  controls.classList.toggle("is-hidden", !appState.optimizerSessionAware);
}

function populateOptimizerSessionSelect() {
  var sel = el("opt-session-select");
  if (!sel) return;
  var sessions = (appState.plan && Array.isArray(appState.plan.sessions)) ? appState.plan.sessions.slice() : [];
  sessions.sort(function(a, b) { return a.id - b.id; });
  sel.innerHTML = "";
  sessions.forEach(function(session) {
    var o = document.createElement("option");
    o.value = String(session.id);
    o.textContent = session.name;
    sel.appendChild(o);
  });

  if (!sessions.length) {
    appState.optimizerSessionId = null;
    return;
  }

  var valid = sessions.some(function(s) { return s.id === appState.optimizerSessionId; });
  if (!valid) appState.optimizerSessionId = sessions[0].id;
  sel.value = String(appState.optimizerSessionId);
}

function buildSessionAwareCaps(sessionId) {
  var caps = {
    foods: {},
    memories: {},
  };

  Object.keys(appState.inventory.foods || {}).forEach(function(name) {
    caps.foods[name] = appState.inventory.foods[name] || 0;
  });
  Object.keys(appState.inventory.memories || {}).forEach(function(name) {
    caps.memories[name] = appState.inventory.memories[name] || 0;
  });

  var humans = (appState.plan && Array.isArray(appState.plan.humans)) ? appState.plan.humans : [];
  humans.forEach(function(h) {
    if (h.sent) return;
    Object.keys(h.chosenFood || {}).forEach(function(name) {
      caps.foods[name] = Math.max(0, (caps.foods[name] || 0) - (h.chosenFood[name] || 0));
    });
    Object.keys(h.chosenMem || {}).forEach(function(name) {
      caps.memories[name] = Math.max(0, (caps.memories[name] || 0) - (h.chosenMem[name] || 0));
    });
  });

  return caps;
}

function getPlanDeficits(result, caps) {
  if (!result || !caps) return [];
  var rows = [];
  Object.keys(result.chosenFood || {}).forEach(function(name) {
    var need = result.chosenFood[name] || 0;
    var have = caps.foods[name] || 0;
    if (need > have) rows.push({ kind: "Food", name: name, short: need - have, need: need, have: have });
  });
  Object.keys(result.chosenMem || {}).forEach(function(name) {
    var need = result.chosenMem[name] || 0;
    var have = caps.memories[name] || 0;
    if (need > have) rows.push({ kind: "Memory", name: name, short: need - have, need: need, have: have });
  });
  rows.sort(function(a, b) { return b.short - a.short; });
  return rows;
}

// ─── Run optimizer ────────────────────────────────────────────────────────────

function runOptimize() {
  var profName = getSelectedProfessionName();
  if (!profName) { setHTML("results", '<p class="muted">Please select a profession.</p>'); return; }

  var baseline = getBaseline();
  var weights = getWeights();

  if (!appState.optimizerSessionAware) {
    var singleResult = optimize(profName, baseline, weights);
    renderResults(singleResult);
    return;
  }

  var selectedSessionId = appState.optimizerSessionId;
  var selectedSession = getPlanSessionById(selectedSessionId);
  if (!selectedSession) {
    var sessions = (appState.plan && appState.plan.sessions) ? appState.plan.sessions : [];
    if (sessions.length) {
      selectedSessionId = sessions[0].id;
      appState.optimizerSessionId = selectedSessionId;
      populateOptimizerSessionSelect();
      saveProfile();
    }
  }

  var ideal = optimize(profName, baseline, weights, { useInventoryOverride: false });
  var sessionCaps = buildSessionAwareCaps(selectedSessionId);
  var feasible = optimize(profName, baseline, weights, {
    useInventoryOverride: true,
    inventoryCaps: sessionCaps,
  });

  var useFeasible = !!appState.optimizerSessionNoDeficit;

  function renderSessionAwareMode(mode) {
    var showingFeasible = mode === "feasible";
    appState.optimizerSessionNoDeficit = showingFeasible;
    var displayedResult = showingFeasible ? feasible : ideal;
    renderResults(displayedResult, { sessionCaps: sessionCaps });

    var info = '<div class="info-box">';
    info += 'Session-aware context: <strong>' + escapeHtml((selectedSession && selectedSession.name) || ('Session ' + selectedSessionId)) + '</strong>. ';
    info += 'Ideal plan ignores session reservations; feasible plan uses remaining inventory after reserving all unsent planned humans (including this session).';
    info += '</div>';

    info += '<div class="inventory-actions">';
    info += '<button type="button" class="mini-btn" id="session-use-ideal-btn"' + (!showingFeasible ? ' disabled' : '') + '>Use ideal plan (may require crafting)</button>';
    info += '<button type="button" class="mini-btn" id="session-use-feasible-btn"' + (showingFeasible ? ' disabled' : '') + '>Use feasible plan (no deficit)</button>';
    info += '</div>';

    var deficits = getPlanDeficits(ideal, sessionCaps);
    if (deficits.length) {
      info += '<div class="warn-box"><div class="warn-title">Session-aware deficits vs ideal</div>';
      deficits.slice(0, 8).forEach(function(d) {
        info += '<div class="overlap-row">' + d.kind + ' <strong>' + escapeHtml(d.name) + '</strong>: short by ' + d.short + ' (' + d.have + ' available vs ' + d.need + ' ideal)</div>';
      });
      if (!showingFeasible) {
        info += '<div class="overlap-row">Tip: click <strong>Use feasible plan (no deficit)</strong> to switch instantly.</div>';
      }
      info += '</div>';
    }

    setHTML("results", info + el("results").innerHTML);

    var useIdealBtn = el("session-use-ideal-btn");
    if (useIdealBtn) {
      useIdealBtn.addEventListener("click", function() {
        renderSessionAwareMode("ideal");
      });
    }

    var useFeasibleBtn = el("session-use-feasible-btn");
    if (useFeasibleBtn) {
      useFeasibleBtn.addEventListener("click", function() {
        renderSessionAwareMode("feasible");
      });
    }

    var optimizerAddPlanBtn = el("optimizer-add-plan-btn");
    if (optimizerAddPlanBtn) {
      optimizerAddPlanBtn.addEventListener("click", function() {
        if (!lastOptimizerResult) return;
        addHumanPlanEntry("optimizer", lastOptimizerResult.label, lastOptimizerResult.professionName, lastOptimizerResult.chosenFood, lastOptimizerResult.chosenMem);
      });
    }

    var applyPlanButton = el("apply-plan-btn");
    if (applyPlanButton) {
      applyPlanButton.addEventListener("click", function() {
        if (!window.confirm("Deduct all planned food and memory quantities from your inventory?")) return;
        applyPlanToInventory(displayedResult);
      });
    }

    saveProfile();
  }

  renderSessionAwareMode(useFeasible ? "feasible" : "ideal");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  Array.prototype.forEach.call(document.querySelectorAll('.tab-btn'), function(button) {
    button.addEventListener('click', function() {
      setActiveTab(button.getAttribute('data-tab'));
    });
  });

  // Selection controls
  populateCommittees();
  populateAllProfs();
  el("csel").addEventListener("change", populateProfs);
  el("psel").addEventListener("change", function() {
    el("psel-all").value = el("psel").value;
    showTraits();
    onBaselineChange();
    updateCreatedProfessionUI();
    saveProfile();
  });
  el("psel-all").addEventListener("change", function() {
    setSelectedProfessionName(el("psel-all").value);
    showTraits();
    onBaselineChange();
    updateCreatedProfessionUI();
    saveProfile();
  });
  el("prof-mode").addEventListener("change", function() {
    setProfessionModeUI();
    updateCreatedProfessionUI();
    saveProfile();
  });
  el("progress-status-filter").addEventListener("change", renderProfessionProgressList);

  // Baseline sliders
  ["b-life", "b-height", "b-weight"].forEach(function(id) {
    el(id).addEventListener("input", function() { onBaselineChange(); showTraits(); saveProfile(); });
  });

  // Toggles
  initToggle("bf-toggle", "bf-track", "bf-chips", "excludeBioFlesh", BIO_FLESH_FOODS);
  initToggle("art-toggle", "art-track", "art-chips", "excludeArtifact", ARTIFACT_MEMORIES);

  // Persisted profile state
  var profile = loadProfile();
  appState.inventory = normalizeInventory(profile.inventory);
  appState.sandbox = normalizeSandbox(profile.sandbox);
  appState.sandboxFilters = normalizeSandboxFilters(profile.sandboxFilters);
  appState.sandboxHideCreated = !!profile.sandboxHideCreated;
  appState.plan = normalizePlan(profile.plan);
  appState.createdProfessions = normalizeCreatedProfessions(profile.createdProfessions);
  appState.useInventory = profile.useInventory !== false;
  appState.excludeBioFlesh = !!profile.excludeBioFlesh;
  appState.excludeArtifact = !!profile.excludeArtifact;
  appState.optimizerSessionAware = !!profile.optimizerSessionAware;
  appState.optimizerSessionNoDeficit = !!profile.optimizerSessionNoDeficit;
  appState.optimizerSessionId = profile.optimizerSessionId;
  appState.activeTab = normalizeTab(profile.activeTab);
  appState.theme = normalizeTheme(profile.theme);
  applyTheme(appState.theme);

  el("theme-select").value = appState.theme;
  el("theme-select").addEventListener("change", function() {
    appState.theme = normalizeTheme(el("theme-select").value);
    applyTheme(appState.theme);
    saveProfile();
  });

  el("prof-mode").value = normalizeProfessionMode(profile.professionMode);
  setProfessionModeUI();

  var persistedBaseline = normalizeBaseline(profile.baseline);
  el("b-life").value = String(persistedBaseline.lifeExp);
  el("b-height").value = String(persistedBaseline.height);
  el("b-weight").value = String(persistedBaseline.weight);

  if (profile.selectedProfession) {
    setSelectedProfessionName(profile.selectedProfession);
  }
  el("ash-allow-multi-prof").checked = !!profile.ashAllowMultiPerProfession;
  appState.ashAllowMultiPerProfession = !!profile.ashAllowMultiPerProfession;
  el("opt-session-aware").checked = !!appState.optimizerSessionAware;
  el("opt-session-no-deficit").checked = !!appState.optimizerSessionNoDeficit;
  populateOptimizerSessionSelect();
  updateOptimizerSessionControlsUI();
  setExcludeToggleUI("bf-track", "bf-chips", "excludeBioFlesh", BIO_FLESH_FOODS);
  setExcludeToggleUI("art-track", "art-chips", "excludeArtifact", ARTIFACT_MEMORIES);

  // Inventory state + controls
  renderInventoryEditors();
  renderSandboxEditors();
  renderSandboxResults();
  renderPlanTab();
  setInventoryToggleUI();
  el("inv-toggle").addEventListener("click", function() {
    appState.useInventory = !appState.useInventory;
    setInventoryToggleUI();
    saveProfile();
  });
  el("inv-export-btn").addEventListener("click", exportInventoryJson);
  el("inv-import-btn").addEventListener("click", function() { el("inv-file-input").click(); });
  el("inv-file-input").addEventListener("change", onInventoryFilePicked);
  el("inv-clear-btn").addEventListener("click", function() {
    if (!window.confirm("Reset all food and memory inventory counts to zero?")) return;
    resetInventoryToZero();
    setHTML("results", '<div class="info-box">Inventory reset to zero.</div>');
  });

  el("sandbox-clear-btn").addEventListener("click", function() {
    appState.sandbox = defaultSandbox();
    saveProfile();
    renderSandboxEditors();
    renderSandboxResults();
  });
  el("sandbox-load-inventory-btn").addEventListener("click", function() {
    appState.sandbox = normalizeSandbox(appState.inventory);
    saveProfile();
    renderSandboxEditors();
    renderSandboxResults();
  });
  el("sandbox-calc-btn").addEventListener("click", renderSandboxResults);
  el("sandbox-clear-filters-btn").addEventListener("click", function() {
    appState.sandboxFilters = defaultSandboxFilters();
    saveProfile();
    renderSandboxEditors();
  });
  el("sandbox-hide-created").checked = !!appState.sandboxHideCreated;
  el("sandbox-hide-created").addEventListener("change", function() {
    appState.sandboxHideCreated = !!el("sandbox-hide-created").checked;
    saveProfile();
    renderSandboxResults();
  });

  el("ash-allow-multi-prof").addEventListener("change", function() {
    appState.ashAllowMultiPerProfession = !!el("ash-allow-multi-prof").checked;
    saveProfile();
  });

  el("opt-session-aware").addEventListener("change", function() {
    appState.optimizerSessionAware = !!el("opt-session-aware").checked;
    updateOptimizerSessionControlsUI();
    saveProfile();
  });
  el("opt-session-no-deficit").addEventListener("change", function() {
    appState.optimizerSessionNoDeficit = !!el("opt-session-no-deficit").checked;
    saveProfile();
  });
  el("opt-session-select").addEventListener("change", function() {
    var v = parseInt(el("opt-session-select").value, 10);
    appState.optimizerSessionId = isNaN(v) ? null : v;
    saveProfile();
  });

  el("plan-add-session-btn").addEventListener("click", addPlanSession);
  el("plan-add-optimizer-btn").addEventListener("click", function() {
    if (!lastOptimizerResult) {
      window.alert("Run Optimizer first to add its latest plan.");
      return;
    }
    addHumanPlanEntry("optimizer", lastOptimizerResult.label, lastOptimizerResult.professionName, lastOptimizerResult.chosenFood, lastOptimizerResult.chosenMem);
  });
  el("plan-add-sandbox-btn").addEventListener("click", function() {
    if (!lastSandboxSnapshot) {
      window.alert("Calculate Sandbox results first to add its current setup.");
      return;
    }
    addHumanPlanEntry("sandbox", lastSandboxSnapshot.label, lastSandboxSnapshot.professionName, lastSandboxSnapshot.chosenFood, lastSandboxSnapshot.chosenMem);
  });

  // Created profession controls
  el("prof-mark-created-btn").addEventListener("click", function() {
    markSelectedProfessionCreated(true);
  });
  el("prof-unmark-created-btn").addEventListener("click", function() {
    markSelectedProfessionCreated(false);
  });
  el("prof-analyze-ash-btn").addEventListener("click", analyzeAshNotebookValue);

  // Run button
  el("run-btn").addEventListener("click", runOptimize);

  // Initial population
  setSelectedProfessionName(el("psel-all").value || PROFESSIONS[0].name);
  setProfessionModeUI();
  onBaselineChange();
  updateCreatedProfessionUI();
  refreshProgressViews();
  refreshReferenceViews();
  setActiveTab(appState.activeTab || "optimizer");
  populateProfs();
}

document.addEventListener("DOMContentLoaded", init);
