import * as express from "express";
import bodyParser from "body-parser";
import health from "./health.js";
import worldClock from "./world-clock.js";



// import authRoutes from "../../auth/routes/auth.js";
// import trustedDevices from "../../auth/routes/trusted-devices.js";
// import gqlDocsRoutes from "./gql-docs.js";

const expressRouter = express.Router();

expressRouter.use(bodyParser.json()); // to support JSON-encoded bodies
expressRouter.use(bodyParser.urlencoded({ extended: true }) );  // to support URL-encoded bodies

expressRouter.use("/health", health);
expressRouter.use("/world-clock", worldClock);


expressRouter.all("*", async (req, res) => {
  res.json({
    status: "error",
    error: "This is not a public domain",
    data: {
      url: req.url,
    },
  });
  res.end();
});

export default expressRouter;