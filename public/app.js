const matchesContainer = document.querySelector("#matches");
const summary = document.querySelector("#summary");
const message = document.querySelector("#message");
const refreshButton = document.querySelector("#refresh-button");
const spoilerDialog = document.querySelector("#spoiler-dialog");

const watchedStorageKey = "world-cup-watched-matches";
let pendingRevealId = null;

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

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function createMatchCard(match) {
  const watched = getWatchedMatchIds().has(match.id);
  const card = document.createElement("article");
  card.className = "match-card";
  card.dataset.matchId = match.id;

  card.innerHTML = `
    <div class="match-card__meta">
      <span>${escapeHtml(formatKickoff(match.kickoffTime))}</span>
      <span>${escapeHtml(match.status || "Status unavailable")}</span>
    </div>
    <h3>
      ${escapeHtml(match.homeTeam)}
      <span class="versus">and</span>
      ${escapeHtml(match.awayTeam)}
    </h3>
    <p class="venue">${escapeHtml(match.venue || "Venue to be announced")}</p>
    <button class="button button--secondary recap-button" type="button">
      View spoiler-safe recap
    </button>
    <section class="event-recap" aria-live="polite" hidden></section>
    <label class="watch-control">
      <input class="watched-toggle" type="checkbox" ${watched ? "checked" : ""}>
      <span class="watched-label">${watched ? "Unmark as watched" : "Mark as watched"}</span>
    </label>
    <button class="button reveal-button" type="button" ${watched ? "" : "hidden"}>
      Reveal full details
    </button>
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
      ? "Unmark as watched"
      : "Mark as watched";
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load the recap.");
      }

      eventRecap.innerHTML = data.length
        ? `<ol class="safe-event-list">${data
            .map((event) => `<li>${formatSafeEvent(event)}</li>`)
            .join("")}</ol>`
        : '<p class="recap-state">No spoiler-safe events available for this match yet.</p>';
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

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function formatSafeEvent(event) {
  const minute =
    event.minute === null
      ? "Time unavailable"
      : `${event.minute}${event.extraTime ? `+${event.extraTime}` : ""}\u2019`;

  return `${escapeHtml(minute)} ${escapeHtml(event.type)}`;
}

function eventDescription(event) {
  const minute =
    event.minute === null
      ? ""
      : `${event.minute}${event.extraTime ? `+${event.extraTime}` : ""}\u2019`;

  if (event.type === "Substitution") {
    const substitution = [
      event.player ? `${event.player} off` : null,
      event.assist ? `${event.assist} on` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return [minute, event.team, event.type, substitution]
      .filter(Boolean)
      .map(escapeHtml)
      .join(" - ");
  }

  const player = event.player
    ? event.assist
      ? `${event.player} (assist: ${event.assist})`
      : event.player
    : null;

  return [minute, event.team, event.detail || event.type, player]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" - ");
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
      ${escapeHtml(match.homeTeam)} ${match.finalScore.home ?? "-"}
      &ndash;
      ${match.finalScore.away ?? "-"} ${escapeHtml(match.awayTeam)}
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
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not reveal the match.");
  }

  renderRevealedMatch(data);
}

async function loadMatches() {
  refreshButton.disabled = true;
  showMessage("");
  summary.textContent = "Loading fixtures...";
  matchesContainer.replaceChildren();

  try {
    const response = await fetch("/api/matches");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load fixtures.");
    }

    if (data.length === 0) {
      matchesContainer.innerHTML =
        '<p class="empty-state">No World Cup matches were found for the configured season.</p>';
      summary.textContent = "No fixtures found";
      return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach((match) => fragment.append(createMatchCard(match)));
    matchesContainer.append(fragment);
    summary.textContent = `${data.length} spoiler-safe matches`;
  } catch (error) {
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

refreshButton.addEventListener("click", loadMatches);
loadMatches();
