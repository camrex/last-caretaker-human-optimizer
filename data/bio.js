// data/bio.js
// Bio-stuff definitions for The Last Caretaker optimizer.
// Bio-stuff is farmed from sources, then processed into ingredients used in food recipes.
// Conversion ratio: approximately 1:1 at full power (actual yield ~10-20% higher).
// rank: 1=Passive (easiest) through 5=Active hard (hardest to farm).
//
// Special case — Bio Flesh:
//   One unit of Bio Flesh yields ~1 each of Mito. Amp., Nanite Nutrient, AND Bioregulator
//   simultaneously. Bio Flesh needed = max(mito_needed, nanite_needed, bio_needed).
//
// Special case — Bio Seaweed:
//   One unit yields both Carbohydrates AND Protein simultaneously.
//   Bio Seaweed needed = max(carbs_needed, protein_needed).

var BIO_STUFF = [
  {
    name: "Bio Seaweed",
    source: "Loot, Trawling",
    rank: 1,
    rankLabel: "Passive",
    ingredients: ["carbs", "protein"],
    splitYield: true,   // 1 unit yields all listed ingredients simultaneously
    yieldPer50: { carbs: 55, protein: 60 },
  },
  {
    name: "Bio Waste",
    source: "Loot, Trawling, Humans",
    rank: 1,
    rankLabel: "Passive",
    ingredients: ["fat"],
    splitYield: false,
    yieldPer50: { fat: 65 },
  },
  {
    name: "Bio Organic",
    source: "Crawlers, Mosquitos",
    rank: 2,
    rankLabel: "Active (easy, abundant)",
    ingredients: ["omega3"],
    splitYield: false,
    yieldPer50: { omega3: 59 },
  },
  {
    name: "Bio Dark",
    source: "Red Blobs",
    rank: 3,
    rankLabel: "Active (easy, less abundant)",
    ingredients: ["calcium"],
    splitYield: false,
    yieldPer50: { calcium: 62 },
  },
  {
    name: "Bio Light",
    source: "Pink Blobs",
    rank: 4,
    rankLabel: "Active (easy, less abundant)",
    ingredients: ["vitd"],
    splitYield: false,
    yieldPer50: { vitd: 66 },
  },
  {
    name: "Bio Flesh",
    source: "Angels, Sharks",
    rank: 5,
    rankLabel: "Active (hard, abundant)",
    ingredients: ["mito", "nanite", "bio"],
    splitYield: true,   // 1 unit yields all three simultaneously
    yieldPer50: { mito: 54, nanite: 57, bio: 52 },
  },
];

// Lookup: ingredient name -> bio-stuff name
var ING_TO_BIO = {
  carbs:   "Bio Seaweed",
  protein: "Bio Seaweed",
  fat:     "Bio Waste",
  omega3:  "Bio Organic",
  calcium: "Bio Dark",
  vitd:    "Bio Light",
  mito:    "Bio Flesh",
  nanite:  "Bio Flesh",
  bio:     "Bio Flesh",
};

// Human-readable ingredient labels
var ING_LABELS = {
  carbs:   "Carbohydrates",
  protein: "Protein",
  fat:     "Fat",
  omega3:  "Omega-3",
  vitd:    "Vitamin D",
  calcium: "Calcium",
  mito:    "Mito. Amp.",
  nanite:  "Nanite Nutrient",
  bio:     "Bioregulator",
};

// Calculate bio-stuff units needed from ingredient totals (1:1 baseline).
// Returns { "Bio Seaweed": N, "Bio Waste": N, ... }
function calcBioNeeded(ingTotals) {
  var needed = {};
  // Bio Seaweed: 1 unit yields both carbs AND protein — take the max
  var seaweed = Math.max(ingTotals["carbs"] || 0, ingTotals["protein"] || 0);
  if (seaweed > 0) needed["Bio Seaweed"] = seaweed;
  // Single-yield sources
  if (ingTotals["fat"]     > 0) needed["Bio Waste"]   = ingTotals["fat"];
  if (ingTotals["omega3"]  > 0) needed["Bio Organic"]  = ingTotals["omega3"];
  if (ingTotals["calcium"] > 0) needed["Bio Dark"]     = ingTotals["calcium"];
  if (ingTotals["vitd"]    > 0) needed["Bio Light"]    = ingTotals["vitd"];
  // Bio Flesh: 1 unit yields mito + nanite + bio simultaneously — take the max
  var flesh = Math.max(ingTotals["mito"] || 0, ingTotals["nanite"] || 0, ingTotals["bio"] || 0);
  if (flesh > 0) needed["Bio Flesh"] = flesh;
  return needed;
}
