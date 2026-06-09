require("dotenv").config();

const app = require("./app");
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Spoiler-safe World Cup app running at http://localhost:${port}`);
});
