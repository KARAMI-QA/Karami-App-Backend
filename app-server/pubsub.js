import { PubSub } from 'graphql-subscriptions';

// Create a single instance of PubSub
const graphqlPubsub = new PubSub();

// Add debug logging to track pubsub events
const originalPublish = graphqlPubsub.publish.bind(graphqlPubsub);
graphqlPubsub.publish = async (triggerName, payload) => {
  console.log('📢 PubSub Publish:', {
    triggerName,
    payloadType: typeof payload.messageReceived !== 'undefined' ? 'message' : 
                 typeof payload.chatUpdated !== 'undefined' ? 'chat' : 'other',
    timestamp: new Date().toISOString()
  });
  
  try {
    const result = await originalPublish(triggerName, payload);
    console.log('✅ PubSub Publish Success:', triggerName);
    return result;
  } catch (error) {
    console.error('❌ PubSub Publish Error:', error);
    throw error;
  }
};

// Helper to ensure consistent channel names
graphqlPubsub.publishMessageReceived = async (userId, message) => {
  return graphqlPubsub.publish(`message_received_${userId}`, { messageReceived: message });
};

graphqlPubsub.publishChatUpdated = async (userId, chat) => {
  return graphqlPubsub.publish(`chat_updated_${userId}`, { chatUpdated: chat });
};

export { graphqlPubsub };