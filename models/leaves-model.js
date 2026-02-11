import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const LeavesModel = sequelize.define(
  "leaves",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ref_number: { type: DataTypes.STRING(250), allowNull: false },
    company_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    employee_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    attachment: { type: DataTypes.STRING(250), allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Expired'), 
      allowNull: false, 
      defaultValue: 'Pending' 
    },
    type: { 
      type: DataTypes.ENUM('Annual Holiday', 'Casual Holiday', 'Sick Leave', 'Unpaid Leave', 'Maternity Leave'), 
      allowNull: false, 
      defaultValue: 'Annual Holiday' 
    },
    authorize_date: { type: DataTypes.DATEONLY, allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    authorizer_id: { type: DataTypes.BIGINT, allowNull: true },
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
    tableName: "leaves",
    indexes: [
      {
        fields: ['company_id']
      },
      {
        fields: ['employee_id']
      },
      {
        fields: ['status_by']
      }
    ]
  }
);

export default LeavesModel;

export const getOneLeavesById = async ({ id }) => {
    try {
      const leaves = await sequelize.query(
        `
        SELECT *,
          DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:00.000Z') AS start_date,
          DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:00.000Z') AS end_date,
          DATE_FORMAT(authorize_date, '%Y-%m-%dT%H:%i:00.000Z') AS authorize_date,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
        FROM leaves
        WHERE id = :id
          AND deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { id }
        }
      );
  
      if (leaves.length === 0) {
        throw new Error(`No leave found with id: ${id}`);
      }
  
      return leaves[0];
    } catch (error) {
      console.error('Error fetching leave by id:', error);
      throw error;
    }
  };

  export const updateLeaveStatus = async ({ id, status, authorizer_id, authorizer_role, authorize_date }) => {
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
  
      const [affectedRows] = await LeavesModel.update(updateData, {
        where: { id }
      });
  
      if (affectedRows === 0) {
        throw new Error(`No leave found with id: ${id}`);
      }
  
      // Return updated leave
      return await getOneLeavesById({ id });
    } catch (error) {
      console.error('Error updating leave status:', error);
      throw error;
    }
  };