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
        // console.log('🔵 WebSocket Context - Full connectionParams:', JSON.stringify(ctx.connectionParams, null, 2));
        
        let token = null;
        const authHeader = ctx.connectionParams?.Authorization || 
                          ctx.connectionParams?.authorization ||
                          ctx.connectionParams?.token;
        
        // console.log('🔵 Raw auth header:', authHeader);
        
        if (authHeader) {
          // Check if it's Bearer token or just token
          if (typeof authHeader === 'string' && authHeader.startsWith("Bearer ")) {
            token = authHeader.replace("Bearer ", "");
          } else {
            token = authHeader;
          }
        }
        
        // console.log('🔵 Extracted token:', token ? token.substring(0, 10) + '...' : 'Missing');
        
        return {
          token,
          pubsub: graphqlPubsub,
        };
      },
      
      onConnect: async (ctx) => {
        // console.log('🟢 CLIENT CONNECTED via WebSocket');
        // console.log('🟢 Connection URL:', ctx.extra.request.url);
        // console.log('🟢 Headers:', ctx.extra.request.headers);
        // console.log('🟢 Connection params:', ctx.connectionParams);
        return true;
      },
      
      onDisconnect: (ctx, code, reason) => {
        // console.log('🔴 CLIENT DISCONNECTED');
        // console.log('🔴 Code:', code);
        // console.log('🔴 Reason:', reason);
      },
      
      onSubscribe: (ctx, msg) => {
        // console.log('📡 SUBSCRIPTION STARTED');
        // console.log('📡 Query:', msg.payload.query);
        // console.log('📡 Variables:', msg.payload.variables);
        // console.log('📡 Operation Name:', msg.payload.operationName);
      },
      
      onError: (ctx, msg, errors) => {
        // console.error('❌ SUBSCRIPTION ERROR:', errors);
      },
      
      onComplete: (ctx, msg) => {
        // console.log('✅ SUBSCRIPTION COMPLETED');
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