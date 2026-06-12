function alphabetizeTeams(teams) {
  return [
    { name: teams.home, countryCode: teams.homeCountryCode || null },
    { name: teams.away, countryCode: teams.awayCountryCode || null },
  ].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

function normalizeEventType(event) {
  const type = String(event?.type || "").toLowerCase();
  const detail = String(event?.detail || "").toLowerCase();
  const providerLabel = `${type} ${detail}`;

  if (
    type === "var" ||
    providerLabel.includes("goal cancelled") ||
    providerLabel.includes("goal canceled") ||
    providerLabel.includes("disallowed goal") ||
    providerLabel.includes("no goal") ||
    providerLabel.includes("var check")
  ) {
    return "Disallowed Goal / VAR Check";
  }

  if (providerLabel.includes("penalty")) {
    return "Penalty";
  }

  if (
    providerLabel.includes("red card") ||
    providerLabel.includes("second yellow")
  ) {
    return "Red Card";
  }

  if (type === "goal") {
    return "Goal";
  }

  if (type === "card" && detail.includes("yellow")) {
    return "Yellow Card";
  }

  if (type === "subst" || type === "substitution") {
    return "Substitution";
  }

  return "Match Event";
}

function sanitizeFixtureEvent(event) {
  return {
    minute: event?.time?.elapsed ?? event?.elapsed ?? null,
    extraTime: event?.time?.extra ?? event?.extra ?? null,
    type: normalizeEventType(event),
  };
}

function sanitizeFixture(fixture) {
  const [homeTeam, awayTeam] = alphabetizeTeams(fixture.teams);

  return {
    id: fixture.id,
    homeTeam: homeTeam.name,
    homeTeamCountryCode: homeTeam.countryCode,
    awayTeam: awayTeam.name,
    awayTeamCountryCode: awayTeam.countryCode,
    kickoffTime: fixture.kickoff,
    status: fixture.status.long,
    venue: fixture.venue,
  };
}

function sanitizeFixtures(fixtures) {
  return (Array.isArray(fixtures) ? fixtures : [])
    .map(sanitizeFixture)
    .sort(
      (first, second) =>
        Date.parse(first.kickoffTime) - Date.parse(second.kickoffTime),
    );
}

function sanitizeFixtureEvents(events) {
  return (Array.isArray(events) ? events : [])
    .map(sanitizeFixtureEvent)
    .sort((first, second) => {
      const firstMinute = first.minute ?? Number.POSITIVE_INFINITY;
      const secondMinute = second.minute ?? Number.POSITIVE_INFINITY;

      return (
        firstMinute - secondMinute ||
        (first.extraTime ?? 0) - (second.extraTime ?? 0)
      );
    });
}

function getFixtureWinner(fixture) {
  if (fixture.teams.homeWinner === true) {
    return fixture.teams.home;
  }

  if (fixture.teams.awayWinner === true) {
    return fixture.teams.away;
  }

  return null;
}

function transformFullEvent(event) {
  return {
    minute: event.elapsed,
    extraTime: event.extra,
    type: normalizeEventType(event),
    detail: event.detail,
    team: event.team,
    teamCountryCode: event.teamCountryCode || null,
    player: event.player,
    assist: event.assist,
    comments: event.comments,
  };
}

function transformFixtureFullDetails(fixture) {
  return {
    id: fixture.id,
    kickoffTime: fixture.kickoff,
    venue: fixture.venue,
    city: fixture.city,
    status: fixture.status.long,
    competition: fixture.competition,
    homeTeam: fixture.teams.home,
    homeTeamCountryCode: fixture.teams.homeCountryCode || null,
    awayTeam: fixture.teams.away,
    awayTeamCountryCode: fixture.teams.awayCountryCode || null,
    finalScore: {
      home: fixture.goals.home,
      away: fixture.goals.away,
    },
    winner: getFixtureWinner(fixture),
    penalties: fixture.score?.penalty || null,
    events: (Array.isArray(fixture.events) ? fixture.events : [])
      .map(transformFullEvent)
      .sort((first, second) => {
        const firstMinute = first.minute ?? Number.POSITIVE_INFINITY;
        const secondMinute = second.minute ?? Number.POSITIVE_INFINITY;

        return (
          firstMinute - secondMinute ||
          (first.extraTime ?? 0) - (second.extraTime ?? 0)
        );
      }),
  };
}

module.exports = {
  sanitizeFixture,
  sanitizeFixtureEvent,
  sanitizeFixtureEvents,
  sanitizeFixtures,
  transformFixtureFullDetails,
};
