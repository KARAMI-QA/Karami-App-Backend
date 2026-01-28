import { PubSub } from 'graphql-subscriptions';

// Create a single instance of PubSub
const graphqlPubsub = new PubSub();

// Add debug logging to track pubsub events
const originalPublish = graphqlPubsub.publish.bind(graphqlPubsub);
graphqlPubsub.publish = async (triggerName, payload) => {
  console.log('📢 PubSub Publish:', {
    triggerName,
    payloadType: typeof payload.messageReceived !== 'undefined' ? 'message' : 'other',
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

// Helper to ensure consistent channel names for message received
graphqlPubsub.publishMessageReceived = async (userId, message) => {
  return graphqlPubsub.publish(`message_received_${userId}`, { messageReceived: message });
};

// Remove chatUpdated helper since we removed that subscription

export { graphqlPubsub };