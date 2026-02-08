import { DataTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const ReimbursementsModel = sequelize.define(
  "reimbursements",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ref_number: { type: DataTypes.STRING(250), allowNull: false },
    company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    amount: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
    type_id: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    sub_type_id: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    is_cleared: { 
      type: DataTypes.ENUM('Yes', 'No'), 
      allowNull: false, 
      defaultValue: 'No' 
    },
    cleared_date: { type: DataTypes.DATEONLY, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    authorize_date: { type: DataTypes.DATEONLY, allowNull: true },
    authorize_receipt: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_id: { type: DataTypes.BIGINT, allowNull: true },
    receipt: { type: DataTypes.STRING(250), allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Approved For Payroll', 'To Be Processed', 'Expired'), 
      allowNull: false, 
      defaultValue: 'Pending' 
    },
    status_by: { type: DataTypes.BIGINT, allowNull: true },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    created_for: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    updated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    timestamps: false,
    tableName: "reimbursements",
    indexes: [
      {
        fields: ['company_id']
      },
      {
        fields: ['employee_id']
      }
    ]
  }
);

export default ReimbursementsModel;