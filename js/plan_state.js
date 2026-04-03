// js/plan_state.js
// Plan/session/rocket state mutation helpers.
// Loaded before ui.js so UI handlers can call these global functions.

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
