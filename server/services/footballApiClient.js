const axios = require("axios");

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getProviderConfiguration() {
  const baseURL =
    process.env.FOOTBALL_API_BASE_URL || "https://api.football-data.org/v4";
  const apiKey = process.env.FOOTBALL_API_KEY;
  const competitionCode = process.env.WORLD_CUP_COMPETITION_CODE || "WC";
  const season = process.env.WORLD_CUP_SEASON || "2026";

  if (!apiKey) {
    throw createHttpError(
      "FOOTBALL_API_KEY is missing. Add it to your .env file.",
      503,
    );
  }

  return { apiKey, baseURL, competitionCode, season };
}

function createClient(configuration) {
  return axios.create({
    baseURL: configuration.baseURL,
    timeout: 10000,
    headers: {
      "X-Auth-Token": configuration.apiKey,
    },
  });
}

function requireArray(value, resourceName) {
  if (!Array.isArray(value)) {
    throw createHttpError(
      `The football data provider returned an unexpected ${resourceName} response.`,
      502,
    );
  }

  return value;
}

function teamName(team) {
  return team?.name || team?.shortName || team?.tla || "TBD";
}

function mapStatus(status) {
  const statusLabels = {
    SCHEDULED: "Scheduled",
    TIMED: "Scheduled",
    IN_PLAY: "In Play",
    PAUSED: "Paused",
    FINISHED: "Finished",
    SUSPENDED: "Suspended",
    POSTPONED: "Postponed",
    CANCELLED: "Cancelled",
    AWARDED: "Awarded",
  };

  return statusLabels[status] || status || "Status unavailable";
}

function mapGoal(goal) {
  return {
    elapsed: goal.minute ?? null,
    extra: goal.injuryTime ?? null,
    team: goal.team?.name || null,
    player: goal.scorer?.name || null,
    assist: goal.assist?.name || null,
    type: "Goal",
    detail: goal.type === "PENALTY" ? "Penalty Scored" : goal.type,
    comments: null,
  };
}

function mapBooking(booking) {
  const card = String(booking.card || "").toUpperCase();

  return {
    elapsed: booking.minute ?? null,
    extra: null,
    team: booking.team?.name || null,
    player: booking.player?.name || null,
    assist: null,
    type: "Card",
    detail: card === "YELLOW_RED" ? "Second Yellow Card" : `${card} Card`,
    comments: null,
  };
}

function mapSubstitution(substitution) {
  return {
    elapsed: substitution.minute ?? null,
    extra: null,
    team: substitution.team?.name || null,
    player: substitution.playerOut?.name || null,
    assist: substitution.playerIn?.name || null,
    type: "Substitution",
    detail: "Substitution",
    comments: null,
  };
}

function mapPenalty(penalty) {
  return {
    elapsed: penalty.minute ?? null,
    extra: penalty.injuryTime ?? null,
    team: penalty.team?.name || null,
    player: penalty.player?.name || null,
    assist: null,
    type: "Penalty",
    detail:
      penalty.scored === true
        ? "Penalty Scored"
        : penalty.scored === false
          ? "Penalty Missed"
          : "Penalty",
    comments: null,
  };
}

function mapFixtureEvents(match) {
  const goals = requireArray(match.goals || [], "fixture goals").map(mapGoal);
  const bookings = requireArray(
    match.bookings || [],
    "fixture bookings",
  ).map(mapBooking);
  const substitutions = requireArray(
    match.substitutions || [],
    "fixture substitutions",
  ).map(mapSubstitution);

  const goalPenaltyPlayers = new Set(
    goals
      .filter((event) => event.detail === "Penalty Scored")
      .map((event) => event.player)
      .filter(Boolean),
  );
  const penalties = requireArray(match.penalties || [], "fixture penalties")
    .map(mapPenalty)
    .filter(
      (event) =>
        event.elapsed !== null ||
        !goalPenaltyPlayers.has(event.player),
    );

  return [...goals, ...bookings, ...substitutions, ...penalties];
}

function mapWinner(score, homeTeam, awayTeam) {
  if (score?.winner === "HOME_TEAM") {
    return { homeWinner: true, awayWinner: false };
  }

  if (score?.winner === "AWAY_TEAM") {
    return { homeWinner: false, awayWinner: true };
  }

  return { homeWinner: false, awayWinner: false };
}

function mapFixture(match) {
  if (!match?.id || !match?.homeTeam || !match?.awayTeam) {
    throw createHttpError(
      "The football data provider returned an incomplete fixture.",
      502,
    );
  }

  const homeTeam = teamName(match.homeTeam);
  const awayTeam = teamName(match.awayTeam);
  const winner = mapWinner(match.score, homeTeam, awayTeam);

  return {
    id: String(match.id),
    kickoff: match.utcDate || null,
    venue: match.venue || null,
    city: null,
    status: {
      short: match.status || null,
      long: mapStatus(match.status),
    },
    competition: {
      name: match.competition?.name || "FIFA World Cup",
      round: match.stage || match.group || match.matchday || null,
      season: match.season?.startDate?.slice(0, 4) || null,
    },
    teams: {
      home: homeTeam,
      away: awayTeam,
      ...winner,
    },
    goals: {
      home: match.score?.fullTime?.home ?? null,
      away: match.score?.fullTime?.away ?? null,
    },
    score: {
      penalty: {
        home: match.score?.penalties?.home ?? null,
        away: match.score?.penalties?.away ?? null,
      },
    },
    events: mapFixtureEvents(match),
  };
}

function translateProviderError(error) {
  if (error.status) {
    return error;
  }

  if (!error.response) {
    return createHttpError("The football data provider is unavailable.", 502);
  }

  if (error.response.status === 403) {
    return createHttpError(
      "The football data provider rejected the API key or plan access.",
      502,
    );
  }

  if (error.response.status === 429) {
    return createHttpError(
      "The football data provider rate limit was reached.",
      503,
    );
  }

  return createHttpError(
    `The football data provider returned status ${error.response.status}.`,
    502,
  );
}

async function getWorldCupFixtures() {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const response = await client.get(
      `/competitions/${configuration.competitionCode}/matches`,
      { params: { season: configuration.season } },
    );

    return requireArray(response?.data?.matches, "fixtures").map(mapFixture);
  } catch (error) {
    throw translateProviderError(error);
  }
}

async function getFixtureFullDetails(fixtureId) {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const response = await client.get(`/matches/${fixtureId}`);

    if (!response?.data?.id) {
      throw createHttpError("Fixture not found.", 404);
    }

    return mapFixture(response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      throw createHttpError("Fixture not found.", 404);
    }

    throw translateProviderError(error);
  }
}

async function getFixtureEvents(fixtureId) {
  const fixture = await getFixtureFullDetails(fixtureId);
  return fixture.events;
}

module.exports = {
  getFixtureEvents,
  getFixtureFullDetails,
  getWorldCupFixtures,
};
