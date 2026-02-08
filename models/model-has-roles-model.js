import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const ModelHasRolesModel = sequelize.define(
  "model_has_roles",
  {
    role_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, allowNull: false },
    model_type: { type: DataTypes.STRING(255), primaryKey: true, allowNull: false },
    model_id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, allowNull: false },
  },
  {
    timestamps: false,
    tableName: "model_has_roles",
  }
);

export default ModelHasRolesModel;