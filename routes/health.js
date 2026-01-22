import * as express from "express";

const version = process.env.npm_package_version || "unknown";
const name = process.env.npm_package_name || "unknown";

const appName = `${name}@${version}`;

function simple(req, res) {
    res.json({ appName, health: "ok", utc0: new Date().toISOString() });
    res.end();
}

const expressRouter = express.Router();

expressRouter.get("/simple", async (req, res) => { simple(req, res); });
expressRouter.get("/", async (req, res) => {  simple(req, res); });

export default expressRouter;