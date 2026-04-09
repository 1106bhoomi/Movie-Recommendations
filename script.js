/**
 * CineMatch — Frontend Logic
 * Handles: search, autocomplete, API calls, result rendering
 */

(() => {
  "use strict";

  /* ── Elements ── */
  const input       = document.getElementById("searchInput");
  const btn         = document.getElementById("searchBtn");
  const acList      = document.getElementById("autocompleteList");
  const resultsEl   = document.getElementById("resultsSection");
  const chips       = document.querySelectorAll(".chip");

  const titles = window.ALL_TITLES || [];
  let acIndex = -1;   // keyboard nav index

  /* ═══════════════════════════════════
     AUTOCOMPLETE
  ═══════════════════════════════════ */
  function filterTitles(q) {
    if (!q) return [];
    const lq = q.toLowerCase();
    return titles
      .filter(t => t.toLowerCase().includes(lq))
      .slice(0, 8);
  }

  function renderAC(matches) {
    acList.innerHTML = "";
    acIndex = -1;
    if (!matches.length) { acList.classList.remove("open"); return; }
    matches.forEach((m, i) => {
      const li = document.createElement("li");
      // Bold the matched portion
      const lm = m.toLowerCase();
      const lq = input.value.toLowerCase();
      const start = lm.indexOf(lq);
      if (start >= 0) {
        li.innerHTML =
          m.slice(0, start) +
          `<strong style="color:var(--gold)">${m.slice(start, start + lq.length)}</strong>` +
          m.slice(start + lq.length);
      } else {
        li.textContent = m;
      }
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = m;
        closeAC();
        doSearch();
      });
      acList.appendChild(li);
    });
    acList.classList.add("open");
  }

  function closeAC() {
    acList.classList.remove("open");
    acList.innerHTML = "";
    acIndex = -1;
  }

  input.addEventListener("input", () => {
    renderAC(filterTitles(input.value));
  });

  input.addEventListener("keydown", (e) => {
    const items = acList.querySelectorAll("li");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      acIndex = Math.min(acIndex + 1, items.length - 1);
      items.forEach((li, i) => li.classList.toggle("active", i === acIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      acIndex = Math.max(acIndex - 1, -1);
      items.forEach((li, i) => li.classList.toggle("active", i === acIndex));
    } else if (e.key === "Enter") {
      if (acIndex >= 0 && items[acIndex]) {
        input.value = items[acIndex].textContent;
        closeAC();
        doSearch();
      } else {
        closeAC();
        doSearch();
      }
    } else if (e.key === "Escape") {
      closeAC();
    }
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !acList.contains(e.target)) closeAC();
  });

  /* ═══════════════════════════════════
     QUICK CHIPS
  ═══════════════════════════════════ */
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.movie;
      closeAC();
      doSearch();
    });
  });

  /* ═══════════════════════════════════
     SEARCH
  ═══════════════════════════════════ */
  btn.addEventListener("click", doSearch);

  async function doSearch() {
    const query = input.value.trim();
    if (!query) {
      input.focus();
      shakeInput();
      return;
    }

    setLoading(true);
    resultsEl.innerHTML = "";

    try {
      const res = await fetch("/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie: query }),
      });
      const data = await res.json();

      if (!res.ok) {
        renderError(data, query);
      } else {
        renderResults(data);
      }
    } catch (err) {
      renderError({ error: "Network error. Is the Flask server running?" }, query);
    } finally {
      setLoading(false);
    }
  }

  /* ═══════════════════════════════════
     RENDER RESULTS
  ═══════════════════════════════════ */
  function renderResults({ query, results }) {
    const header = `
      <div class="results-header">
        <div class="results-title">
          Because you liked <span class="query-name">${esc(query)}</span> …
        </div>
      </div>`;

    const cards = results.map((m, i) => `
      <div class="movie-card">
        <div class="rank">0${i + 1}</div>
        <div class="movie-info">
          <div class="movie-title">${esc(m.title)} <span style="color:var(--text-dim);font-size:.8rem;font-weight:300">${m.year || ""}</span></div>
          <div class="movie-meta">
            <span class="meta-tag"><span class="dot"></span>${esc(m.genres)}</span>
            <span class="meta-tag"><span class="dot"></span>Dir. ${esc(m.director)}</span>
            <span class="meta-tag" style="opacity:.75">${esc(m.cast)}</span>
          </div>
        </div>
        <div class="score-wrap">
          <div class="score-pill">${m.score}%</div>
          <div class="score-bar">
            <div class="score-fill" style="transform:scaleX(${m.score / 100})"></div>
          </div>
        </div>
      </div>`).join("");

    resultsEl.innerHTML = header + cards;
    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderError(data, query) {
    const suggestions = (data.suggestions || []).slice(0, 10);
    const chips = suggestions.map(s =>
      `<button class="suggestion-chip" onclick="window._searchFor('${esc(s)}')">${esc(s)}</button>`
    ).join("");

    resultsEl.innerHTML = `
      <div class="error-card">
        <div class="error-title">🎬 Movie not found</div>
        <div class="error-body">
          "${esc(query)}" isn't in our catalogue yet. Try one of these:
        </div>
        <div class="suggestion-chips">${chips}</div>
      </div>`;
  }

  /* ═══════════════════════════════════
     HELPERS
  ═══════════════════════════════════ */
  function setLoading(on) {
    btn.classList.toggle("loading", on);
    btn.disabled = on;
    input.disabled = on;
  }

  function shakeInput() {
    input.style.animation = "none";
    input.offsetHeight; // reflow
    input.style.animation = "shake .4s ease";
    setTimeout(() => (input.style.animation = ""), 400);
  }

  // Helper for suggestion chip clicks from innerHTML
  window._searchFor = (title) => {
    input.value = title;
    doSearch();
  };

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Shake animation (injected once)
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-6px); }
      40%     { transform: translateX(6px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
})();
