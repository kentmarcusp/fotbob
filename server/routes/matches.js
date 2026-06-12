const express = require("express");

const footballApiClient = require("../services/footballApiClient");
const {
  sanitizeFixtureEvents,
  sanitizeFixtures,
  transformFixtureEventDetails,
  transformFixtureFullDetails,
} = require("../utils/spoilerSanitizer");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    const fixtures = await footballApiClient.getWorldCupFixtures();
    response.json(sanitizeFixtures(fixtures));
  } catch (error) {
    next(error);
  }
});

router.get("/:fixtureId/events", async (request, response, next) => {
  try {
    const events = await footballApiClient.getFixtureEvents(
      request.params.fixtureId,
    );

    response.json(sanitizeFixtureEvents(events));
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:fixtureId/events/:eventId/details",
  async (request, response, next) => {
    try {
      const event = await footballApiClient.getFixtureEventDetails(
        request.params.fixtureId,
        request.params.eventId,
      );

      response.set("Cache-Control", "no-store");
      response.json(transformFixtureEventDetails(event));
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:fixtureId/full-details", async (request, response, next) => {
  try {
    const fixture = await footballApiClient.getFixtureFullDetails(
      request.params.fixtureId,
    );

    response.set("Cache-Control", "no-store");
    response.json(transformFixtureFullDetails(fixture));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
