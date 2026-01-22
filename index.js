import { start as appServer } from "./app-server/index.js";
import { sync as mysqlSync } from "./mysql/sync.js";

// envValidator();
// inspect();

mysqlSync();
appServer();


console.log("karami server ready at " + new Date().toISOString());


