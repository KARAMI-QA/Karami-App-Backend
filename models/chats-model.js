import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const ChatsModel = sequelize.define(
  "chats",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
    type: { 
      type: DataTypes.ENUM('DIRECT', 'GROUP'), 
      allowNull: false, 
      defaultValue: 'DIRECT' 
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_message_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    last_message_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "chats",
  }
);

export default ChatsModel;

export const getChatById = async ({ chatId, currentUserId = null }) => {
    try {
      const chats = await sequelize.query(
        `
        SELECT c.*,
          DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at,
          DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(c.last_message_at, '%Y-%m-%dT%H:%i:00.000Z') AS last_message_at,
          
          -- Get participants info
          (
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'id', u.id,
                'name', COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name)),
                'email', u.email,
                'image', u.image,
                'is_online', false
              )
            )
            FROM chat_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.chat_id = c.id AND cp.deleted_at IS NULL
          ) as participants,
          
          -- Get other participant info for direct chats (FIXED)
          CASE 
            WHEN c.type = 'DIRECT' THEN (
              SELECT JSON_OBJECT(
                'id', u2.id,
                'name', COALESCE(u2.name, CONCAT(u2.first_name, ' ', u2.last_name)),
                'email', u2.email,
                'image', u2.image,
                'is_online', false
              )
              FROM chat_participants cp2
              JOIN users u2 ON cp2.user_id = u2.id
              WHERE cp2.chat_id = c.id 
                AND cp2.user_id != :currentUserId  -- CHANGED: Use currentUserId instead of created_by
                AND cp2.deleted_at IS NULL
              LIMIT 1
            )
            ELSE NULL
          END as other_participant,
          
          -- Get last message details
          (
            SELECT JSON_OBJECT(
              'id', m.id,
              'content', m.content,
              'media_url', m.media_url,
              'media_type', m.media_type,
              'sender_id', m.sender_id,
              'sender_name', COALESCE(u3.name, CONCAT(u3.first_name, ' ', u3.last_name)),
              'created_at', DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:00.000Z')
            )
            FROM messages m
            LEFT JOIN users u3 ON m.sender_id = u3.id
            WHERE m.chat_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as last_message
          
        FROM chats c
        WHERE c.id = :chatId 
          AND c.deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { chatId, currentUserId }
        }
      );
  
      if (chats.length === 0) {
        throw new Error(`No chat found with id: ${chatId}`);
      }
  
      return chats[0];
    } catch (error) {
      console.error('Error fetching chat:', error);
      throw error;
    }
  };

  export const getUserChats = async ({ userId }) => {
    try {
      const chats = await sequelize.query(
        `
        SELECT DISTINCT c.*,
          DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at,
          DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(c.last_message_at, '%Y-%m-%dT%H:%i:00.000Z') AS last_message_at,
          
          -- Get other participant info for direct chats (FIXED)
          CASE 
            WHEN c.type = 'DIRECT' THEN (
              SELECT JSON_OBJECT(
                'id', u.id,
                'name', COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name)),
                'email', u.email,
                'image', u.image,
                'is_online', false
              )
              FROM chat_participants cp2
              JOIN users u ON cp2.user_id = u.id
              WHERE cp2.chat_id = c.id 
                AND cp2.user_id != :userId  -- This is already correct
                AND cp2.deleted_at IS NULL
              LIMIT 1
            )
            ELSE NULL
          END as other_participant,
          
          -- Get last message details
          (
            SELECT JSON_OBJECT(
              'id', m.id,
              'content', m.content,
              'media_url', m.media_url,
              'media_type', m.media_type,
              'sender_id', m.sender_id,
              'sender_name', COALESCE(u2.name, CONCAT(u2.first_name, ' ', u2.last_name)),
              'created_at', DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:00.000Z')
            )
            FROM messages m
            LEFT JOIN users u2 ON m.sender_id = u2.id
            WHERE m.chat_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as last_message,
          
          -- Get unread count
          (
            SELECT COUNT(*)
            FROM messages m2
            WHERE m2.chat_id = c.id 
              AND m2.status = 'SENT'
              AND m2.sender_id != :userId
              AND NOT EXISTS (
                SELECT 1 FROM message_reads mr 
                WHERE mr.message_id = m2.id 
                  AND mr.user_id = :userId
              )
          ) as unread_count
          
        FROM chats c
        INNER JOIN chat_participants cp ON c.id = cp.chat_id
        WHERE cp.user_id = :userId
          AND c.deleted_at IS NULL
          AND cp.deleted_at IS NULL
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        LIMIT 50;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { userId }
        }
      );
  
      return chats;
    } catch (error) {
      console.error('Error fetching user chats:', error);
      throw error;
    }
  };

export const findOrCreateDirectChat = async ({ userId1, userId2 }) => {
    try {
      // Check if direct chat already exists between these two users
      const existingChats = await sequelize.query(
        `
        SELECT c.id
        FROM chats c
        INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
        INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
        WHERE c.type = 'DIRECT'
          AND c.deleted_at IS NULL
          AND cp1.user_id = :userId1
          AND cp2.user_id = :userId2
          AND cp1.deleted_at IS NULL
          AND cp2.deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { userId1, userId2 }
        }
      );
  
      if (existingChats.length > 0) {
        return await getChatById({ chatId: existingChats[0].id, currentUserId: userId1 });
      }
  
      // Create new direct chat
      const [chatId] = await sequelize.query(
        `
        INSERT INTO chats (type, created_by, created_at, updated_at)
        VALUES ('DIRECT', :userId1, NOW(), NOW());
        `,
        {
          type: QueryTypes.INSERT,
          replacements: { userId1 }
        }
      );
  
      // Add participants
      await sequelize.query(
        `
        INSERT INTO chat_participants (chat_id, user_id, created_at, updated_at)
        VALUES (:chatId, :userId1, NOW(), NOW()),
               (:chatId, :userId2, NOW(), NOW());
        `,
        {
          type: QueryTypes.INSERT,
          replacements: { chatId, userId1, userId2 }
        }
      );
  
      return await getChatById({ chatId, currentUserId: userId1 });
    } catch (error) {
      console.error('Error creating/finding direct chat:', error);
      throw error;
    }
  };