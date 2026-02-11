import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const AdvanceSalariesModel = sequelize.define(
  "advance_salaries",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ref_number: { type: DataTypes.STRING(250), allowNull: false },
    company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    amount: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
    issue_date: { type: DataTypes.DATEONLY, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    authorize_date: { type: DataTypes.DATEONLY, allowNull: true },
    authorize_receipt: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_id: { type: DataTypes.BIGINT, allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'To Be Processed', 'Expired'), 
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
    status_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
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
    tableName: "advance_salaries",
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

export default AdvanceSalariesModel;

export const getOneAdvanceSalaryById = async ({ id }) => {
  try {
    const advanceSalaries = await sequelize.query(
      `
      SELECT *,
        DATE_FORMAT(issue_date, '%Y-%m-%dT%H:%i:00.000Z') AS issue_date,
        DATE_FORMAT(authorize_date, '%Y-%m-%dT%H:%i:00.000Z') AS authorize_date,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
        DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
      FROM advance_salaries
      WHERE id = :id
        AND deleted_at IS NULL
      LIMIT 1;
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { id }
      }
    );

    if (advanceSalaries.length === 0) {
      throw new Error(`No advance salary found with id: ${id}`);
    }

    return advanceSalaries[0];
  } catch (error) {
    console.error('Error fetching advance salary by id:', error);
    throw error;
  }
};

export const updateAdvanceSalaryStatus = async ({ id, status, authorizer_id, authorizer_role, authorize_date }) => {
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
  
      const [affectedRows] = await AdvanceSalariesModel.update(updateData, {
        where: { id }
      });
  
      if (affectedRows === 0) {
        throw new Error(`No advance salary found with id: ${id}`);
      }
  
      // Return updated advance salary
      return await getOneAdvanceSalaryById({ id });
    } catch (error) {
      console.error('Error updating advance salary status:', error);
      throw error;
    }
  };