const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeFixtureEvents,
  sanitizeFixtures,
  transformFixtureFullDetails,
} = require("../server/utils/spoilerSanitizer");

const rawMatch = {
  id: "12345",
  kickoff: "2026-06-14T19:00:00Z",
  venue: "Example Stadium",
  status: { long: "Finished" },
  competition: { name: "World Cup", round: "Final" },
  teams: {
    home: "France",
    away: "Argentina",
    homeCountryCode: "fr",
    awayCountryCode: "ar",
    homeWinner: false,
    awayWinner: true,
  },
  goals: { home: 1, away: 3 },
  score: {
    halftime: { home: 1, away: 1 },
    penalty: { home: null, away: null },
  },
  events: [
    {
      elapsed: 23,
      team: "Argentina",
      teamCountryCode: "ar",
      player: "Private Player",
      type: "Goal",
      detail: "Normal Goal",
    },
  ],
};

test("match list contains only the spoiler-safe contract", () => {
  assert.deepEqual(sanitizeFixtures([rawMatch]), [
    {
      id: "12345",
      homeTeam: "Argentina",
      homeTeamCountryCode: "ar",
      awayTeam: "France",
      awayTeamCountryCode: "fr",
      kickoffTime: "2026-06-14T19:00:00Z",
      status: "Finished",
      venue: "Example Stadium",
    },
  ]);
});

test("safe events keep only time and a normalized event category", () => {
  assert.deepEqual(
    sanitizeFixtureEvents([
      rawMatch.events[0],
      {
        elapsed: 90,
        extra: 2,
        team: "France",
        player: "Private Player",
        assist: "Private Assist",
        type: "Card",
        detail: "Red Card",
        comments: "Provider-only detail",
      },
      {
        elapsed: 46,
        type: "subst",
        detail: "Substitution 1",
      },
      {
        elapsed: 34,
        type: "Card",
        detail: "Yellow Card",
      },
      {
        elapsed: 72,
        type: "Var",
        detail: "Goal cancelled",
      },
    ]),
    [
      { minute: 23, extraTime: null, type: "Goal" },
      { minute: 34, extraTime: null, type: "Yellow Card" },
      { minute: 46, extraTime: null, type: "Substitution" },
      {
        minute: 72,
        extraTime: null,
        type: "Disallowed Goal / VAR Check",
      },
      { minute: 90, extraTime: 2, type: "Red Card" },
    ],
  );
});

test("safe recap normalizes provider events without identifying participants", () => {
  const cases = [
    ["Goal", "Normal Goal", "Goal"],
    ["Goal", "Own Goal", "Goal"],
    ["Goal", "Penalty Scored", "Penalty"],
    ["Goal", "Penalty Missed", "Penalty"],
    ["Goal", "Penalty Saved", "Penalty"],
    ["Card", "Red Card", "Red Card"],
    ["Card", "Second Yellow Card", "Red Card"],
    ["Goal", "Goal Cancelled", "Disallowed Goal / VAR Check"],
    ["VAR", "VAR - Goal Cancelled", "Disallowed Goal / VAR Check"],
    ["VAR", "VAR Check", "Disallowed Goal / VAR Check"],
    ["VAR", "No Goal", "Disallowed Goal / VAR Check"],
  ];

  const events = cases.map(([type, detail], index) => ({
    elapsed: index + 1,
    type,
    detail,
    team: "Hidden Team",
    player: "Hidden Player",
    assist: "Hidden Assist",
  }));

  assert.deepEqual(
    sanitizeFixtureEvents(events),
    cases.map(([, , type], index) => ({
      minute: index + 1,
      extraTime: null,
      type,
    })),
  );
});

test("unknown provider event details are not passed through", () => {
  assert.deepEqual(
    sanitizeFixtureEvents([
      {
        elapsed: 12,
        type: "Other",
        detail: "Argentina benefited from this event",
      },
    ]),
    [{ minute: 12, extraTime: null, type: "Match Event" }],
  );
});

test("full details transform contains spoilers only for the dedicated endpoint", () => {
  assert.deepEqual(transformFixtureFullDetails(rawMatch), {
    id: "12345",
    kickoffTime: "2026-06-14T19:00:00Z",
    venue: "Example Stadium",
    city: undefined,
    status: "Finished",
    competition: { name: "World Cup", round: "Final" },
    homeTeam: "France",
    homeTeamCountryCode: "fr",
    awayTeam: "Argentina",
    awayTeamCountryCode: "ar",
    finalScore: { home: 1, away: 3 },
    winner: "Argentina",
    penalties: { home: null, away: null },
    events: [
      {
        minute: 23,
        extraTime: undefined,
        type: "Goal",
        detail: "Normal Goal",
        team: "Argentina",
        teamCountryCode: "ar",
        player: "Private Player",
        assist: undefined,
        comments: undefined,
      },
    ],
  });
});

test("sanitizers return empty arrays for missing provider collections", () => {
  assert.deepEqual(sanitizeFixtures(undefined), []);
  assert.deepEqual(sanitizeFixtureEvents(null), []);
});
