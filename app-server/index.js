import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { useServer } from "graphql-ws/lib/use/ws";
import bodyParser from "body-parser";
import { expressMiddleware } from "@apollo/server/express4";
import schema from "./graphql-schema.js";
import routes from "../routes/index.js";
import { graphqlPubsub } from "./pubsub.js";

const port = process.env.PORT || process.env.HTTP_SERVER_PORT || 3013;
const gqlSubscriptionPath = process.env.GRAPHQL_SERVER_SUBSCRIPTIONS_PATH || "/gql-point";

export async function start() {
  const app = express();
  app.use(cors());

  const httpServer = createServer(app);

  // Create WebSocket Server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: gqlSubscriptionPath,
  });

  // GraphQL WebSocket Server
  const wsServerCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        console.log('WebSocket Context created:', {
          connectionParams: ctx.connectionParams,
        });
        
        // Extract user token from connection params
        const token = ctx.connectionParams?.Authorization || 
                     ctx.connectionParams?.authorization ||
                     ctx.connectionParams?.userToken ||
                     ctx.connectionParams?.UserToken;
        
        console.log('Extracted token:', token ? 'Present' : 'Missing');
        
        return {
          token,
          pubsub: graphqlPubsub,
        };
      },
      
      // Handle connection
      onConnect: async (ctx) => {
        console.log('Client connected via WebSocket');
        const token = ctx.connectionParams?.Authorization || 
                     ctx.connectionParams?.authorization ||
                     ctx.connectionParams?.userToken ||
                     ctx.connectionParams?.UserToken;
        
        if (!token) {
          console.log('No token provided, allowing connection for subscription auth');
          // Allow connection, but token will be validated in subscription resolvers
          return true;
        }
        
        console.log('Connection authenticated with token');
        return true;
      },
      
      // Handle disconnection
      onDisconnect: (ctx, code, reason) => {
        console.log('Client disconnected:', { code, reason });
      },
      
      // Handle subscription
      onSubscribe: (ctx, msg) => {
        console.log('Subscription started:', {
          query: msg.payload.query,
          variables: msg.payload.variables,
          operationName: msg.payload.operationName
        });
      },
      
      // Handle errors
      onError: (ctx, msg, errors) => {
        console.error('Subscription error:', errors);
      },
    },
    wsServer
  );

  // Create Apollo Server
  const apolloServer = new ApolloServer({
    introspection: true,
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsServerCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const publicPath = path.join(__dirname, "..", "react-app");

  // Setup routes
  app.use("/api", routes);
  app.use("/gql-point", 
    bodyParser.json(), 
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        // Extract token from HTTP request
        const token = req.headers.authorization || req.headers.Authorization;
        
        return {
          token,
          pubsub: graphqlPubsub,
          req,
        };
      }
    })
  );
  
  app.use("/", express.static(publicPath));

  // Serve React app
  app.get("/*", function (req, res) {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  // Start server
  httpServer.listen(port, () => {
    console.log(`🚀 HTTP server ready at http://localhost:${port}`);
    console.log(`🚀 API endpoint ready at http://localhost:${port}/api`);
    console.log(`🚀 Query endpoint ready at http://localhost:${port}/gql-point`);
    console.log(`🚀 Subscription endpoint ready at ws://localhost:${port}${gqlSubscriptionPath}`);
  });
}