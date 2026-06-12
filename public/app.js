const matchesContainer = document.querySelector("#matches");
const summary = document.querySelector("#summary");
const message = document.querySelector("#message");
const refreshButton = document.querySelector("#refresh-button");
const dateFilter = document.querySelector("#date-filter");
const spoilerDialog = document.querySelector("#spoiler-dialog");
const statusFilterButtons = document.querySelectorAll(
  ".status-filter__button",
);

const watchedStorageKey = "world-cup-watched-matches";
let pendingRevealId = null;
let matches = [];
let selectedStatus = "all";

function getWatchedMatchIds() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(watchedStorageKey));
    return new Set(Array.isArray(storedIds) ? storedIds.map(String) : []);
  } catch {
    return new Set();
  }
}

function toggleWatchedMatch(matchId, watched) {
  const watchedMatchIds = getWatchedMatchIds();

  if (watched) {
    watchedMatchIds.add(matchId);
  } else {
    watchedMatchIds.delete(matchId);
  }

  localStorage.setItem(watchedStorageKey, JSON.stringify([...watchedMatchIds]));
}

function formatKickoff(kickoff) {
  const kickoffDate = new Date(kickoff);

  if (Number.isNaN(kickoffDate.getTime())) {
    return "Kickoff time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(kickoffDate);
}

function formatKickoffTime(kickoff) {
  const kickoffDate = new Date(kickoff);

  if (Number.isNaN(kickoffDate.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(kickoffDate);
}

function getLocalDateKey(kickoff) {
  const kickoffDate = new Date(kickoff);

  if (Number.isNaN(kickoffDate.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(kickoffDate);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatFilterDate(kickoff) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(kickoff));
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

async function readJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (${response.status})`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

function createMatchCard(match) {
  const watched = getWatchedMatchIds().has(match.id);
  const card = document.createElement("article");
  card.className = "match-card";
  card.dataset.matchId = match.id;

  card.innerHTML = `
    <div class="match-card__meta">
      <span class="status-badge">${escapeHtml(match.status || "Status unavailable")}</span>
      <span class="kickoff-time">${escapeHtml(formatKickoffTime(match.kickoffTime))}</span>
    </div>
    <div class="match-card__main">
      <div class="matchup">
        ${formatTeamWithFlag(match.homeTeam, match.homeTeamCountryCode)}
        <span class="versus">vs</span>
        ${formatTeamWithFlag(match.awayTeam, match.awayTeamCountryCode)}
      </div>
      <p class="venue">${escapeHtml(match.venue || "Venue to be announced")}</p>
    </div>
    <div class="match-card__actions">
      <button class="button button--secondary recap-button" type="button">
        Safe recap
      </button>
      <label class="watch-control">
        <input class="watched-toggle" type="checkbox" ${watched ? "checked" : ""}>
        <span class="watched-label">${watched ? "Watched" : "Mark watched"}</span>
      </label>
      <button class="button reveal-button" type="button" ${watched ? "" : "hidden"}>
        Reveal result
      </button>
    </div>
    <section class="event-recap" aria-live="polite" hidden></section>
    <div class="revealed" hidden></div>
  `;

  const watchedToggle = card.querySelector(".watched-toggle");
  const revealButton = card.querySelector(".reveal-button");
  const recapButton = card.querySelector(".recap-button");
  const eventRecap = card.querySelector(".event-recap");
  const watchedLabel = card.querySelector(".watched-label");
  const revealed = card.querySelector(".revealed");

  watchedToggle.addEventListener("change", () => {
    toggleWatchedMatch(match.id, watchedToggle.checked);
    watchedLabel.textContent = watchedToggle.checked
      ? "Watched"
      : "Mark watched";
    revealButton.hidden = !watchedToggle.checked;

    if (!watchedToggle.checked) {
      revealed.replaceChildren();
      revealed.hidden = true;
    }
  });

  revealButton.addEventListener("click", () => {
    pendingRevealId = match.id;
    spoilerDialog.returnValue = "cancel";
    spoilerDialog.showModal();
  });

  recapButton.addEventListener("click", async () => {
    recapButton.disabled = true;
    eventRecap.hidden = false;
    eventRecap.innerHTML = '<p class="recap-state">Loading spoiler-safe events...</p>';

    try {
      const response = await fetch(
        `/api/matches/${encodeURIComponent(match.id)}/events`,
      );
      const data = await readJsonResponse(response, "Could not load the recap.");

      if (data.length) {
        renderSafeEvents(eventRecap, data, false);
      } else {
        eventRecap.innerHTML =
          '<p class="recap-state">No spoiler-safe events available for this match yet.</p>';
      }
      recapButton.hidden = true;
    } catch (error) {
      recapButton.disabled = false;
      eventRecap.innerHTML = `
        <p class="recap-state recap-state--error">
          ${escapeHtml(error.message)}
        </p>
      `;
    }
  });

  return card;
}

function populateDateFilter(fixtures) {
  const selectedDate = dateFilter.value;
  const dates = new Map();

  fixtures.forEach((match) => {
    const dateKey = getLocalDateKey(match.kickoffTime);

    if (dateKey && !dates.has(dateKey)) {
      dates.set(dateKey, formatFilterDate(match.kickoffTime));
    }
  });

  dateFilter.replaceChildren(new Option("All dates", "all"));
  [...dates.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .forEach(([dateKey, label]) => {
      dateFilter.add(new Option(label, dateKey));
    });

  dateFilter.value = dates.has(selectedDate) ? selectedDate : "all";
  dateFilter.disabled = dates.size === 0;
}

function renderMatches() {
  const selectedDate = dateFilter.value;
  const dateMatches =
    selectedDate === "all"
      ? matches
      : matches.filter(
          (match) => getLocalDateKey(match.kickoffTime) === selectedDate,
        );
  const visibleMatches = dateMatches.filter((match) => {
    if (selectedStatus === "all") return true;
    const isFinished = String(match.status).toLowerCase().includes("full time");
    return selectedStatus === "finished" ? isFinished : !isFinished;
  });

  matchesContainer.replaceChildren();

  if (visibleMatches.length === 0) {
    matchesContainer.innerHTML =
      '<p class="empty-state">No matches are scheduled for this date.</p>';
    summary.textContent = "No fixtures on this date";
    return;
  }

  const groups = new Map();
  visibleMatches.forEach((match) => {
    const dateKey = getLocalDateKey(match.kickoffTime) || "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(match);
  });

  const fragment = document.createDocumentFragment();
  groups.forEach((groupMatches) => {
    const group = document.createElement("section");
    group.className = "match-day";
    const heading = document.createElement("h3");
    heading.className = "match-day__heading";
    heading.innerHTML = `
      <span>${escapeHtml(formatGroupDate(groupMatches[0].kickoffTime))}</span>
      <span class="match-day__line" aria-hidden="true"></span>
    `;
    const rows = document.createElement("div");
    rows.className = "match-day__rows";
    groupMatches.forEach((match) => rows.append(createMatchCard(match)));
    group.append(heading, rows);
    fragment.append(group);
  });
  matchesContainer.append(fragment);
  summary.textContent =
    selectedDate === "all"
      ? `${visibleMatches.length} spoiler-safe matches`
      : `${visibleMatches.length} matches on ${dateFilter.selectedOptions[0].textContent}`;
}

function formatGroupDate(kickoff) {
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function formatTeamWithFlag(teamName, countryCode) {
  const flag = countryCode
    ? `<img
        class="country-flag"
        src="https://flagcdn.com/w40/${encodeURIComponent(countryCode)}.png"
        srcset="https://flagcdn.com/w80/${encodeURIComponent(countryCode)}.png 2x"
        width="32"
        height="24"
        alt=""
        loading="lazy"
      >`
    : '<span class="country-flag country-flag--empty" aria-hidden="true"></span>';

  return `
    <span class="team-name">
      ${flag}
      <span>${escapeHtml(teamName)}</span>
    </span>
  `;
}

function renderSafeEvents(container, events, revealCategories) {
  container.innerHTML = `
    <ol class="safe-event-list">
      ${events
        .map(
          (event) =>
            `<li>${formatSafeEvent(event, revealCategories)}</li>`,
        )
        .join("")}
    </ol>
    ${
      revealCategories
        ? ""
        : `<button class="button button--secondary reveal-event-types" type="button">
            Reveal event types
          </button>`
    }
  `;

  container
    .querySelector(".reveal-event-types")
    ?.addEventListener("click", () => {
      renderSafeEvents(container, events, true);
    });
}

function formatSafeEvent(event, revealCategory) {
  const minute =
    event.minute === null
      ? "Time unavailable"
      : `${event.minute}${event.extraTime ? `+${event.extraTime}` : ""}\u2019`;
  const eventType = revealCategory
    ? event.type || "Match Event"
    : "Event happened";

  return `
    <span class="safe-event__minute">${escapeHtml(minute)}</span>
    <span class="safe-event__badge ${
      revealCategory
        ? getSafeEventClass(eventType)
        : "safe-event__badge--hidden"
    }">
      <span class="safe-event__icon" aria-hidden="true">${
        revealCategory ? getSafeEventIcon(eventType) : "·"
      }</span>
      ${escapeHtml(eventType)}
    </span>
  `;
}

function getSafeEventClass(eventType) {
  const type = String(eventType).toLowerCase();

  if (type === "goal") return "safe-event__badge--goal";
  if (type === "yellow card") return "safe-event__badge--yellow";
  if (type === "red card") return "safe-event__badge--red";
  if (type === "substitution") return "safe-event__badge--substitution";
  if (type === "penalty") return "safe-event__badge--penalty";
  if (type.includes("var")) return "safe-event__badge--var";
  return "safe-event__badge--default";
}

function getSafeEventIcon(eventType) {
  const type = String(eventType).toLowerCase();

  if (type === "goal") return "●";
  if (type === "yellow card" || type === "red card") return "■";
  if (type === "substitution") return "↕";
  if (type === "penalty") return "P";
  if (type.includes("var")) return "V";
  return "·";
}

function eventDescription(event) {
  const minute =
    event.minute === null
      ? ""
      : `${event.minute}${event.extraTime ? `+${event.extraTime}` : ""}\u2019`;
  const team = formatEventTeam(event);

  if (event.type === "Substitution") {
    const substitution = [
      event.player ? `${event.player} off` : null,
      event.assist ? `${event.assist} on` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return [
      escapeHtml(minute),
      team,
      escapeHtml(event.type),
      escapeHtml(substitution),
    ]
      .filter(Boolean)
      .join(" - ");
  }

  const player = event.player
    ? event.assist
      ? `${event.player} (assist: ${event.assist})`
      : event.player
    : null;

  return [
    escapeHtml(minute),
    team,
    escapeHtml(event.detail || event.type),
    escapeHtml(player),
  ]
    .filter(Boolean)
    .join(" - ");
}

function formatEventTeam(event) {
  if (!event.team) {
    return "";
  }

  const flag = event.teamCountryCode
    ? `<img
        class="event-flag"
        src="https://flagcdn.com/w40/${encodeURIComponent(event.teamCountryCode)}.png"
        srcset="https://flagcdn.com/w80/${encodeURIComponent(event.teamCountryCode)}.png 2x"
        width="24"
        height="18"
        alt=""
        loading="lazy"
      >`
    : "";

  return `<span class="event-team">${flag}<span>${escapeHtml(event.team)}</span></span>`;
}

function renderRevealedMatch(match) {
  const card = matchesContainer.querySelector(`[data-match-id="${match.id}"]`);
  const revealed = card?.querySelector(".revealed");

  if (!revealed) {
    return;
  }

  const events = match.events.length
    ? `<ol class="event-list">${match.events
        .map((event) => `<li>${eventDescription(event)}</li>`)
        .join("")}</ol>`
    : "<p>No detailed events are available.</p>";

  revealed.innerHTML = `
    <p class="revealed__score">
      ${formatTeamWithFlag(match.homeTeam, match.homeTeamCountryCode)}
      ${match.finalScore.home ?? "-"}
      &ndash;
      ${match.finalScore.away ?? "-"}
      ${formatTeamWithFlag(match.awayTeam, match.awayTeamCountryCode)}
    </p>
    <p><strong>Winner:</strong> ${escapeHtml(match.winner || "Draw or unavailable")}</p>
    ${renderPenalties(match)}
    <h4>Match events</h4>
    ${events}
  `;
  revealed.hidden = false;
  card.querySelector(".reveal-button").hidden = true;
}

function renderPenalties(match) {
  if (
    !match.penalties ||
    match.penalties?.home === null ||
    match.penalties?.away === null
  ) {
    return "";
  }

  return `
    <p>
      <strong>Penalties:</strong>
      ${escapeHtml(match.homeTeam)} ${match.penalties.home}
      &ndash;
      ${match.penalties.away} ${escapeHtml(match.awayTeam)}
    </p>
  `;
}

async function revealMatch(matchId) {
  if (!getWatchedMatchIds().has(matchId)) {
    throw new Error("Mark this match as watched before revealing full details.");
  }

  const response = await fetch(
    `/api/matches/${encodeURIComponent(matchId)}/full-details`,
  );
  const data = await readJsonResponse(response, "Could not reveal the match.");

  renderRevealedMatch(data);
}

async function loadMatches() {
  refreshButton.disabled = true;
  showMessage("");
  summary.textContent = "Loading fixtures...";
  matchesContainer.replaceChildren();

  try {
    const response = await fetch("/api/matches");
    const data = await readJsonResponse(response, "Could not load fixtures.");

    if (data.length === 0) {
      matches = [];
      populateDateFilter(matches);
      matchesContainer.innerHTML =
        '<p class="empty-state">No World Cup matches were found for the configured season.</p>';
      summary.textContent = "No fixtures found";
      return;
    }

    matches = data;
    populateDateFilter(matches);
    renderMatches();
  } catch (error) {
    matches = [];
    populateDateFilter(matches);
    summary.textContent = "Fixtures unavailable";
    showMessage(error.message);
  } finally {
    refreshButton.disabled = false;
  }
}

spoilerDialog.addEventListener("close", async () => {
  const matchId = pendingRevealId;
  pendingRevealId = null;

  if (spoilerDialog.returnValue !== "confirm" || !matchId) {
    return;
  }

  const card = matchesContainer.querySelector(`[data-match-id="${matchId}"]`);
  const revealButton = card?.querySelector(".reveal-button");

  try {
    if (revealButton) {
      revealButton.disabled = true;
      revealButton.textContent = "Loading full details...";
    }
    await revealMatch(matchId);
  } catch (error) {
    showMessage(error.message);
  } finally {
    if (revealButton && !revealButton.hidden) {
      revealButton.disabled = false;
      revealButton.textContent = "Reveal full details";
    }
  }
});

dateFilter.addEventListener("change", renderMatches);
refreshButton.addEventListener("click", loadMatches);
statusFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedStatus = button.dataset.status;
    statusFilterButtons.forEach((filterButton) => {
      const active = filterButton === button;
      filterButton.classList.toggle("is-active", active);
      filterButton.setAttribute("aria-pressed", String(active));
    });
    renderMatches();
  });
});
loadMatches();
