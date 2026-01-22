import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const MessageReadsModel = sequelize.define(
  "message_reads",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    message_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    read_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "message_reads",
    indexes: [
      { fields: ['message_id'] },
      { fields: ['user_id'] },
      { fields: ['message_id', 'user_id'], unique: true }
    ]
  }
);

export default MessageReadsModel;