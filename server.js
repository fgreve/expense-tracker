const { execSync } = require("child_process");
execSync("npx next start -H 0.0.0.0 -p 3000", { stdio: "inherit" });
