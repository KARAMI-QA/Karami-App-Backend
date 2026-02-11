import { DataTypes, QueryTypes } from "sequelize";
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

export const getOneOvertimeLogsById = async ({ id }) => {
    try {
      const overtimeLogs = await sequelize.query(
        `
        SELECT *,
          DATE_FORMAT(start_date_time, '%Y-%m-%dT%H:%i:00.000Z') AS start_date_time,
          DATE_FORMAT(end_date_time, '%Y-%m-%dT%H:%i:00.000Z') AS end_date_time,
          DATE_FORMAT(authorize_date, '%Y-%m-%dT%H:%i:00.000Z') AS authorize_date,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
        FROM overtime_logs
        WHERE id = :id
          AND deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { id }
        }
      );
  
      if (overtimeLogs.length === 0) {
        throw new Error(`No overtime log found with id: ${id}`);
      }
  
      return overtimeLogs[0];
    } catch (error) {
      console.error('Error fetching overtime log by id:', error);
      throw error;
    }
  };

  export const updateOvertimeLogStatus = async ({ id, status, authorizer_id, authorizer_role, authorize_date }) => {
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
  
      const [affectedRows] = await OvertimeLogsModel.update(updateData, {
        where: { id }
      });
  
      if (affectedRows === 0) {
        throw new Error(`No overtime log found with id: ${id}`);
      }
  
      // Return updated overtime log
      return await getOneOvertimeLogsById({ id });
    } catch (error) {
      console.error('Error updating overtime log status:', error);
      throw error;
    }
  };