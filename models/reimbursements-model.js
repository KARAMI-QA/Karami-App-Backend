import { DataTypes, QueryTypes } from "sequelize";
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

export const getOneReimbursementsById = async ({ id }) => {
  try {
    const reimbursements = await sequelize.query(
      `
      SELECT *,
        DATE_FORMAT(cleared_date, '%Y-%m-%dT%H:%i:00.000Z') AS cleared_date,
        DATE_FORMAT(authorize_date, '%Y-%m-%dT%H:%i:00.000Z') AS authorize_date,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
        DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
      FROM reimbursements
      WHERE id = :id
        AND deleted_at IS NULL
      LIMIT 1;
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { id }
      }
    );

    if (reimbursements.length === 0) {
      throw new Error(`No reimbursement found with id: ${id}`);
    }

    return reimbursements[0];
  } catch (error) {
    console.error('Error fetching reimbursement by id:', error);
    throw error;
  }
};

export const updateReimbursementStatus = async ({ id, status, authorizer_id, authorizer_role, authorize_date }) => {
  try {
    const updateData = {
      status,
      authorizer_id,
      authorizer_role,
      authorize_date,
      updated_at: new Date()
    };

    // Remove undefined/null values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    const [affectedRows] = await ReimbursementsModel.update(updateData, {
      where: { id }
    });

    if (affectedRows === 0) {
      throw new Error(`No reimbursement found with id: ${id}`);
    }

    // Return updated reimbursement
    return await getOneReimbursementsById({ id });
  } catch (error) {
    console.error('Error updating reimbursement status:', error);
    throw error;
  }
};