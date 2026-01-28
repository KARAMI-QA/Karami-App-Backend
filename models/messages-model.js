import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const MessagesModel = sequelize.define(
  "messages",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    chat_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    sender_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: true },
    media_url: { type: DataTypes.TEXT, allowNull: true },
    media_type: { 
      type: DataTypes.ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'NONE'), 
      allowNull: false, 
      defaultValue: 'NONE' 
    },
    status: { 
      type: DataTypes.ENUM('SENT', 'DELIVERED', 'SEEN'), 
      allowNull: false, 
      defaultValue: 'SENT' 
    },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "messages",
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['sender_id'] },
      { fields: ['created_at'] }
    ]
  }
);

export default MessagesModel;

export const getMessageById = async ({ messageId }) => {
  try {
    const messages = await sequelize.query(
      `
      SELECT m.*,
        DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at,
        DATE_FORMAT(m.updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
        
        -- Sender info
        JSON_OBJECT(
          'id', u.id,
          'name', COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name)),
          'email', u.email,
          'image', u.image
        ) as sender,
        
        -- Chat info
        JSON_OBJECT(
          'id', c.id,
          'type', c.type,
          'name', c.name
        ) as chat,
        
        -- Get read status for participants
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'user_id', mr.user_id,
              'read_at', DATE_FORMAT(mr.read_at, '%Y-%m-%dT%H:%i:00.000Z')
            )
          )
          FROM message_reads mr
          WHERE mr.message_id = m.id
        ) as read_by
        
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN chats c ON m.chat_id = c.id
      WHERE m.id = :messageId
      LIMIT 1;
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { messageId }
      }
    );

    if (messages.length === 0) {
      throw new Error(`No message found with id: ${messageId}`);
    }

    return messages[0];
  } catch (error) {
    console.error('Error fetching message:', error);
    throw error;
  }
};

export const getChatMessages = async ({ chatId, limit = 50, offset = 0 }) => {
  try {
    const messages = await sequelize.query(
      `
      SELECT m.*,
        DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at,
        DATE_FORMAT(m.updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
        
        -- Sender info
        JSON_OBJECT(
          'id', u.id,
          'name', COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name)),
          'email', u.email,
          'image', u.image
        ) as sender
        
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = :chatId
      ORDER BY m.created_at DESC
      LIMIT :limit OFFSET :offset;
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { chatId, limit, offset }
      }
    );

    return messages.reverse(); // Return oldest first
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }
};

export const markMessagesAsDelivered = async ({ chatId, userId }) => {
  try {
    await sequelize.query(
      `
      UPDATE messages m
      SET m.status = 'DELIVERED',
          m.updated_at = NOW()
      WHERE m.chat_id = :chatId
        AND m.sender_id != :userId
        AND m.status = 'SENT';
      `,
      {
        type: QueryTypes.UPDATE,
        replacements: { chatId, userId }
      }
    );

    return true;
  } catch (error) {
    console.error('Error marking messages as delivered:', error);
    throw error;
  }
};

export const markMessageAsSeen = async ({ messageId, userId }) => {
    try {
      // Check if already read
      const existingReads = await sequelize.query(
        `
        SELECT 1 FROM message_reads 
        WHERE message_id = :messageId AND user_id = :userId
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { messageId, userId }
        }
      );
  
      if (existingReads.length === 0) {
        // First, insert into message_reads
        await sequelize.query(
          `
          INSERT INTO message_reads (message_id, user_id, read_at)
          VALUES (:messageId, :userId, NOW());
          `,
          {
            type: QueryTypes.INSERT,
            replacements: { messageId, userId }
          }
        );
        
        // Then, update the message status
        await sequelize.query(
          `
          UPDATE messages 
          SET status = 'SEEN', updated_at = NOW()
          WHERE id = :messageId;
          `,
          {
            type: QueryTypes.UPDATE,
            replacements: { messageId }
          }
        );
      }
  
      return true;
    } catch (error) {
      console.error('Error marking message as seen:', error);
      throw error;
    }
  };

  export const createMessage = async ({ chatId, senderId, content, mediaUrl, mediaType = 'NONE' }) => {
    try {
      // Start a transaction
      const transaction = await sequelize.transaction();
      
      try {
        // Insert the message
        const [messageId] = await sequelize.query(
          `
          INSERT INTO messages (chat_id, sender_id, content, media_url, media_type, status, created_at, updated_at)
          VALUES (:chatId, :senderId, :content, :mediaUrl, :mediaType, 'SENT', NOW(), NOW());
          `,
          {
            type: QueryTypes.INSERT,
            replacements: { chatId, senderId, content, mediaUrl, mediaType },
            transaction
          }
        );
        
        // Update chat's last message
        await sequelize.query(
          `
          UPDATE chats 
          SET last_message_id = :messageId,
              last_message_at = NOW(),
              updated_at = NOW()
          WHERE id = :chatId;
          `,
          {
            type: QueryTypes.UPDATE,
            replacements: { messageId, chatId },
            transaction
          }
        );
        
        // Commit the transaction
        await transaction.commit();
        
        // Get the full message with sender info only
        const messages = await sequelize.query(
          `
          SELECT 
            m.*,
            DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at,
            DATE_FORMAT(m.updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
            
            -- Sender info
            JSON_OBJECT(
              'id', u.id,
              'name', COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name)),
              'email', u.email,
              'image', u.image
            ) as sender
            
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.id = :messageId
          LIMIT 1;
          `,
          {
            type: QueryTypes.SELECT,
            replacements: { messageId },
            plain: true
          }
        );
        
        // Parse JSON strings
        if (messages) {
          // Parse sender if it's a JSON string
          if (messages.sender && typeof messages.sender === 'string') {
            try {
              messages.sender = JSON.parse(messages.sender);
            } catch (e) {
              console.error('Error parsing sender JSON:', e);
            }
          }
        }
        
        return messages;
      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  };