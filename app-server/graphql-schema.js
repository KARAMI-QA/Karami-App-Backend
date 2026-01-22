import lodashMerge from "lodash-es/merge.js";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLScalarType } from "graphql";
import moment from "moment";
import graphqllanguage from "graphql/language/parser.js"
import { graphqlPubsub } from "./pubsub.js";

// import registrationsGql from "../gql/registrations-gql.js";
import usersGql from "../gql/users-gql.js";
import chatsGql from "../gql/chats-gql.js";

const { Kind } = graphqllanguage;

const typeDefs = `
    scalar Date
    scalar LocalDate
    scalar LocalTime
    
    type Query {
        foo: String!
    }
    type Mutation {
        scheduleOperation(name: String!): String!
        changeSomething(id: String!): Result
    }
    type Subscription {
        operationFinished: Operation!
        somethingChanged: Result
        # Add your chat subscriptions here
        chatUpdated(userToken: String!): Chat!
        messageReceived(userToken: String!): Message!
    }
    type Operation {
        name: String!
        endDate: String!
    }
    type Result {
        id: String
    }
    
    # Import chat types
    type ChatParticipant {
        id: ID!
        name: String
        email: String
        image: String
        is_online: Boolean
    }

    type ChatLastMessage {
        id: ID!
        content: String
        media_url: String
        media_type: String
        sender_id: ID!
        sender_name: String
        created_at: String!
    }

    type Chat {
        id: ID!
        name: String
        type: String!
        is_active: Boolean!
        last_message_id: ID
        last_message_at: String
        created_by: ID
        deleted_at: String
        created_at: String!
        updated_at: String!
        participants: [ChatParticipant]
        last_message: ChatLastMessage
        unread_count: Int
        other_participant: ChatParticipant
    }

    type MessageSender {
        id: ID!
        name: String
        email: String
        image: String
    }

    type MessageRead {
        user_id: ID!
        read_at: String!
    }

    type Message {
        id: ID!
        chat_id: ID!
        sender_id: ID!
        content: String
        media_url: String
        media_type: String!
        status: String!
        created_at: String!
        updated_at: String!
        sender: MessageSender
        chat: Chat
        read_by: [MessageRead]
    }
`;

const SOMETHING_CHANGED_TOPIC = 'something_changed';

const resolvers = {
  LocalTime: new GraphQLScalarType({
    name: "LocalTime",
    description: "LocalTime custom scalar type",
    parseValue(value) {
      if (!value) {
        return null;
      }

      if (moment(value, moment.ISO_8601, true).isValid()) {
        return moment(value).format("YYYY-MM-DD HH:mm:ss");
      }

      console.warn("graphql Date parseValue invalid date value", { value });
      return value;
    },
    serialize(value) {
      if (value instanceof Date) {
        return moment(value).format("YYYY-MM-DD HH:mm:ss");
      }
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return moment(ast.value).format("YYYY-MM-DD HH:mm:ss");
      }
      return null;
    },
  }),

  LocalDate: new GraphQLScalarType({
    name: "LocalDate",
    description: "LocalDate custom scalar type",
    parseValue(value) {
      if (!value) {
        return null;
      }

      if (moment(value, "YYYY-MM-DD", true).isValid()) {
        return value;
      }

      console.warn("graphql Date parseValue invalid date value", { value });
      return value;
    },
    serialize(value) {
      if (value instanceof Date) {
        return moment(value).format("YYYY-MM-DD");
      }
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return moment(ast.value).format("YYYY-MM-DD HH:mm:ss");
      }
      return null;
    },
  }),
  
  Date: new GraphQLScalarType({
    name: "Date",
    description: "Date custom scalar type",
    parseValue(value) {
      if (!value) {
        return null;
      }

      if (moment(value, moment.ISO_8601, true).isValid()) {
        return new Date(value);
      }

      console.warn("graphql Date parseValue invalid date value", { value });
      return value;
    },
    serialize(value) {
      if (value instanceof Date && isNaN(value.getTime())) {
        return "";
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(ast.value);
      }
      return null;
    },
  }),
  
  Mutation: {
    scheduleOperation(_, { name }) {
      mockLongLastingOperation(name);
      return `Operation: ${name} scheduled!`;
    },
    changeSomething(_, { id }) {
      graphqlPubsub.publish(SOMETHING_CHANGED_TOPIC, { somethingChanged: { id } });
      return { id };
    },
  },
  
  Query: {
    foo() {
      return "foo";
    },
  },
  
  Subscription: {
    operationFinished: {
      subscribe: () => graphqlPubsub.asyncIterableIterator("OPERATION_FINISHED"),
    },
    somethingChanged: {
      subscribe: () => graphqlPubsub.asyncIterableIterator(SOMETHING_CHANGED_TOPIC),
    },
    // Add chat subscriptions here
    chatUpdated: {
      subscribe: async (_, args, context) => {
        const { userToken } = args;
        console.log('chatUpdated subscription requested with token:', userToken);
        
        // You need to validate the token and get user ID here
        // For now, we'll use a simple approach
        const userId = extractUserIdFromToken(userToken); // Implement this
        
        return graphqlPubsub.asyncIterableIterator(`chat_updated_${userId}`);
      },
      resolve: (payload) => {
        console.log('chatUpdated subscription payload:', payload);
        return payload.chatUpdated;
      }
    },
    messageReceived: {
      subscribe: async (_, args, context) => {
        const { userToken } = args;
        console.log('messageReceived subscription requested with token:', userToken);
        
        // You need to validate the token and get user ID here
        const userId = extractUserIdFromToken(userToken); // Implement this
        
        return graphqlPubsub.asyncIterableIterator(`message_received_${userId}`);
      },
      resolve: (payload) => {
        console.log('messageReceived subscription payload:', payload);
        return payload.messageReceived;
      }
    },
  },
};

// Helper function to extract user ID from token (implement properly)
function extractUserIdFromToken(token) {
  // Implement your token validation and extraction logic here
  // This is just a placeholder
  return token || 'default_user';
}

// Mock function
function mockLongLastingOperation(name) {
  setTimeout(() => {
    graphqlPubsub.publish("OPERATION_FINISHED", {
      operationFinished: {
        name,
        endDate: new Date().toISOString(),
      },
    });
  }, 3000);
}

const schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    // registrationsGql.typeDef,
    usersGql.typeDef,
    chatsGql.typeDef,
  ],
  resolvers: lodashMerge(
    resolvers,
    // registrationsGql.resolvers,
    usersGql.resolvers,
    chatsGql.resolvers,
  ),
});

export default schema;