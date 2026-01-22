import gql from "graphql-tag";
import { Sequelize } from "sequelize";
import { 
  getChatById, 
  getUserChats, 
  findOrCreateDirectChat 
} from "../models/chats-model.js";
import { 
  getChatMessages, 
  createMessage, 
  markMessagesAsDelivered,
  markMessageAsSeen,
  getMessageById
} from "../models/messages-model.js";
import { graphqlPubsub } from "../app-server/pubsub.js";
import { validateUserToken } from "./users-gql.js";
import { generateUploadURL, generateDownloadURL } from "../utils/gcs-helper.js";
import crypto from "crypto";

const typeDef = gql`
  type ChatParticipant {
    id: ID!
    name: String
    email: String
    image: String
    is_online: Boolean
  }

  type MessageSender {
    id: ID!
    name: String
    email: String
    image: String
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

  type PaginatedMessages {
    messages: [Message]!
    hasMore: Boolean!
    totalCount: Int!
  }

  type UploadURLResponse {
    url: String!
    file_name: String!
    public_url: String!
    signed_url_expires: String!
  }

  input SendMessageInput {
    chat_id: ID
    receiver_id: ID 
    content: String
    media_url: String
    media_type: String = "NONE"
  }

  input CreateGroupInput {
    name: String!
    participant_ids: [ID]!
  }

  type Query {
    chatGetOne(userToken: String!, chatId: ID!): Chat
    chatGetUserChats(userToken: String!): [Chat]
    chatGetMessages(userToken: String!, chatId: ID!, limit: Int = 50, offset: Int = 0): PaginatedMessages
    chatGetUnreadCount(userToken: String!, chatId: ID!): Int!
    chatGenerateUploadURL(userToken: String!, file_name: String!, content_type: String!): UploadURLResponse!
  }

  type Mutation {
    chatSendMessage(userToken: String!, input: SendMessageInput!): Message!
    chatMarkAsDelivered(userToken: String!, chatId: ID!): Boolean!
    chatMarkAsSeen(userToken: String!, messageId: ID!): Boolean!
    chatCreateDirectChat(userToken: String!, otherUserId: ID!): Chat!
    chatCreateGroup(userToken: String!, input: CreateGroupInput!): Chat!
    chatAddParticipant(userToken: String!, chatId: ID!, userId: ID!): Boolean!
    chatRemoveParticipant(userToken: String!, chatId: ID!, userId: ID!): Boolean!
    chatLeaveGroup(userToken: String!, chatId: ID!): Boolean!
    chatUpdateName(userToken: String!, chatId: ID!, name: String!): Chat!
    chatDeleteChat(userToken: String!, chatId: ID!): Boolean!
  }

  type Subscription {
    messageReceived(userToken: String!): Message!
    chatUpdated(userToken: String!): Chat!
  }
`;

// Subscription topics
const MESSAGE_RECEIVED_TOPIC = 'message_received';
const CHAT_UPDATED_TOPIC = 'chat_updated';

// Helper function to get user ID from token
const getUserIdFromToken = (userToken) => {
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }
  return tokenData.userId;
};

// Helper function to safely parse participants
const parseParticipants = (participantsData) => {
  if (!participantsData) {
    return [];
  }
  
  // If it's already an array, return it
  if (Array.isArray(participantsData)) {
    return participantsData;
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof participantsData === 'string') {
    try {
      // Check if it's a JSON string
      if (participantsData.trim().startsWith('[') || participantsData.trim().startsWith('{')) {
        const parsed = JSON.parse(participantsData);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (error) {
      console.error('Error parsing participants JSON:', error, 'Raw data:', participantsData);
      return [];
    }
  }
  
  // If it's an object but not an array
  if (typeof participantsData === 'object' && participantsData !== null) {
    return [participantsData];
  }
  
  return [];
};

// Helper function to safely parse last_message
const parseLastMessage = (lastMessageData) => {
  if (!lastMessageData) {
    return null;
  }
  
  if (typeof lastMessageData === 'string') {
    try {
      return JSON.parse(lastMessageData);
    } catch (error) {
      console.error('Error parsing last_message JSON:', error);
      return null;
    }
  }
  
  return lastMessageData;
};

// Query Resolvers
const chatGetOne = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chat = await getChatById({ chatId });
  
  // Use helper functions to parse data
  const participants = parseParticipants(chat.participants);
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  // Parse last_message if it exists
  if (chat.last_message) {
    chat.last_message = parseLastMessage(chat.last_message);
  }
  
  return chat;
};

const chatGetUserChats = async (parent, args) => {
  const { userToken } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chats = await getUserChats({ userId });
  
  // Parse participants and last_message for each chat
  return chats.map(chat => {
    if (chat.participants) {
      chat.participants = parseParticipants(chat.participants);
    }
    
    if (chat.last_message) {
      chat.last_message = parseLastMessage(chat.last_message);
    }
    
    if (chat.other_participant && typeof chat.other_participant === 'string') {
      try {
        chat.other_participant = JSON.parse(chat.other_participant);
      } catch (error) {
        chat.other_participant = null;
      }
    }
    
    return chat;
  });
};

const chatGetMessages = async (parent, args) => {
  const { userToken, chatId, limit, offset } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Verify user is chat participant
  const chat = await getChatById({ chatId });
  const participants = parseParticipants(chat.participants);
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  const messages = await getChatMessages({ chatId, limit, offset });
  
  // Get total count
  const totalResult = await sequelize.query(
    `SELECT COUNT(*) as total FROM messages WHERE chat_id = ?`,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: [chatId]
    }
  );
  
  const totalCount = totalResult[0]?.total || 0;
  const hasMore = (offset + messages.length) < totalCount;
  
  return {
    messages,
    hasMore,
    totalCount
  };
};

const chatGetUnreadCount = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  const result = await sequelize.query(
    `
    SELECT COUNT(*) as unread_count
    FROM messages m
    WHERE m.chat_id = :chatId 
      AND m.status = 'SENT'
      AND m.sender_id != :userId
      AND NOT EXISTS (
        SELECT 1 FROM message_reads mr 
        WHERE mr.message_id = m.id 
          AND mr.user_id = :userId
      )
    `,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: { chatId, userId }
    }
  );
  
  return result[0]?.unread_count || 0;
};

const chatGenerateUploadURL = async (parent, args) => {
  const { userToken, file_name, content_type } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Validate file type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mpeg', 'video/quicktime',
    'audio/mpeg', 'audio/mp3', 'audio/wav',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (!allowedTypes.includes(content_type)) {
    throw new Error("Unsupported file type");
  }
  
  // Generate unique file name
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const finalFileName = `chat_media/${userId}/${timestamp}_${randomString}_${sanitizedFileName}`;
  
  // Generate upload URL
  const uploadData = await generateUploadURL({
    fileName: finalFileName,
    contentType: content_type,
    expiresIn: 15 * 60 // 15 minutes
  });
  
  return {
    url: uploadData.signedUrl,
    file_name: finalFileName,
    public_url: uploadData.publicUrl,
    signed_url_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  };
};

// Mutation Resolvers
const chatSendMessage = async (parent, args) => {
  const { userToken, input } = args;
  const userId = getUserIdFromToken(userToken);
  
  let { chat_id, receiver_id, content, media_url, media_type } = input;
  
  // Debug logging
  console.log('chatSendMessage called:', { userId, chat_id, receiver_id });
  
  // If no chat_id provided, create/find direct chat
  if (!chat_id && receiver_id) {
    const chat = await findOrCreateDirectChat({ 
      userId1: userId, 
      userId2: receiver_id 
    });
    chat_id = chat.id;
    console.log('Created/found direct chat:', chat_id);
  }
  
  if (!chat_id) {
    throw new Error("Either chat_id or receiver_id must be provided");
  }
  
  // Verify user is chat participant
  const chat = await getChatById({ chatId: chat_id });
  console.log('Retrieved chat:', { 
    chatId: chat.id, 
    participantsType: typeof chat.participants,
    participantsValue: chat.participants 
  });
  
  const participants = parseParticipants(chat.participants);
  console.log('Parsed participants:', participants);
  
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  // Create message
  const message = await createMessage({
    chatId: chat_id,
    senderId: userId,
    content,
    mediaUrl: media_url,
    mediaType: media_type
  });
  
  console.log('Message created:', message.id);
  
  // Publish to all participants except sender
  participants.forEach(participant => {
    if (String(participant.id) !== String(userId)) {
      console.log('Publishing to participant:', participant.id);
      graphqlPubsub.publish(`${MESSAGE_RECEIVED_TOPIC}_${participant.id}`, {
        messageReceived: message
      });
    }
  });
  
  // Publish chat update to all participants
  participants.forEach(participant => {
    graphqlPubsub.publish(`${CHAT_UPDATED_TOPIC}_${participant.id}`, {
      chatUpdated: chat
    });
  });
  
  return message;
};

const chatMarkAsDelivered = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  await markMessagesAsDelivered({ chatId, userId });
  return true;
};

const chatMarkAsSeen = async (parent, args) => {
  const { userToken, messageId } = args;
  const userId = getUserIdFromToken(userToken);
  
  await markMessageAsSeen({ messageId, userId });
  
  // Get message and notify sender
  const message = await getMessageById({ messageId });
  graphqlPubsub.publish(`${MESSAGE_RECEIVED_TOPIC}_${message.sender_id}`, {
    messageReceived: message
  });
  
  return true;
};

const chatCreateDirectChat = async (parent, args) => {
  const { userToken, otherUserId } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chat = await findOrCreateDirectChat({ 
    userId1: userId, 
    userId2: otherUserId 
  });
  
  // Parse participants and last_message
  if (chat.participants) {
    chat.participants = parseParticipants(chat.participants);
  }
  
  if (chat.last_message) {
    chat.last_message = parseLastMessage(chat.last_message);
  }
  
  return chat;
};

const chatCreateGroup = async (parent, args) => {
  const { userToken, input } = args;
  const userId = getUserIdFromToken(userToken);
  const { name, participant_ids } = input;
  
  // Create group chat
  const [chatId] = await sequelize.query(
    `
    INSERT INTO chats (name, type, created_by, created_at, updated_at)
    VALUES (:name, 'GROUP', :userId, NOW(), NOW());
    `,
    {
      type: Sequelize.QueryTypes.INSERT,
      replacements: { name, userId }
    }
  );
  
  // Add participants (including creator)
  const allParticipants = [userId, ...participant_ids];
  const participantValues = allParticipants.map(pid => 
    `(${chatId}, ${pid}, ${pid === userId ? "'OWNER'" : "'MEMBER'"}, NOW(), NOW())`
  ).join(',');
  
  await sequelize.query(
    `
    INSERT INTO chat_participants (chat_id, user_id, role, created_at, updated_at)
    VALUES ${participantValues};
    `,
    {
      type: Sequelize.QueryTypes.INSERT
    }
  );
  
  const chat = await getChatById({ chatId });
  
  // Parse participants and last_message
  if (chat.participants) {
    chat.participants = parseParticipants(chat.participants);
  }
  
  if (chat.last_message) {
    chat.last_message = parseLastMessage(chat.last_message);
  }
  
  return chat;
};

const chatAddParticipant = async (parent, args) => {
  const { userToken, chatId, userId: newUserId } = args;
  const currentUserId = getUserIdFromToken(userToken);
  
  // Check if current user is admin/owner
  const userRole = await sequelize.query(
    `SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ? AND deleted_at IS NULL`,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: [chatId, currentUserId]
    }
  );
  
  if (!userRole[0] || !['ADMIN', 'OWNER'].includes(userRole[0].role)) {
    throw new Error("PermissionError: Only admins can add participants");
  }
  
  // Add participant
  await sequelize.query(
    `
    INSERT INTO chat_participants (chat_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, 'MEMBER', NOW(), NOW())
    ON DUPLICATE KEY UPDATE deleted_at = NULL, updated_at = NOW();
    `,
    {
      type: Sequelize.QueryTypes.INSERT,
      replacements: [chatId, newUserId]
    }
  );
  
  // Notify all participants
  const chat = await getChatById({ chatId });
  const participants = parseParticipants(chat.participants);
  participants.forEach(participant => {
    graphqlPubsub.publish(`${CHAT_UPDATED_TOPIC}_${participant.id}`, {
      chatUpdated: chat
    });
  });
  
  return true;
};

const chatRemoveParticipant = async (parent, args) => {
  const { userToken, chatId, userId: removeUserId } = args;
  const currentUserId = getUserIdFromToken(userToken);
  
  // Check permissions
  const userRole = await sequelize.query(
    `SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ? AND deleted_at IS NULL`,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: [chatId, currentUserId]
    }
  );
  
  const canRemove = userRole[0] && (
    userRole[0].role === 'OWNER' || 
    (userRole[0].role === 'ADMIN' && removeUserId !== currentUserId)
  );
  
  if (!canRemove) {
    throw new Error("PermissionError: Insufficient permissions to remove participant");
  }
  
  // Soft delete participant
  await sequelize.query(
    `UPDATE chat_participants SET deleted_at = NOW() WHERE chat_id = ? AND user_id = ?`,
    {
      type: Sequelize.QueryTypes.UPDATE,
      replacements: [chatId, removeUserId]
    }
  );
  
  return true;
};

const chatLeaveGroup = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  await sequelize.query(
    `UPDATE chat_participants SET deleted_at = NOW() WHERE chat_id = ? AND user_id = ?`,
    {
      type: Sequelize.QueryTypes.UPDATE,
      replacements: [chatId, userId]
    }
  );
  
  return true;
};

const chatUpdateName = async (parent, args) => {
  const { userToken, chatId, name } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Check if user is admin/owner
  const userRole = await sequelize.query(
    `SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ? AND deleted_at IS NULL`,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: [chatId, userId]
    }
  );
  
  if (!userRole[0] || !['ADMIN', 'OWNER'].includes(userRole[0].role)) {
    throw new Error("PermissionError: Only admins can update chat name");
  }
  
  await sequelize.query(
    `UPDATE chats SET name = ?, updated_at = NOW() WHERE id = ?`,
    {
      type: Sequelize.QueryTypes.UPDATE,
      replacements: [name, chatId]
    }
  );
  
  const chat = await getChatById({ chatId });
  
  // Parse participants and last_message
  if (chat.participants) {
    chat.participants = parseParticipants(chat.participants);
  }
  
  if (chat.last_message) {
    chat.last_message = parseLastMessage(chat.last_message);
  }
  
  return chat;
};

const chatDeleteChat = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  await sequelize.query(
    `UPDATE chats SET deleted_at = NOW(), is_active = FALSE WHERE id = ?`,
    {
      type: Sequelize.QueryTypes.UPDATE,
      replacements: [chatId]
    }
  );
  
  return true;
};

// Subscription Resolvers
// Subscription Resolvers
// Update the subscription resolvers in chats-gql.js
const messageReceived = {
  subscribe: async (_, args, context) => {
    const { userToken } = args;
    console.log('Subscription: messageReceived requested with token:', userToken);
    
    // Validate token and get user ID
    const userId = getUserIdFromToken(userToken);
    console.log(`Subscription: User ${userId} subscribed to messageReceived`);
    
    // Return async iterator for this user's channel
    // Note: Use lowercase to match publish channel exactly
    return graphqlPubsub.asyncIterableIterator(`message_received_${userId}`);
  },
  resolve: (payload) => {
    console.log('Subscription: messageReceived payload received:', payload);
    return payload.messageReceived;
  }
};

const chatUpdated = {
  subscribe: async (_, args, context) => {
    const { userToken } = args;
    console.log('Subscription: chatUpdated requested with token:', userToken);
    
    // Validate token and get user ID
    const userId = getUserIdFromToken(userToken);
    console.log(`Subscription: User ${userId} subscribed to chatUpdated`);
    
    // Return async iterator for this user's channel
    return graphqlPubsub.asyncIterableIterator(`chat_updated_${userId}`);
  },
  resolve: (payload) => {
    console.log('Subscription: chatUpdated payload received:', payload);
    return payload.chatUpdated;
  }
};

const resolvers = {
  Query: {
    chatGetOne,
    chatGetUserChats,
    chatGetMessages,
    chatGetUnreadCount,
    chatGenerateUploadURL,
  },
  Mutation: {
    chatSendMessage,
    chatMarkAsDelivered,
    chatMarkAsSeen,
    chatCreateDirectChat,
    chatCreateGroup,
    chatAddParticipant,
    chatRemoveParticipant,
    chatLeaveGroup,
    chatUpdateName,
    chatDeleteChat,
  },
  Subscription: {
    messageReceived,
    chatUpdated,
  },
};

export default { typeDef, resolvers };