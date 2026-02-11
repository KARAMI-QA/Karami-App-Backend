import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const LoansModel = sequelize.define(
  "loans",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ref_number: { type: DataTypes.STRING(250), allowNull: false },
    company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    loan_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
    loan_given_date: { type: DataTypes.DATEONLY, allowNull: true },
    refund_cycle: { type: DataTypes.STRING(250), allowNull: true },
    refund_amount_per_cycle: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    pdf: { type: DataTypes.STRING(250), allowNull: true },
    pdf_re_upload: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    left_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
    balance_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
    paid_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
    authorize_date: { type: DataTypes.DATEONLY, allowNull: true },
    authorize_receipt: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_id: { type: DataTypes.BIGINT, allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Approved For Payroll', 'To Be Processed', 'Expired'), 
      allowNull: false, 
      defaultValue: 'Pending' 
    },
    is_cleared: { 
      type: DataTypes.ENUM('Yes', 'No'), 
      allowNull: false, 
      defaultValue: 'No' 
    },
    wps_status: { 
      type: DataTypes.ENUM('Pending', 'WPS Generated'), 
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
    tableName: "loans",
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

export default LoansModel;

export const getOneLoansById = async ({ id }) => {
    try {
      const loans = await sequelize.query(
        `
        SELECT *,
          DATE_FORMAT(loan_given_date, '%Y-%m-%dT%H:%i:00.000Z') AS loan_given_date,
          DATE_FORMAT(authorize_date, '%Y-%m-%dT%H:%i:00.000Z') AS authorize_date,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
        FROM loans
        WHERE id = :id
          AND deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { id }
        }
      );
  
      if (loans.length === 0) {
        throw new Error(`No loan found with id: ${id}`);
      }
  
      return loans[0];
    } catch (error) {
      console.error('Error fetching loan by id:', error);
      throw error;
    }
  };

  export const updateLoanStatus = async ({ id, status, authorizer_id, authorizer_role, authorize_date }) => {
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
  
      const [affectedRows] = await LoansModel.update(updateData, {
        where: { id }
      });
  
      if (affectedRows === 0) {
        throw new Error(`No loan found with id: ${id}`);
      }
  
      // Return updated loan
      return await getOneLoansById({ id });
    } catch (error) {
      console.error('Error updating loan status:', error);
      throw error;
    }
  };