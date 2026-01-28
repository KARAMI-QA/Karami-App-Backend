import { start as appServer } from "./app-server/index.js";
import { sync as mysqlSync } from "./mysql/sync.js";

// envValidator();
// inspect();

mysqlSync();
appServer();


const nowUtc3 = new Date(Date.now() + 3 * 60 * 60 * 1000);
console.log("karami server ready at " + nowUtc3.toISOString());



