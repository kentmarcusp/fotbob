const axios = require("axios");

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getProviderConfiguration() {
  return {
    baseURL:
      process.env.ESPN_API_BASE_URL ||
      "https://site.api.espn.com/apis/site/v2/sports/soccer",
    league: process.env.ESPN_WORLD_CUP_LEAGUE || "fifa.world",
    season: process.env.WORLD_CUP_SEASON || "2026",
  };
}

function createClient(configuration) {
  return axios.create({
    baseURL: configuration.baseURL,
    timeout: 10000,
    headers: {
      Accept: "application/json",
      "User-Agent": "world-cup-spoiler-safe/1.0",
    },
  });
}

function requireArray(value, resourceName) {
  if (!Array.isArray(value)) {
    throw createHttpError(
      `ESPN returned an unexpected ${resourceName} response.`,
      502,
    );
  }

  return value;
}

const fifaToIsoCountryCode = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  CMR: "cm",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRC: "cr",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  DEN: "dk",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRN: "ir",
  IRQ: "iq",
  ITA: "it",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NIR: "gb-nir",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POL: "pl",
  POR: "pt",
  QAT: "qa",
  KSA: "sa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  UKR: "ua",
  URU: "uy",
  USA: "us",
  UZB: "uz",
  WAL: "gb-wls",
};

function teamName(competitor) {
  return (
    competitor?.team?.displayName ||
    competitor?.team?.shortDisplayName ||
    competitor?.team?.name ||
    "TBD"
  );
}

function teamCountryCode(competitor) {
  const abbreviation = String(
    competitor?.team?.abbreviation || "",
  ).toUpperCase();
  return fifaToIsoCountryCode[abbreviation] || null;
}

function findCompetitor(competition, homeAway) {
  return requireArray(
    competition?.competitors,
    "fixture competitors",
  ).find((competitor) => competitor.homeAway === homeAway);
}

function parseScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function mapStatus(status) {
  return {
    short: status?.type?.name || null,
    long:
      status?.type?.description ||
      status?.type?.detail ||
      status?.type?.shortDetail ||
      "Status unavailable",
  };
}

function mapStage(event, competition) {
  return (
    competition?.groups?.abbreviation ||
    event?.season?.slug?.replaceAll("-", " ") ||
    null
  );
}

function mapCompetition(event, competition, league) {
  return {
    name: league?.name || "FIFA World Cup",
    round: mapStage(event, competition),
    season: event?.season?.year ? String(event.season.year) : null,
  };
}

function parseEventClock(event) {
  const displayValue = String(event?.clock?.displayValue || "");
  const clockParts = displayValue.match(/(\d+)(?:['’])?(?:\+(\d+))?/);

  if (clockParts) {
    return {
      elapsed: Number(clockParts[1]),
      extra: clockParts[2] ? Number(clockParts[2]) : null,
    };
  }

  const seconds = Number(event?.clock?.value);
  return {
    elapsed: Number.isFinite(seconds) ? Math.ceil(seconds / 60) : null,
    extra: null,
  };
}

function mapEvent(event, competitorsByTeamId) {
  const eventType = String(event?.type?.type || "").toLowerCase();
  const eventText = String(event?.type?.text || "Match Event");
  const { elapsed, extra } = parseEventClock(event);
  const teamId = String(event?.team?.id || "");
  const competitor = competitorsByTeamId.get(teamId);
  const participants = Array.isArray(event?.participants)
    ? event.participants
    : [];
  const player = participants[0]?.athlete?.displayName || null;
  const secondPlayer = participants[1]?.athlete?.displayName || null;
  const isSubstitution = eventType.includes("substitution");

  let type = "Match Event";
  if (event?.scoringPlay || eventType.includes("goal")) type = "Goal";
  else if (eventType.includes("card")) type = "Card";
  else if (isSubstitution) type = "Substitution";
  else if (eventType.includes("penalty")) type = "Penalty";
  else if (eventType.includes("var")) type = "VAR";

  return {
    elapsed,
    extra,
    team: event?.team?.displayName || teamName(competitor) || null,
    teamCountryCode: teamCountryCode(competitor),
    player,
    assist: secondPlayer,
    type,
    detail: eventText,
    comments: event?.text || null,
  };
}

function isRelevantEvent(event) {
  const type = String(event?.type?.type || "").toLowerCase();
  return Boolean(
    event?.scoringPlay ||
      type.includes("goal") ||
      type.includes("card") ||
      type.includes("substitution") ||
      type.includes("penalty") ||
      type.includes("var"),
  );
}

function getShootoutScore(competitor) {
  return parseScore(
    competitor?.shootoutScore ??
      competitor?.shootout?.score ??
      competitor?.penaltyScore,
  );
}

function mapFixture(event, options = {}) {
  const competition =
    options.competition || requireArray(event?.competitions, "fixtures")[0];

  if (!event?.id || !competition) {
    throw createHttpError("ESPN returned an incomplete fixture.", 502);
  }

  const home = findCompetitor(competition, "home");
  const away = findCompetitor(competition, "away");

  if (!home || !away) {
    throw createHttpError("ESPN returned an incomplete fixture.", 502);
  }

  const competitorsByTeamId = new Map(
    [home, away].map((competitor) => [String(competitor.id), competitor]),
  );
  const rawEvents = options.events || competition.details || [];

  return {
    id: String(event.id),
    kickoff: competition.date || event.date || null,
    venue:
      options.venue?.fullName ||
      competition.venue?.fullName ||
      event.venue?.displayName ||
      null,
    city:
      options.venue?.address?.city ||
      competition.venue?.address?.city ||
      null,
    status: mapStatus(competition.status || event.status),
    competition: mapCompetition(
      event,
      competition,
      options.league,
    ),
    teams: {
      home: teamName(home),
      away: teamName(away),
      homeCountryCode: teamCountryCode(home),
      awayCountryCode: teamCountryCode(away),
      homeWinner: home.winner === true,
      awayWinner: away.winner === true,
    },
    goals: {
      home: parseScore(home.score),
      away: parseScore(away.score),
    },
    score: {
      penalty: {
        home: getShootoutScore(home),
        away: getShootoutScore(away),
      },
    },
    events: requireArray(rawEvents, "fixture events")
      .filter(isRelevantEvent)
      .map((fixtureEvent) =>
        mapEvent(fixtureEvent, competitorsByTeamId),
      ),
  };
}

function translateProviderError(error) {
  if (error.status) {
    return error;
  }

  if (!error.response) {
    return createHttpError("ESPN is unavailable.", 502);
  }

  if (error.response.status === 404) {
    return createHttpError("Fixture not found.", 404);
  }

  if (error.response.status === 429) {
    return createHttpError("ESPN rate limiting was reached.", 503);
  }

  return createHttpError(
    `ESPN returned status ${error.response.status}.`,
    502,
  );
}

async function getWorldCupFixtures() {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const response = await client.get(
      `/${configuration.league}/scoreboard`,
      {
        params: {
          dates: configuration.season,
          limit: 1000,
        },
      },
    );
    const events = requireArray(response?.data?.events, "fixtures");
    const league = response?.data?.leagues?.[0];

    return events.map((event) => mapFixture(event, { league }));
  } catch (error) {
    throw translateProviderError(error);
  }
}

async function getFixtureFullDetails(fixtureId) {
  const configuration = getProviderConfiguration();
  const client = createClient(configuration);

  try {
    const response = await client.get(
      `/${configuration.league}/summary`,
      { params: { event: fixtureId } },
    );
    const competition = response?.data?.header?.competitions?.[0];

    if (!competition?.id) {
      throw createHttpError("Fixture not found.", 404);
    }

    const event = {
      id: competition.id,
      date: competition.date,
      season: response?.data?.header?.season,
      status: competition.status,
    };

    return mapFixture(event, {
      competition,
      events: response?.data?.keyEvents || competition.details || [],
      league: response?.data?.header?.league,
      venue: response?.data?.gameInfo?.venue,
    });
  } catch (error) {
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
