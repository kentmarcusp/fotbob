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
    get: async () => ({ data: { response: null } }),
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
