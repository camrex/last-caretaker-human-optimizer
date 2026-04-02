// js/optimizer.js
// Core optimizer logic for The Last Caretaker human optimizer.
// Depends on: data/professions.js, data/foods.js, data/memories.js, data/bio.js

// ─── Constants ───────────────────────────────────────────────────────────────

var HARD_MIN = { lifeExp: 10, height: 30, weight: 20 };

var PHYS_TRAITS  = ["lifeExp", "height", "weight", "strength", "intellect"];
var PERS_TRAITS  = ["comms", "empathy", "leadership", "discipline", "focus",
                    "adaptability", "creativity", "patience", "wisdom", "logic"];
var MEM_TRAITS   = ["adaptability", "comms", "creativity", "discipline", "empathy",
                    "focus", "leadership", "logic", "patience", "wisdom"];
var ALL_TRAITS   = PHYS_TRAITS.concat(PERS_TRAITS);
// starChild is handled separately since it is not a standard profession trait yet
var SPECIAL_TRAITS = ["starChild"];

var TRAIT_LABELS = {
  lifeExp:"Life Exp", height:"Height", weight:"Weight",
  strength:"Strength", intellect:"Intellect",
  comms:"Comms", empathy:"Empathy", leadership:"Leadership",
  discipline:"Discipline", focus:"Focus", adaptability:"Adaptability",
  creativity:"Creativity", patience:"Patience", wisdom:"Wisdom", logic:"Logic",
  starChild:"Star Child",
};

var MEM_RANK_LABELS = { 1:"Poor", 2:"Common", 3:"Uncommon", 4:"Rare", 5:"Artifact" };

var BIO_RANK_COLORS  = { 1:"#3B6D11", 2:"#639922", 3:"#BA7517", 4:"#BA7517", 5:"#A32D2D" };
var BIO_RANK_LABELS  = {
  1:"Passive", 2:"Active / easy / abundant",
  3:"Active / easy / finite", 4:"Active / easy / finite", 5:"Active / hard"
};
var MEM_RANK_CSS     = { 1:"r1", 2:"r2", 3:"r3", 4:"r4", 5:"r5" };
var TIER_CSS         = ["", "t1", "t2", "t3", "t4"];

// ─── State ────────────────────────────────────────────────────────────────────

var appState = {
  excludeBioFlesh: false,
  excludeArtifact: false,
  useInventory: true,
  ashAllowMultiPerProfession: false,
  createdProfessions: {},
  inventory: {
    foods: {},
    memories: {},
  },
};

// ─── Data helpers ─────────────────────────────────────────────────────────────

function getBioStuff(name) {
  for (var i = 0; i < BIO_STUFF.length; i++) {
    if (BIO_STUFF[i].name === name) return BIO_STUFF[i];
  }
  return null;
}

function getFood(name) {
  for (var i = 0; i < FOODS.length; i++) {
    if (FOODS[i].name === name) return FOODS[i];
  }
  return null;
}

function getMemory(name) {
  for (var i = 0; i < MEMORIES.length; i++) {
    if (MEMORIES[i].name === name) return MEMORIES[i];
  }
  return null;
}

function getProf(name) {
  for (var i = 0; i < PROFESSIONS.length; i++) {
    if (PROFESSIONS[i].name === name) return PROFESSIONS[i];
  }
  return null;
}

function usesBioFlesh(food) {
  return (food.mito || 0) + (food.nanite || 0) + (food.bio || 0) > 0;
}

function getFoodIngredients(food) {
  var ings = ["carbs", "protein", "fat", "omega3", "vitd", "calcium", "mito", "nanite", "bio"];
  var result = [];
  for (var i = 0; i < ings.length; i++) {
    if ((food[ings[i]] || 0) > 0) {
      result.push({ ing: ings[i], qty: food[ings[i]], bio: ING_TO_BIO[ings[i]] });
    }
  }
  return result;
}

function getCommittees() {
  var seen = {}, out = [];
  for (var i = 0; i < PROFESSIONS.length; i++) {
    var c = PROFESSIONS[i].committee;
    if (c && !seen[c]) { seen[c] = 1; out.push(c); }
  }
  return out.sort();
}

// ─── Target calculation ───────────────────────────────────────────────────────

// Returns the full set of trait targets food+memories must achieve.
// baseline only raises the floor for lifeExp/height/weight.
function getTargets(prof, baseline) {
  var r = {};
  PHYS_TRAITS.forEach(function(t) {
    var target = Math.max(prof[t] || 0, HARD_MIN[t] || 0, (baseline && baseline[t]) || 0);
    if (target > 0) r[t] = target;
  });
  PERS_TRAITS.forEach(function(t) {
    if ((prof[t] || 0) > 0) r[t] = prof[t];
  });
  // starChild — include if profession requires it (future-proofed)
  if ((prof.starChild || 0) > 0) r.starChild = prof.starChild;
  return r;
}

// ─── Cost functions ───────────────────────────────────────────────────────────

function foodCost(food, wCraft, wFarm) {
  var craftScore = food.level * wCraft;
  var biosNeeded = {};
  var ings = ["carbs", "protein", "fat", "omega3", "vitd", "calcium", "mito", "nanite", "bio"];
  for (var i = 0; i < ings.length; i++) {
    if ((food[ings[i]] || 0) > 0) biosNeeded[ING_TO_BIO[ings[i]]] = 1;
  }
  var farmScore = 0;
  for (var bname in biosNeeded) {
    var bd = getBioStuff(bname);
    if (bd) farmScore += bd.rank * wFarm;
  }
  return craftScore + farmScore;
}

function memCost(mem, wMem) {
  return (mem.rank * wMem) || 1;
}

// ─── Greedy optimizer ─────────────────────────────────────────────────────────

// Generic greedy optimizer: picks the item with best (gain / cost) each round.
// items: array of objects
// traitFn(item, traitName) -> number contributed
// remaining: { traitName: amountStillNeeded }  (mutated in place)
// costFn(item) -> cost number
function greedyOptimize(items, traitFn, remaining, costFn, maxCounts) {
  var chosen = {};
  var iter = 0;
  var hasRemaining = function() {
    for (var k in remaining) { if (remaining[k] > 0) return true; }
    return false;
  };
  while (hasRemaining() && iter < 5000) {
    iter++;
    var best = null, bestEff = -1;
    for (var i = 0; i < items.length; i++) {
      if (maxCounts) {
        var currentCount = chosen[items[i].name] || 0;
        var maxAllowed = maxCounts[items[i].name];
        if (typeof maxAllowed === "number" && currentCount >= maxAllowed) continue;
      }
      var gain = 0;
      for (var t in remaining) {
        if (remaining[t] > 0 && (traitFn(items[i], t) || 0) > 0) {
          gain += Math.min(traitFn(items[i], t), remaining[t]);
        }
      }
      if (gain <= 0) continue;
      var eff = gain / (costFn(items[i]) || 1);
      if (eff > bestEff) { bestEff = eff; best = items[i]; }
    }
    if (!best) break;
    chosen[best.name] = (chosen[best.name] || 0) + 1;
    for (var t in remaining) {
      remaining[t] = Math.max(0, remaining[t] - (traitFn(best, t) || 0));
    }
  }
  return chosen;
}

// ─── Profession outcome check ─────────────────────────────────────────────────

function allTraitsSatisfied(achieved, prof) {
  var allT = ALL_TRAITS.concat(SPECIAL_TRAITS);
  for (var i = 0; i < allT.length; i++) {
    var t = allT[i];
    var req = Math.max(prof[t] || 0, HARD_MIN[t] || 0);
    if (req > 0 && (achieved[t] || 0) < req) return false;
  }
  return true;
}

function findQualifiedProfs(achieved, selectedName) {
  var qualified = [];
  for (var i = 0; i < PROFESSIONS.length; i++) {
    var p = PROFESSIONS[i];
    if (p.name === selectedName) continue;
    if (allTraitsSatisfied(achieved, p)) {
      var reqSum = 0;
      ALL_TRAITS.forEach(function(t) { reqSum += Math.max(p[t] || 0, HARD_MIN[t] || 0); });
      qualified.push({ prof: p, reqSum: reqSum });
    }
  }
  qualified.sort(function(a, b) {
    if (b.prof.tier !== a.prof.tier) return b.prof.tier - a.prof.tier;
    return b.reqSum - a.reqSum;
  });
  return qualified;
}

// ─── Main optimize entry point ────────────────────────────────────────────────

function optimize(profName, baseline, weights, options) {
  var prof = getProf(profName);
  if (!prof) return null;
  var ashAllowedForProfession = (prof.tier || 0) >= 4;
  var opts = options || {};
  var useInventory = typeof opts.useInventoryOverride === "boolean"
    ? opts.useInventoryOverride
    : appState.useInventory;
  var capsOverride = (opts.inventoryCaps && typeof opts.inventoryCaps === "object") ? opts.inventoryCaps : null;

  var wCraft = weights.craft || 5;
  var wFarm  = weights.farm  || 5;
  var wMem   = weights.mem   || 5;

  var targets = getTargets(prof, baseline);

  // Food optimizer — physical traits only
  var availableFoods = appState.excludeBioFlesh
    ? FOODS.filter(function(f) { return !usesBioFlesh(f); })
    : FOODS.slice();

  var foodInventoryCaps = null;
  if (useInventory) {
    foodInventoryCaps = capsOverride && capsOverride.foods
      ? capsOverride.foods
      : (appState.inventory && appState.inventory.foods ? appState.inventory.foods : {});
    availableFoods = availableFoods.filter(function(f) {
      return (foodInventoryCaps[f.name] || 0) > 0;
    });
  }

  var physRemaining = {};
  PHYS_TRAITS.forEach(function(t) { if (targets[t]) physRemaining[t] = targets[t]; });

  var chosenFood = greedyOptimize(
    availableFoods,
    function(f, t) { return f[t] || 0; },
    physRemaining,
    function(f) { return foodCost(f, wCraft, wFarm); },
    foodInventoryCaps
  );

  // Memory optimizer — personality traits + starChild
  var availableMems = appState.excludeArtifact
    ? MEMORIES.filter(function(m) { return ARTIFACT_MEMORIES.indexOf(m.name) < 0; })
    : MEMORIES.slice();
  if (!ashAllowedForProfession) {
    availableMems = availableMems.filter(function(m) { return m.name !== "Ash Notebook"; });
  }

  var allowMultiAsh = !!appState.ashAllowMultiPerProfession;

  var memoryInventoryCaps = null;
  if (useInventory) {
    var storedMemoryCaps = capsOverride && capsOverride.memories
      ? capsOverride.memories
      : (appState.inventory && appState.inventory.memories ? appState.inventory.memories : {});
    memoryInventoryCaps = {};
    for (var mname in storedMemoryCaps) memoryInventoryCaps[mname] = storedMemoryCaps[mname];
    availableMems = availableMems.filter(function(m) {
      return (memoryInventoryCaps[m.name] || 0) > 0;
    });
  }

  if (ashAllowedForProfession && !allowMultiAsh) {
    if (!memoryInventoryCaps) memoryInventoryCaps = {};
    var existingAshCap = memoryInventoryCaps["Ash Notebook"];
    if (typeof existingAshCap === "number") {
      memoryInventoryCaps["Ash Notebook"] = Math.min(existingAshCap, 1);
    } else {
      memoryInventoryCaps["Ash Notebook"] = 1;
    }
  }

  var persRemaining = {};
  PERS_TRAITS.forEach(function(t) { if (targets[t]) persRemaining[t] = targets[t]; });
  if (targets.starChild) persRemaining.starChild = targets.starChild;

  var chosenMem = greedyOptimize(
    availableMems,
    function(m, t) { return m[t] || 0; },
    persRemaining,
    function(m) { return memCost(m, wMem); },
    memoryInventoryCaps
  );

  // Tally food results
  var achievedFood = {};
  PHYS_TRAITS.forEach(function(t) { achievedFood[t] = 0; });
  var ingTotals = {}, totalLevel = 0, totalFoodItems = 0;

  for (var fname in chosenFood) {
    var count = chosenFood[fname];
    var food = getFood(fname);
    if (!food) continue;
    totalFoodItems += count;
    PHYS_TRAITS.forEach(function(t) { achievedFood[t] += (food[t] || 0) * count; });
    totalLevel += food.level * count;
    getFoodIngredients(food).forEach(function(x) {
      ingTotals[x.ing] = (ingTotals[x.ing] || 0) + x.qty * count;
    });
  }

  var bioNeeded = calcBioNeeded(ingTotals);

  // Tally memory results
  var achievedMem = {};
  MEM_TRAITS.forEach(function(t) { achievedMem[t] = 0; });
  achievedMem.starChild = 0;
  var totalMemItems = 0, totalMemRankScore = 0;

  for (var mname in chosenMem) {
    var count = chosenMem[mname];
    var mem = getMemory(mname);
    if (!mem) continue;
    totalMemItems += count;
    totalMemRankScore += mem.rank * count;
    MEM_TRAITS.forEach(function(t) { achievedMem[t] += (mem[t] || 0) * count; });
    achievedMem.starChild += (mem.starChild || 0) * count;
  }

  var ashNotebookUsed = chosenMem["Ash Notebook"] || 0;

  // Combined achieved
  var achieved = {};
  PHYS_TRAITS.forEach(function(t) { achieved[t] = achievedFood[t] || 0; });
  PERS_TRAITS.forEach(function(t) { achieved[t] = achievedMem[t] || 0; });
  achieved.starChild = achievedMem.starChild || 0;

  // Shortfalls
  var stillShort = [];
  for (var t in targets) {
    if ((achieved[t] || 0) < targets[t]) stillShort.push(t);
  }

  // Profession outcome check
  var qualified = findQualifiedProfs(achieved, profName);

  return {
    prof:              prof,
    targets:           targets,
    chosenFood:        chosenFood,
    chosenMem:         chosenMem,
    achieved:          achieved,
    achievedFood:      achievedFood,
    achievedMem:       achievedMem,
    ingTotals:         ingTotals,
    bioNeeded:         bioNeeded,
    totalLevel:        totalLevel,
    totalFoodItems:    totalFoodItems,
    totalMemItems:     totalMemItems,
    totalMemRankScore: totalMemRankScore,
    ashNotebookUsed:   ashNotebookUsed,
    stillShort:        stillShort,
    qualified:         qualified,
    baseline:          baseline,
  };
}
