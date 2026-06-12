const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const footballApiClient = require("../server/services/footballApiClient");

function createCompetitor({
  id,
  homeAway,
  abbreviation,
  displayName,
  score,
  winner = false,
}) {
  return {
    id,
    homeAway,
    winner,
    score,
    team: {
      abbreviation,
      displayName,
    },
  };
}

test("unexpected ESPN scoreboard shape returns a provider error", async () => {
  const originalCreate = axios.create;
  axios.create = () => ({
    get: async () => ({ data: { events: null } }),
  });

  try {
    await assert.rejects(footballApiClient.getWorldCupFixtures(), {
      message: "ESPN returned an unexpected fixtures response.",
      status: 502,
    });
  } finally {
    axios.create = originalCreate;
  }
});

test("ESPN scoreboard fixtures are mapped into the internal provider shape", async () => {
  const originalCreate = axios.create;
  const originalBaseUrl = process.env.ESPN_API_BASE_URL;
  const originalLeague = process.env.ESPN_WORLD_CUP_LEAGUE;
  const originalSeason = process.env.WORLD_CUP_SEASON;
  let clientConfiguration;
  let requestedPath;
  let requestedOptions;

  process.env.ESPN_API_BASE_URL = "https://example.test/soccer";
  process.env.ESPN_WORLD_CUP_LEAGUE = "fifa.world";
  process.env.WORLD_CUP_SEASON = "2026";
  axios.create = (configuration) => {
    clientConfiguration = configuration;

    return {
      get: async (path, options) => {
        requestedPath = path;
        requestedOptions = options;

        return {
          data: {
            leagues: [{ name: "FIFA World Cup" }],
            events: [
              {
                id: "760415",
                date: "2026-06-11T19:00Z",
                season: { year: 2026, slug: "group-stage" },
                competitions: [
                  {
                    date: "2026-06-11T19:00Z",
                    status: {
                      type: {
                        name: "STATUS_FULL_TIME",
                        description: "Full Time",
                      },
                    },
                    venue: {
                      fullName: "Example Stadium",
                      address: { city: "Example City" },
                    },
                    competitors: [
                      createCompetitor({
                        id: "203",
                        homeAway: "home",
                        abbreviation: "MEX",
                        displayName: "Mexico",
                        score: "2",
                        winner: true,
                      }),
                      createCompetitor({
                        id: "467",
                        homeAway: "away",
                        abbreviation: "RSA",
                        displayName: "South Africa",
                        score: "0",
                      }),
                    ],
                    details: [
                      {
                        id: "event-1",
                        type: { type: "goal", text: "Goal" },
                        clock: { displayValue: "9'" },
                        scoringPlay: true,
                        team: { id: "203", displayName: "Mexico" },
                        participants: [
                          { athlete: { displayName: "Hidden Player" } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      },
    };
  };

  try {
    const fixtures = await footballApiClient.getWorldCupFixtures();

    assert.equal(clientConfiguration.baseURL, "https://example.test/soccer");
    assert.equal(clientConfiguration.headers.Accept, "application/json");
    assert.equal(requestedPath, "/fifa.world/scoreboard");
    assert.deepEqual(requestedOptions, {
      params: { dates: "2026", limit: 1000 },
    });
    assert.equal(fixtures[0].teams.homeWinner, true);
    assert.equal(fixtures[0].teams.homeCountryCode, "mx");
    assert.equal(fixtures[0].teams.awayCountryCode, "za");
    assert.equal(fixtures[0].goals.home, 2);
    assert.equal(fixtures[0].events[0].id, "event-1");
    assert.equal(fixtures[0].events[0].detail, "Goal");
    assert.equal(fixtures[0].events[0].teamCountryCode, "mx");
  } finally {
    axios.create = originalCreate;

    if (originalBaseUrl === undefined) delete process.env.ESPN_API_BASE_URL;
    else process.env.ESPN_API_BASE_URL = originalBaseUrl;

    if (originalLeague === undefined) delete process.env.ESPN_WORLD_CUP_LEAGUE;
    else process.env.ESPN_WORLD_CUP_LEAGUE = originalLeague;

    if (originalSeason === undefined) delete process.env.WORLD_CUP_SEASON;
    else process.env.WORLD_CUP_SEASON = originalSeason;
  }
});

test("ESPN event summaries provide full details and relevant events", async () => {
  const originalCreate = axios.create;
  let requestedPath;
  let requestedOptions;

  axios.create = () => ({
    get: async (path, options) => {
      requestedPath = path;
      requestedOptions = options;

      return {
        data: {
          header: {
            league: { name: "FIFA World Cup" },
            season: { year: 2026, slug: "group-stage" },
            competitions: [
              {
                id: "760415",
                date: "2026-06-11T19:00Z",
                status: {
                  type: {
                    name: "STATUS_FULL_TIME",
                    description: "Full Time",
                  },
                },
                competitors: [
                  createCompetitor({
                    id: "203",
                    homeAway: "home",
                    abbreviation: "MEX",
                    displayName: "Mexico",
                    score: "2",
                    winner: true,
                  }),
                  createCompetitor({
                    id: "467",
                    homeAway: "away",
                    abbreviation: "RSA",
                    displayName: "South Africa",
                    score: "0",
                  }),
                ],
              },
            ],
          },
          gameInfo: {
            venue: {
              fullName: "Example Stadium",
              address: { city: "Example City" },
            },
          },
          keyEvents: [
            {
              type: { type: "kickoff", text: "Kickoff" },
              clock: { displayValue: "" },
            },
            {
              id: "goal-67",
              type: { type: "goal", text: "Goal - Header" },
              text: "Scorer headed in a cross from Assistant.",
              shortText: "Scorer Goal",
              period: { number: 2 },
              clock: { displayValue: "67'" },
              scoringPlay: true,
              team: { id: "203", displayName: "Mexico" },
              participants: [
                { athlete: { displayName: "Scorer" } },
                { athlete: { displayName: "Assistant" } },
              ],
            },
            {
              id: "card-92",
              type: { type: "red-card", text: "Red Card" },
              text: "Booked Player was shown a red card.",
              shortText: "Booked Player Red Card",
              period: { number: 2 },
              clock: { displayValue: "90'+2'" },
              team: { id: "467", displayName: "South Africa" },
              participants: [
                { athlete: { displayName: "Booked Player" } },
              ],
            },
          ],
        },
      };
    },
  });

  try {
    const fixture =
      await footballApiClient.getFixtureFullDetails("760415");

    assert.equal(requestedPath, "/fifa.world/summary");
    assert.deepEqual(requestedOptions, {
      params: { event: "760415" },
    });
    assert.equal(fixture.venue, "Example Stadium");
    assert.equal(fixture.city, "Example City");
    assert.equal(fixture.events.length, 2);
    assert.equal(fixture.events[0].id, "goal-67");
    assert.equal(fixture.events[0].type, "Goal");
    assert.equal(fixture.events[0].assist, "Assistant");
    assert.deepEqual(fixture.events[0].players, [
      { id: null, name: "Scorer", role: "Scorer" },
      { id: null, name: "Assistant", role: "Assist" },
    ]);
    assert.equal(
      fixture.events[0].comments,
      "Scorer headed in a cross from Assistant.",
    );
    assert.equal(fixture.events[1].type, "Card");
    assert.equal(fixture.events[1].elapsed, 90);
    assert.equal(fixture.events[1].extra, 2);
    assert.equal(fixture.events[1].teamCountryCode, "za");
  } finally {
    axios.create = originalCreate;
  }
});
