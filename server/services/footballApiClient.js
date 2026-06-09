const axios = require("axios");

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getProviderConfiguration() {
  const baseURL =
    process.env.FOOTBALL_API_BASE_URL ||
    "https://v3.football.api-sports.io";
  const apiKey = process.env.FOOTBALL_API_KEY;
  const league = process.env.WORLD_CUP_LEAGUE_ID || "1";
  const season = process.env.WORLD_CUP_SEASON || "2026";

  if (!apiKey) {
    throw createHttpError(
      "FOOTBALL_API_KEY is missing. Add it to your .env file.",
      503,
    );
  }

  return { apiKey, baseURL, league, season };
}

function createClient(configuration) {
  return axios.create({
    baseURL: configuration.baseURL,
    timeout: 10000,
    headers: {
      "x-apisports-key": configuration.apiKey,
    },
  });
}

function getProviderResponseItems(response, resourceName) {
  const items = response?.data?.response;

  if (!Array.isArray(items)) {
    throw createHttpError(
      `The football data provider returned an unexpected ${resourceName} response.`,
      502,
    );
  }

  return items;
}

function mapProviderFixture(fixture) {
  if (!fixture?.fixture || !fixture?.teams) {
    throw createHttpError(
      "The football data provider returned an incomplete fixture.",
      502,
    );
  }

  return {
    id: String(fixture.fixture.id),
    kickoff: fixture.fixture.date || null,
    venue: fixture.fixture.venue?.name || null,
    city: fixture.fixture.venue?.city || null,
    status: {
      short: fixture.fixture.status?.short || null,
      long: fixture.fixture.status?.long || null,
    },
    competition: {
      name: fixture.league?.name || "World Cup",
      round: fixture.league?.round || null,
      season: fixture.league?.season || null,
    },
    teams: {
      home: fixture.teams.home?.name || "TBD",
      away: fixture.teams.away?.name || "TBD",
      homeWinner: fixture.teams.home?.winner ?? null,
      awayWinner: fixture.teams.away?.winner ?? null,
    },
    goals: {
      home: fixture.goals?.home ?? null,
      away: fixture.goals?.away ?? null,
    },
    score: fixture.score || null,
    events: fixture.events || [],
  };
}

function mapProviderEvent(event) {
  return {
    elapsed: event.time?.elapsed ?? null,
    extra: event.time?.extra ?? null,
    team: event.team?.name || null,
    player: event.player?.name || null,
    assist: event.assist?.name || null,
    type: event.type || null,
    detail: event.detail || null,
    comments: event.comments || null,
  };
}

function translateProviderError(error) {
  if (error.status) {
    return error;
  }

  if (!error.response) {
    return createHttpError("The football data provider is unavailable.", 502);
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
    const response = await client.get("/fixtures", {
      params: {
        league: configuration.league,
        season: configuration.season,
      },
    });

    return getProviderResponseItems(response, "fixtures").map(
      mapProviderFixture,
    );
  } catch (error) {
    throw translateProviderError(error);
  }
}

async function getFixtureEvents(fixtureId) {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const response = await client.get("/fixtures/events", {
      params: { fixture: fixtureId },
    });

    return getProviderResponseItems(response, "fixture events").map(
      mapProviderEvent,
    );
  } catch (error) {
    throw translateProviderError(error);
  }
}

async function getFixtureFullDetails(fixtureId) {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const [fixtureResponse, events] = await Promise.all([
      client.get("/fixtures", { params: { id: fixtureId } }),
      getFixtureEvents(fixtureId),
    ]);

    const fixture = getProviderResponseItems(
      fixtureResponse,
      "fixture details",
    )[0];

    if (!fixture) {
      throw createHttpError("Fixture not found.", 404);
    }

    const mappedFixture = mapProviderFixture(fixture);
    mappedFixture.events = events;
    return mappedFixture;
  } catch (error) {
    if (error.status === 404) {
      throw error;
    }

    throw translateProviderError(error);
  }
}

module.exports = {
  getFixtureEvents,
  getFixtureFullDetails,
  getWorldCupFixtures,
};
