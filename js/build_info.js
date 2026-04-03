// js/build_info.js
// Simple runtime build marker to help detect stale cached assets on mobile.
(function() {
  var BUILD_LABEL = "Build 2026-04-02.1";

  function applyBuildLabel() {
    var node = document.getElementById("build-label");
    if (!node) return;
    node.textContent = BUILD_LABEL;
    node.setAttribute("data-build", BUILD_LABEL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBuildLabel);
  } else {
    applyBuildLabel();
  }
})();
