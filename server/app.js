const path = require("path");

const express = require("express");
const matchesRouter = require("./routes/matches");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.json());
app.use("/api/matches", matchesRouter);
app.use(express.static(publicDirectory));

app.get("/api/health", (request, response) => {
  response.json({ status: "ok" });
});

app.get("/test", (request, response) => {
  response.sendFile(path.join(publicDirectory, "test.html"));
});

app.get("*", (request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.use((error, request, response, next) => {
  console.error(error);

  if (response.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message =
    status === 500 ? "The server could not complete the request." : error.message;

  return response.status(status).json({ error: message });
});

module.exports = app;
