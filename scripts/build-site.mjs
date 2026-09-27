import fs from "node:fs";if(!fs.existsSync("public/index.html"))process.exit(1);console.log("Static site ready in public/");
