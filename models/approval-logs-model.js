import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";
import { getEmployeeByUserId } from "../models/employees-model.js";

const ApprovalLogsModel = sequelize.define(
  "approval_logs",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    approvable_type: { type: DataTypes.STRING(255), allowNull: false },
    approvable_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    request_from: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    approval_from: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    authorizer_role: { type: DataTypes.STRING(250), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    status: { 
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Expired'), 
      allowNull: false, 
      defaultValue: 'Pending' 
    },
    expire_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    deleted_by: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    timestamps: false,
    tableName: "approval_logs",
    indexes: [
      {
        unique: true,
        fields: ['approvable_type', 'approvable_id', 'id']
      },
      {
        fields: ['request_from']
      },
      {
        fields: ['approval_from']
      }
    ]
  }
);

export default ApprovalLogsModel;

export const getUserRoles = async ({ userId }) => {
  try {

    const userRoles = await sequelize.query(
      `
      SELECT 
        r.id AS role_id,
        r.name AS role_name,
        r.guard_name,
        r.description
      FROM model_has_roles mhr
      INNER JOIN roles r ON r.id = mhr.role_id
      WHERE mhr.model_type = 'App\\\\Models\\\\User'
        AND mhr.model_id = :userId
      ORDER BY r.name ASC
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { userId },
      }
    );

    return userRoles;
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return [];
  }
};

export const getPendingApprovalLogsForUser = async ({ userId, limit = 20, offset = 0 }) => {
  try {
    const employee = await getEmployeeByUserId({ userId });
    if (!employee) {
      throw new Error(`No employee found for user ID: ${userId}`);
    }

    const userRoles = await getUserRoles({ userId });
    const roleNames = userRoles.map(role => role.role_name);

    const pendingLogs = await sequelize.query(
      `
      SELECT *
      FROM approval_logs
      WHERE status = 'Pending'
        AND (
          approval_from = :employeeId
          OR (
            approval_from IS NULL
            AND authorizer_role IN (:roleNames)
          )
        )
      ORDER BY
        CASE WHEN approval_from = :employeeId THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          employeeId: employee.id,
          roleNames: roleNames.length ? roleNames : ['__NO_ROLE__'],
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
      }
    );

    return pendingLogs;
  } catch (error) {
    console.error("Error fetching pending approval logs for user:", error);
    throw error;
  }
};

export const getPendingApprovalLogsCountForUser = async ({ userId }) => {
  try {
    const employee = await getEmployeeByUserId({ userId });
    if (!employee) {
      throw new Error(`No employee found for user ID: ${userId}`);
    }

    const userRoles = await getUserRoles({ userId });
    const roleNames = userRoles.map(role => role.role_name);

    const result = await sequelize.query(
      `
      SELECT COUNT(*) as total
      FROM approval_logs
      WHERE status = 'Pending'
        AND (
          approval_from = :employeeId
          OR (
            approval_from IS NULL
            AND authorizer_role IN (:roleNames)
          )
        )
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          employeeId: employee.id,
          roleNames: roleNames.length ? roleNames : ['__NO_ROLE__']
        },
      }
    );

    return result[0]?.total || 0;
  } catch (error) {
    console.error("Error counting pending approval logs for user:", error);
    throw error;
  }
};

export const getApprovedApprovalLogsForUser = async ({ userId, limit = 20, offset = 0 }) => {
  try {
    const employee = await getEmployeeByUserId({ userId });
    if (!employee) {
      throw new Error(`No employee found for user ID: ${userId}`);
    }

    const userRoles = await getUserRoles({ userId });
    const roleNames = userRoles.map(role => role.role_name);

    const approvalLogs = await sequelize.query(
      `
      SELECT *
      FROM approval_logs
      WHERE status = 'Approved'
        AND (
          approval_from = :employeeId
          OR (
            approval_from IS NULL
            AND authorizer_role IN (:roleNames)
          )
        )
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          employeeId: employee.id,
          roleNames: roleNames.length ? roleNames : ['__NO_ROLE__'],
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
      }
    );

    return approvalLogs;
  } catch (error) {
    console.error("Error fetching approved approval logs for user:", error);
    throw error;
  }
};

export const getApprovedApprovalLogsCountForUser = async ({ userId }) => {
  try {
    const employee = await getEmployeeByUserId({ userId });
    if (!employee) {
      throw new Error(`No employee found for user ID: ${userId}`);
    }

    const userRoles = await getUserRoles({ userId });
    const roleNames = userRoles.map(role => role.role_name);

    const result = await sequelize.query(
      `
      SELECT COUNT(*) as total
      FROM approval_logs
      WHERE status = 'Approved'
        AND (
          approval_from = :employeeId
          OR (
            approval_from IS NULL
            AND authorizer_role IN (:roleNames)
          )
        )
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          employeeId: employee.id,
          roleNames: roleNames.length ? roleNames : ['__NO_ROLE__']
        },
      }
    );

    return result[0]?.total || 0;
  } catch (error) {
    console.error("Error counting approved approval logs for user:", error);
    throw error;
  }
};

export const getRejectedApprovalLogsForUser = async ({ userId, limit = 20, offset = 0 }) => {
    try {
      const employee = await getEmployeeByUserId({ userId });
      if (!employee) {
        throw new Error(`No employee found for user ID: ${userId}`);
      }
  
      const userRoles = await getUserRoles({ userId });
      const roleNames = userRoles.map(role => role.role_name);
  
      const rejectedLogs = await sequelize.query(
        `
        SELECT *
        FROM approval_logs
        WHERE status = 'Rejected'
          AND (
            approval_from = :employeeId
            OR (
              approval_from IS NULL
              AND authorizer_role IN (:roleNames)
            )
          )
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            employeeId: employee.id,
            roleNames: roleNames.length ? roleNames : ['__NO_ROLE__'],
            limit: parseInt(limit),
            offset: parseInt(offset)
          },
        }
      );
  
      return rejectedLogs;
    } catch (error) {
      console.error("Error fetching rejected approval logs for user:", error);
      throw error;
    }
  };
  
  export const getRejectedApprovalLogsCountForUser = async ({ userId }) => {
    try {
      const employee = await getEmployeeByUserId({ userId });
      if (!employee) {
        throw new Error(`No employee found for user ID: ${userId}`);
      }
  
      const userRoles = await getUserRoles({ userId });
      const roleNames = userRoles.map(role => role.role_name);
  
      const result = await sequelize.query(
        `
        SELECT COUNT(*) as total
        FROM approval_logs
        WHERE status = 'Rejected'
          AND (
            approval_from = :employeeId
            OR (
              approval_from IS NULL
              AND authorizer_role IN (:roleNames)
            )
          )
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            employeeId: employee.id,
            roleNames: roleNames.length ? roleNames : ['__NO_ROLE__']
          },
        }
      );
  
      return result[0]?.total || 0;
    } catch (error) {
      console.error("Error counting rejected approval logs for user:", error);
      throw error;
    }
  };

  export const getApprovalLogsStatistics = async ({ userId }) => {
    try {
      const employee = await getEmployeeByUserId({ userId });
      if (!employee) {
        throw new Error(`No employee found for user ID: ${userId}`);
      }
  
      const userRoles = await getUserRoles({ userId });
      const roleNames = userRoles.map(role => role.role_name);
  
      const result = await sequelize.query(
        `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired
        FROM approval_logs
        WHERE (
          approval_from = :employeeId
          OR (
            approval_from IS NULL
            AND authorizer_role IN (:roleNames)
          )
        )
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            employeeId: employee.id,
            roleNames: roleNames.length ? roleNames : ['__NO_ROLE__']
          },
        }
      );
  
      if (result.length === 0) {
        return {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          expired: 0
        };
      }
  
      return {
        total: parseInt(result[0].total) || 0,
        pending: parseInt(result[0].pending) || 0,
        approved: parseInt(result[0].approved) || 0,
        rejected: parseInt(result[0].rejected) || 0,
        expired: parseInt(result[0].expired) || 0
      };
    } catch (error) {
      console.error("Error fetching approval logs statistics:", error);
      throw error;
    }
  };

  export const updateApprovalLogStatus = async ({ 
    logId, 
    status, 
    reason = null, 
    updatedBy,
    approvalFrom,
    authorizerRole 
  }) => {
    try {
      // First, check if the log exists
      const existingLog = await ApprovalLogsModel.findByPk(logId);
      if (!existingLog) {
        throw new Error(`Approval log with ID ${logId} not found`);
      }
  
      // Prepare update data
      const updateData = {
        status,
        updated_by: updatedBy,
        updated_at: new Date()
      };
  
      // Only update approval_from if it's provided (not undefined)
      if (approvalFrom !== undefined) {
        updateData.approval_from = approvalFrom;
      }
  
      // Only update authorizer_role if it's provided
      if (authorizerRole !== undefined) {
        updateData.authorizer_role = authorizerRole;
      }
  
      // Add reason for rejection
      if (status === 'Rejected' && reason) {
        updateData.reason = reason;
      }
  
      // Update the log
      const [affectedRows] = await ApprovalLogsModel.update(updateData, {
        where: { id: logId }
      });
  
      if (affectedRows === 0) {
        throw new Error(`Failed to update approval log with ID ${logId}`);
      }
  
      // Fetch the updated log with all fields
      const updatedLog = await sequelize.query(
        `
        SELECT *
        FROM approval_logs
        WHERE id = :logId
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { logId }
        }
      );
  
      if (updatedLog.length === 0) {
        throw new Error(`Approval log with ID ${logId} not found after update`);
      }
  
      return updatedLog[0];
    } catch (error) {
      console.error('Error updating approval log status:', error);
      throw error;
    }
  };

  export const getOneApprovalLogById = async ({ logId }) => {
    try {
      const logs = await sequelize.query(
        `
        SELECT *
        FROM approval_logs
        WHERE id = :logId
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { logId }
        }
      );
  
      if (logs.length === 0) {
        throw new Error(`No approval log found with ID: ${logId}`);
      }
  
      return logs[0];
    } catch (error) {
      console.error('Error fetching approval log by ID:', error);
      throw error;
    }
  };