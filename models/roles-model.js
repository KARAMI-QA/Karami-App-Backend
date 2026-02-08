import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const RolesModel = sequelize.define(
  "roles",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    guard_name: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'web' },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    timestamps: false,
    tableName: "roles",
    indexes: [
      {
        fields: ['name']
      }
    ]
  }
);

export default RolesModel;