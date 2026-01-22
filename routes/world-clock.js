import * as express from "express";

function simple(req, res) {
    const clock = {
        UTC0: new Date().toISOString(),
        UTC3: new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString(),
    };

    res.json(clock);
 
    res.end();
}

const expressRouter = express.Router();

expressRouter.get("/all", async (req, res) => { simple(req, res); });
expressRouter.get("/", async (req, res) => {  simple(req, res); });

export default expressRouter;