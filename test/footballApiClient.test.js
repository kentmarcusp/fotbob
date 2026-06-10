const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const footballApiClient = require("../server/services/footballApiClient");

test("missing API key returns a configuration error", async () => {
  const originalApiKey = process.env.FOOTBALL_API_KEY;
  delete process.env.FOOTBALL_API_KEY;

  try {
    await assert.rejects(footballApiClient.getWorldCupFixtures(), {
      message: "FOOTBALL_API_KEY is missing. Add it to your .env file.",
      status: 503,
    });
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.FOOTBALL_API_KEY;
    } else {
      process.env.FOOTBALL_API_KEY = originalApiKey;
    }
  }
});

test("unexpected provider fixture shape returns a provider error", async () => {
  const originalCreate = axios.create;
  const originalApiKey = process.env.FOOTBALL_API_KEY;
  process.env.FOOTBALL_API_KEY = "test-key";
  axios.create = () => ({
    get: async () => ({ data: { matches: null } }),
  });

  try {
    await assert.rejects(footballApiClient.getWorldCupFixtures(), {
      message:
        "The football data provider returned an unexpected fixtures response.",
      status: 502,
    });
  } finally {
    axios.create = originalCreate;

    if (originalApiKey === undefined) {
      delete process.env.FOOTBALL_API_KEY;
    } else {
      process.env.FOOTBALL_API_KEY = originalApiKey;
    }
  }
});

test("football-data.org fixtures are mapped into the internal provider shape", async () => {
  const originalCreate = axios.create;
  const originalApiKey = process.env.FOOTBALL_API_KEY;
  const originalCompetitionCode = process.env.WORLD_CUP_COMPETITION_CODE;
  const originalSeason = process.env.WORLD_CUP_SEASON;
  let clientConfiguration;
  let requestedPath;
  let requestedOptions;

  process.env.FOOTBALL_API_KEY = "test-key";
  process.env.WORLD_CUP_COMPETITION_CODE = "WC";
  process.env.WORLD_CUP_SEASON = "2026";
  axios.create = (configuration) => {
    clientConfiguration = configuration;

    return {
      get: async (path, options) => {
        requestedPath = path;
        requestedOptions = options;

        return {
          data: {
            matches: [
              {
                id: 42,
                utcDate: "2026-06-14T19:00:00Z",
                status: "FINISHED",
                stage: "GROUP_STAGE",
                venue: "Example Stadium",
                competition: { name: "FIFA World Cup" },
                season: { startDate: "2026-06-11" },
                homeTeam: { name: "France", tla: "FRA" },
                awayTeam: { name: "Argentina", tla: "ARG" },
                score: {
                  winner: "AWAY_TEAM",
                  fullTime: { home: 1, away: 2 },
                  penalties: { home: null, away: null },
                },
                goals: [
                  {
                    minute: 67,
                    injuryTime: null,
                    type: "PENALTY",
                    team: { name: "Argentina", tla: "ARG" },
                    scorer: { name: "Hidden Player" },
                    assist: null,
                  },
                ],
                bookings: [
                  {
                    minute: 54,
                    card: "YELLOW_RED",
                    team: { name: "France", tla: "FRA" },
                    player: { name: "Hidden Player" },
                  },
                ],
                substitutions: [],
                penalties: [],
              },
            ],
          },
        };
      },
    };
  };

  try {
    const fixtures = await footballApiClient.getWorldCupFixtures();

    assert.equal(clientConfiguration.headers["X-Auth-Token"], "test-key");
    assert.equal(requestedPath, "/competitions/WC/matches");
    assert.deepEqual(requestedOptions, { params: { season: "2026" } });
    assert.equal(fixtures[0].teams.awayWinner, true);
    assert.equal(fixtures[0].teams.homeCountryCode, "fr");
    assert.equal(fixtures[0].teams.awayCountryCode, "ar");
    assert.equal(fixtures[0].events[0].detail, "Penalty Scored");
    assert.equal(fixtures[0].events[0].teamCountryCode, "ar");
    assert.equal(fixtures[0].events[1].detail, "Second Yellow Card");
    assert.equal(fixtures[0].events[1].teamCountryCode, "fr");
  } finally {
    axios.create = originalCreate;

    if (originalApiKey === undefined) delete process.env.FOOTBALL_API_KEY;
    else process.env.FOOTBALL_API_KEY = originalApiKey;

    if (originalCompetitionCode === undefined) {
      delete process.env.WORLD_CUP_COMPETITION_CODE;
    } else {
      process.env.WORLD_CUP_COMPETITION_CODE = originalCompetitionCode;
    }

    if (originalSeason === undefined) delete process.env.WORLD_CUP_SEASON;
    else process.env.WORLD_CUP_SEASON = originalSeason;
  }
});
