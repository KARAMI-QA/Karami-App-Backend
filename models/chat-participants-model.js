import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const ChatParticipantsModel = sequelize.define(
  "chat_participants",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    chat_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    role: { 
      type: DataTypes.ENUM('MEMBER', 'ADMIN', 'OWNER'), 
      allowNull: false, 
      defaultValue: 'MEMBER' 
    },
    joined_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "chat_participants",
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['user_id'] },
      { fields: ['chat_id', 'user_id'], unique: true }
    ]
  }
);

export default ChatParticipantsModel;