import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const OvertimeLogsModel = sequelize.define(
  "overtime_logs",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ref_number: { type: DataTypes.STRING(250), allowNull: false },
    company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    pay_code_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    start_date_time: { type: DataTypes.DATE, allowNull: false },
    end_date_time: { type: DataTypes.DATE, allowNull: false },
    no_of_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    attachment: { type: DataTypes.STRING(255), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    authorize_date: { type: DataTypes.DATEONLY, allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_id: { type: DataTypes.BIGINT, allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'To Be Processed', 'Expired'), 
      allowNull: false, 
      defaultValue: 'Pending' 
    },
    got_day_off: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    created_for: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    updated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    timestamps: false,
    tableName: "overtime_logs",
    indexes: [
      {
        fields: ['company_id']
      },
      {
        fields: ['employee_id']
      },
      {
        fields: ['pay_code_id']
      },
      {
        fields: ['status_by']
      }
    ]
  }
);

export default OvertimeLogsModel;