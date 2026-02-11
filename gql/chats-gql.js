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
import { generateUploadURL, compressUploadedFile } from "../utils/gcs-helper.js";
import crypto from "crypto";
import sequelize from "../mysql/connection.js";

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

  type CompressFileResponse {
  success: Boolean!
  message: String!
  file_name: String
  public_url: String
  original_size_mb: Float
  compressed_size_mb: Float
  reduction_percent: Float
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
    chatCompressUploadedFile(userToken: String!, file_name: String!): CompressFileResponse!
  }

  type Subscription {
    messageReceived(userToken: String!): Message
    messageStatusChanged(userToken: String!): Message!
     userChatsUpdated(userToken: String!): Chat!
  }
`;

// Subscription topics
const MESSAGE_RECEIVED_TOPIC = 'message_received';
const MESSAGE_STATUS_CHANGED_TOPIC = 'message_status_changed';

const publishMessageStatusChange = async (message, userIds) => {
  userIds.forEach(userId => {
    graphqlPubsub.publish(`${MESSAGE_STATUS_CHANGED_TOPIC}_${userId}`, {
      messageStatusChanged: message
    });
  });
};

const publishUserChatsUpdate = async (userId) => {
  try {
    // Get the updated chats for the user
    const chats = await getUserChats({ userId });
    
    const processedChats = chats.map(chat => {
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
    
    // Publish each chat update
    processedChats.forEach(chat => {
      graphqlPubsub.publish(`user_chats_updated_${userId}`, {
        userChatsUpdated: chat
      });
    });
    
  } catch (error) {
    console.error('Error publishing chat updates:', error);
  }
};  

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
  
  if (Array.isArray(participantsData)) {
    return participantsData;
  }
  
  if (typeof participantsData === 'string') {
    try {
      if (participantsData.trim().startsWith('[') || participantsData.trim().startsWith('{')) {
        const parsed = JSON.parse(participantsData);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (error) {
      console.error('Error parsing participants JSON:', error, 'Raw data:', participantsData);
      return [];
    }
  }
  
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

// Query Resolvers (keep all existing query resolvers unchanged)
const chatGetOne = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chat = await getChatById({ chatId, currentUserId: userId }); // Pass userId here
  
  const participants = parseParticipants(chat.participants);
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  if (chat.last_message) {
    chat.last_message = parseLastMessage(chat.last_message);
  }
  
  return chat;
};

const chatGetUserChats = async (parent, args) => {
  const { userToken } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chats = await getUserChats({ userId });
  
  const processedChats = chats.map(chat => {
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
  
  return processedChats;
};

const chatGetMessages = async (parent, args) => {
  const { userToken, chatId, limit, offset } = args;
  const userId = getUserIdFromToken(userToken);
  
  const chat = await getChatById({ chatId });
  const participants = parseParticipants(chat.participants);
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  const messages = await getChatMessages({ chatId, limit, offset });
  
  const totalResult = await sequelize.query(
    `SELECT COUNT(*) as total FROM messages WHERE chat_id = ?`,
    {
      type: sequelize.QueryTypes.SELECT,
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

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 
    'video/x-matroska', 'video/webm', 'video/x-flv',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/mp4',
    'audio/ogg', 'audio/flac',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/rtf', 'application/vnd.oasis.opendocument.text',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (!allowedTypes.includes(content_type)) {
    throw new Error("Unsupported file type");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const sanitizedFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Get file extension - FIXED: Handle file names with spaces and special chars
  const originalFileName = file_name.replace(/[^a-zA-Z0-9.]/g, '_');
  const extension = originalFileName.split('.').pop().toLowerCase();
  
  // Determine file category and subfolder - UPDATED with more extensions
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mpg', 'mpeg'];
  const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'wma'];
  const docExtensions = [
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 
    'xls', 'xlsx', 'ppt', 'pptx', 'csv'
  ];

  let subfolder = '';
  let prefix = '';
  
  // Check by content_type first (more reliable)
  if (content_type.startsWith('image/') || imageExtensions.includes(extension)) {
    subfolder = 'photo';
  } else if (content_type.startsWith('video/') || videoExtensions.includes(extension)) {
    subfolder = 'video';
  } else if (content_type.startsWith('audio/') || audioExtensions.includes(extension)) {
    subfolder = 'audio';
  } else if (docExtensions.includes(extension)) {
    subfolder = 'document';
    if (['pdf'].includes(extension)) {
      prefix = 'pdf_';
    } else if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
      prefix = 'doc_';
    } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
      prefix = 'xls_';
    } else if (['ppt', 'pptx'].includes(extension)) {
      prefix = 'ppt_';
    }
  } else {
    subfolder = 'other';
  }

  const finalFileName = `${year}/${month}/chat_media/${userId}/${subfolder}/${timestamp}_${randomString}_${prefix}${sanitizedFileName}`;

  // Determine if compression is supported for this file type - FIXED
  let shouldCompress = false;
  let maxSizeMB = null;
  
  if (content_type.startsWith('image/') || imageExtensions.includes(extension)) {
    shouldCompress = true;
    console.log(`🖼️ Image file detected: ${content_type}`);
  } else if (content_type.startsWith('video/') || videoExtensions.includes(extension)) {
    shouldCompress = true;
    maxSizeMB = 5;
    console.log(`🎥 Video file detected: ${content_type}, max size: 5MB`);
  }
  
  console.log(`📊 Compression settings for ${file_name}: shouldCompress=${shouldCompress}, maxSizeMB=${maxSizeMB}`);

  const uploadData = await generateUploadURL({
    fileName: finalFileName,
    contentType: content_type,
    expiresIn: 15 * 60,
    shouldCompress
  });

  return {
    url: uploadData.signedUrl,
    file_name: finalFileName,
    public_url: uploadData.publicUrl,
    signed_url_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    category: subfolder.toUpperCase(),
    compression_supported: shouldCompress,
    max_size_mb: maxSizeMB,
    compress_after_upload: shouldCompress
  };
};


// Mutation Resolvers
const chatSendMessage = async (parent, args) => {
  const { userToken, input } = args;
  const userId = getUserIdFromToken(userToken);
  
  let { chat_id, receiver_id, content, media_url, media_type } = input;
  
  // Handle null media_url (convert to null instead of string 'null')
  if (media_url === 'null' || media_url === null || media_url === undefined) {
    media_url = null;
  }
  
  // If media_url is provided but media_type is still NONE, try to detect type
  if (media_url && media_type === 'NONE') {
    const extension = media_url.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a'];
    const docExtensions = ['pdf', 'doc', 'docx', 'txt'];
    
    if (imageExtensions.includes(extension)) {
      media_type = 'IMAGE';
    } else if (videoExtensions.includes(extension)) {
      media_type = 'VIDEO';
    } else if (audioExtensions.includes(extension)) {
      media_type = 'AUDIO';
    } else if (docExtensions.includes(extension)) {
      media_type = 'DOCUMENT';
    }
  }
  
  console.log('chatSendMessage called:', { 
    userId, 
    chat_id, 
    receiver_id, 
    hasMedia: !!media_url,
    media_type 
  });
  
  // Rest of the function remains the same...
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
  
  const chat = await getChatById({ chatId: chat_id, currentUserId: userId });
  const participants = parseParticipants(chat.participants);
  const isParticipant = participants.some(p => String(p.id) === String(userId));
  
  if (!isParticipant) {
    throw new Error("PermissionError: You are not a participant of this chat");
  }
  
  const message = await createMessage({
    chatId: chat_id,
    senderId: userId,
    content: content || null,
    mediaUrl: media_url,
    mediaType: media_type || 'NONE'
  });
  
  // Get the chat again to ensure we have correct other_participant for the recipient
  const recipientChat = await getChatById({ 
    chatId: chat_id, 
    currentUserId: receiver_id || participants.find(p => p.id !== userId)?.id 
  });
  
  console.log('Message created:', {
    messageId: message.id,
    hasMedia: !!media_url,
    mediaType: media_type,
    hasChat: !!message.chat
  });
  
  // Publish message to all participants EXCEPT the sender
  participants.forEach(participant => {
    if (String(participant.id) !== String(userId)) {
      console.log('Publishing message to participant:', participant.id);
      
      // Get chat with correct other_participant for this recipient
      getChatById({ chatId: chat_id, currentUserId: participant.id })
        .then(recipientChatData => {
          // Clone message and update chat with correct other_participant
          const messageForRecipient = { ...message };
          if (recipientChatData) {
            messageForRecipient.chat = recipientChatData;
          }
          
          graphqlPubsub.publish(`${MESSAGE_RECEIVED_TOPIC}_${participant.id}`, {
            messageReceived: messageForRecipient
          });
        })
        .catch(err => {
          console.error('Error getting chat for recipient:', err);
          // Fallback to original message
          graphqlPubsub.publish(`${MESSAGE_RECEIVED_TOPIC}_${participant.id}`, {
            messageReceived: message
          });
        });
    }
  });

  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });
  
  return message;
};

const chatCompressUploadedFile = async (parent, args) => {
  const { userToken, file_name } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Verify the file belongs to this user (path contains user ID)
  if (!file_name.includes(`/${userId}/`)) {
    throw new Error("PermissionError: You can only compress your own files");
  }
  
  try {
    const result = await compressUploadedFile(file_name);
    
    if (result.compressionInfo) {
      return {
        success: true,
        message: 'File compressed successfully',
        file_name: result.fileName,
        public_url: result.publicUrl,
        original_size_mb: (result.compressionInfo.originalSize / (1024 * 1024)).toFixed(2),
        compressed_size_mb: (result.compressionInfo.compressedSize / (1024 * 1024)).toFixed(2),
        reduction_percent: parseFloat(result.compressionInfo.reduction)
      };
    } else {
      return {
        success: false,
        message: 'Compression not applied (unsupported file type or no compression needed)',
        file_name: result.fileName,
        public_url: result.publicUrl,
        original_size_mb: (result.size / (1024 * 1024)).toFixed(2),
        compressed_size_mb: (result.size / (1024 * 1024)).toFixed(2),
        reduction_percent: 0
      };
    }
  } catch (error) {
    console.error('Error compressing file:', error);
    return {
      success: false,
      message: `Compression failed: ${error.message}`,
      file_name: null,
      public_url: null,
      original_size_mb: 0,
      compressed_size_mb: 0,
      reduction_percent: 0
    };
  }
};

const chatMarkAsDelivered = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Mark messages as delivered
  await markMessagesAsDelivered({ chatId, userId });
  
  // Get the chat to find messages that were updated
  const messages = await sequelize.query(
    `
    SELECT m.*
    FROM messages m
    WHERE m.chat_id = :chatId
      AND m.sender_id != :userId
      AND m.status = 'DELIVERED'
      AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 5 SECOND)
    ORDER BY m.updated_at DESC
    LIMIT 10;
    `,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: { chatId, userId }
    }
  );
  
  // Get chat participants
  const chat = await getChatById({ chatId });
  const participants = parseParticipants(chat.participants);
  const participantIds = participants.map(p => String(p.id));
  
  // Notify about each updated message
  for (const message of messages) {
    const fullMessage = await getMessageById({ messageId: message.id });
    await publishMessageStatusChange(fullMessage, participantIds);
  }
  
  // ✅ ADD THIS: Trigger chat list updates for all participants
  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });
  
  return true;
};

const chatMarkAsSeen = async (parent, args) => {
  const { userToken, messageId } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Mark as seen (this already updates status to 'SEEN')
  await markMessageAsSeen({ messageId, userId });
  
  // Get the updated message with all details
  const message = await getMessageById({ messageId });
  
  // Get chat participants to notify
  const chat = await getChatById({ chatId: message.chat_id });
  const participants = parseParticipants(chat.participants);
  
  // Notify ALL participants about the status change
  // This includes the sender (to update their UI) and the reader
  const participantIds = participants.map(p => String(p.id));
  
  // Publish status change to all participants
  await publishMessageStatusChange(message, participantIds);
  
  // Also notify sender through messageReceived (for backward compatibility)
  if (message && message.sender_id) {
    console.log('Notifying sender that message was seen:', message.sender_id);
    graphqlPubsub.publish(`${MESSAGE_RECEIVED_TOPIC}_${message.sender_id}`, {
      messageReceived: message
    });
  }

  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
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

  publishUserChatsUpdate(userId);
  publishUserChatsUpdate(otherUserId);
  
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

  allParticipants.forEach(participantId => {
    publishUserChatsUpdate(participantId);
  });
  
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
  
  // ✅ ADD THIS: Trigger chat list updates for ALL participants (including new one)
  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });
  
  // Also trigger for the new participant specifically
  publishUserChatsUpdate(newUserId);
  
  // Notify all participants about chat update
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

  participantsBefore
  .filter(p => p.id !== removeUserId)
  .forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });

// 2. The removed user (they should see this chat disappear from their list)
publishUserChatsUpdate(removeUserId);
  
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

  publishUserChatsUpdate(userId);
  
  // 2. All remaining participants
  participantsBefore
    .filter(p => p.id !== userId)
    .forEach(participant => {
      publishUserChatsUpdate(participant.id);
    });
  
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
  
  // ✅ ADD THIS: Trigger chat list updates for all participants
  const participants = parseParticipants(chat.participants);
  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });
  
  return chat;
};

const chatDeleteChat = async (parent, args) => {
  const { userToken, chatId } = args;
  const userId = getUserIdFromToken(userToken);
  
  // Get participants before deletion
  const chat = await getChatById({ chatId });
  const participants = parseParticipants(chat.participants);
  
  await sequelize.query(
    `UPDATE chats SET deleted_at = NOW(), is_active = FALSE WHERE id = ?`,
    {
      type: Sequelize.QueryTypes.UPDATE,
      replacements: [chatId]
    }
  );
  
  // ✅ ADD THIS: Trigger chat list updates for all participants
  participants.forEach(participant => {
    publishUserChatsUpdate(participant.id);
  });
  
  return true;
};

// const messageReceived = {
//   subscribe: async (_, args, context) => {
//     const { userToken } = args;
//     console.log('Subscription: messageReceived requested with token:', userToken);
    
//     // Validate token and get user ID
//     const tokenData = validateUserToken(userToken);
//     if (!tokenData) {
//       throw new Error("AuthError: invalid user token");
//     }
//     const userId = tokenData.userId;
    
//     console.log(`Subscription: User ${userId} subscribed to messageReceived`);
    
//     // Return async iterator for this user's channel
//     // Make sure this matches exactly with the publish channel
//     return graphqlPubsub.asyncIterableIterator(`message_received_${userId}`);
//   },
//   resolve: (payload) => {
//     console.log('Subscription: messageReceived payload received:', payload);
//     return payload.messageReceived;
//   }
// };


// const chatUpdated = {
//   subscribe: async (_, args, context) => {
//     const { userToken } = args;
//     console.log('Subscription: chatUpdated requested with token:', userToken);
    
//       // Validate token and get user ID
//       const userId = getUserIdFromToken(userToken);
//     console.log(`Subscription: User ${userId} subscribed to chatUpdated`);
      
//     // Return async iterator for this user's channel
//     return graphqlPubsub.asyncIterableIterator(`chat_updated_${userId}`);
//   },
//   resolve: (payload) => {
//     console.log('Subscription: chatUpdated payload received:', payload);
//       return payload.chatUpdated;
//   }
// };

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
    chatCompressUploadedFile,
  },
  Subscription: {
    messageReceived: {
      subscribe: async (_, args) => {
        const { userToken } = args;
        
        try {
          // Validate the token and get user ID
          const userId = getUserIdFromToken(userToken);
          
          // console.log(`✅ Subscription: User ${userId} subscribed to messageReceived`);
          
          // Return async iterator for this user's specific channel
          return graphqlPubsub.asyncIterableIterator(`${MESSAGE_RECEIVED_TOPIC}_${userId}`);
        } catch (error) {
          console.error('❌ Subscription authentication error:', error.message);
          throw new Error("AuthError: invalid user token for subscription");
        }
      },
      resolve: (payload) => {
        // console.log('📦 Subscription: Resolving messageReceived payload');
        return payload.messageReceived;
      }
    },
    messageStatusChanged: {
      subscribe: async (_, args) => {
        const { userToken } = args;
        
        try {
          const userId = getUserIdFromToken(userToken);
          console.log(`✅ Subscription: User ${userId} subscribed to messageStatusChanged`);
          return graphqlPubsub.asyncIterableIterator(`${MESSAGE_STATUS_CHANGED_TOPIC}_${userId}`);
        } catch (error) {
          console.error('❌ Subscription authentication error:', error.message);
          throw new Error("AuthError: invalid user token for subscription");
        }
      },
      resolve: (payload) => {
        console.log('📦 Subscription: Resolving messageStatusChanged payload');
        return payload.messageStatusChanged;
      }
    },

    userChatsUpdated: {
      subscribe: async (_, args) => {
        const { userToken } = args;
        
        try {
          const userId = getUserIdFromToken(userToken);
          console.log(`✅ Subscription: User ${userId} subscribed to userChatsUpdated`);
          
          return graphqlPubsub.asyncIterableIterator(`user_chats_updated_${userId}`);
        } catch (error) {
          console.error('❌ Subscription authentication error:', error.message);
          throw new Error("AuthError: invalid user token for subscription");
        }
      },
      resolve: (payload) => {
        console.log('📦 Subscription: Resolving userChatsUpdated payload');
        return payload.userChatsUpdated;
      }
    }
  },
};
  
export default { typeDef, resolvers };