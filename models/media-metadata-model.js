import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const MediaMetadataModel = sequelize.define(
  "media_metadata",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    message_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_size: { type: DataTypes.BIGINT, allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    bucket_path: { type: DataTypes.TEXT, allowNull: false },
    thumbnail_url: { type: DataTypes.TEXT, allowNull: true },
    duration: { type: DataTypes.INTEGER, allowNull: true }, // For video/audio in seconds
    width: { type: DataTypes.INTEGER, allowNull: true }, // For images/videos
    height: { type: DataTypes.INTEGER, allowNull: true }, // For images/videos
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "media_metadata",
    indexes: [
      { fields: ['message_id'] }
    ]
  }
);

export default MediaMetadataModel;