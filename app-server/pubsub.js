import { PubSub } from 'graphql-subscriptions';

// Create a single instance of PubSub
const graphqlPubsub = new PubSub();

// Add debug logging to track pubsub events
const originalPublish = graphqlPubsub.publish.bind(graphqlPubsub);
graphqlPubsub.publish = async (triggerName, payload) => {
  
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

graphqlPubsub.publishMessageStatusChanged = async (userId, message) => {
  return graphqlPubsub.publish(`message_status_changed_${userId}`, { 
    messageStatusChanged: message 
  });
};

// Remove chatUpdated helper since we removed that subscription

export { graphqlPubsub };