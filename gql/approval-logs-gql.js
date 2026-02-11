import gql from "graphql-tag";
import { validateUserToken } from "./users-gql.js"; 
import { 
  getPendingApprovalLogsForUser, 
  getUserRoles, 
  getApprovedApprovalLogsForUser,
  getPendingApprovalLogsCountForUser,
  getApprovedApprovalLogsCountForUser,
  getRejectedApprovalLogsForUser,
  getRejectedApprovalLogsCountForUser,
  getApprovalLogsStatistics,
  getOneApprovalLogById,
  updateApprovalLogStatus
} from "../models/approval-logs-model.js";

import {getEmployeeByUserId} from "../models/employees-model.js"

import { 
    getOneAdvanceSalaryById,
    updateAdvanceSalaryStatus  
  } from "../models/advance-salaries-model.js";
  
  import { 
    getOneLeavesById,
    updateLeaveStatus  
  } from "../models/leaves-model.js";
  
  import { 
    getOneLoansById,
    updateLoanStatus 
  } from "../models/loans-model.js";
  
  import { 
    getOneManualLogsById,
    updateManualLogStatus  
  } from "../models/manual-logs-model.js";
  
  import { 
    getOneOvertimeLogsById,
    updateOvertimeLogStatus 
  } from "../models/overtime-logs-model.js";
  
  import { 
    getOneReimbursementsById,
    updateReimbursementStatus  
  } from "../models/reimbursements-model.js";



const typeDef = gql`
  type ApprovalLog {
    id: ID!
    approvable_type: String!
    approvable_id: ID!
    request_from: ID!
    approval_from: ID
    authorizer_role: String
    reason: String
    status: String!
    expire_at: String
    created_by: ID
    updated_by: ID
    deleted_by: ID
    created_at: String
    updated_at: String
    deleted_at: String
    approvable_data: ApprovableData
  }

  union ApprovableData = ReimbursementData | OverTimeLogData | LoanData | LeaveData | ManualLogData | AdvanceSalaryData | UnknownData

  type ReimbursementData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    amount: Float
    type_id: ID!
    sub_type_id: ID!
    is_cleared: String!
    cleared_date: String
    remarks: String
    authorize_date: String
    authorize_receipt: String
    authorizer_role: String
    authorizer_id: ID
    receipt: String
    status: String!
    status_by: ID
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    deleted_at: String
    created_at: String
    updated_at: String
  }

  type OverTimeLogData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    pay_code_id: ID!
    start_date_time: String!
    end_date_time: String!
    no_of_hours: Float
    attachment: String
    reason: String
    authorize_date: String
    authorizer_role: String
    authorizer_id: ID
    status: String!
    got_day_off: Boolean!
    status_by: ID
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    created_at: String
    updated_at: String
    deleted_at: String
  }

  type LoanData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    loan_amount: Float
    loan_given_date: String
    refund_cycle: String
    refund_amount_per_cycle: Float
    remarks: String
    pdf: String
    pdf_re_upload: Boolean!
    left_amount: Float!
    balance_amount: Float!
    paid_amount: Float!
    authorize_date: String
    authorize_receipt: String
    authorizer_role: String
    authorizer_id: ID
    status: String!
    is_cleared: String!
    wps_status: String!
    status_by: ID
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    deleted_at: String
    created_at: String
    updated_at: String
  }

  type LeaveData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    start_date: String!
    end_date: String!
    reason: String
    attachment: String
    status: String!
    leave_type: String!
    authorize_date: String
    authorizer_role: String
    authorizer_id: ID
    status_by: ID
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    created_at: String
    updated_at: String
    deleted_at: String
  }

  type ManualLogData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    punch_time: String
    punch_state: String!
    attachment: String
    reason: String
    authorize_date: String
    authorizer_role: String
    authorizer_id: ID
    status: String!
    status_by: ID
    from_direct: Boolean!
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    created_at: String
    updated_at: String
    deleted_at: String
  }

  type AdvanceSalaryData {
    data_type: String!
    id: ID!
    ref_number: String!
    company_id: ID!
    employee_id: ID!
    amount: Float
    issue_date: String
    remarks: String
    authorize_date: String
    authorize_receipt: String
    authorizer_role: String
    authorizer_id: ID
    status: String!
    is_cleared: String!
    wps_status: String!
    status_by: ID
    created_by: ID
    created_for: ID
    updated_by: ID
    deleted_by: ID
    deleted_at: String
    created_at: String
    updated_at: String
  }

  type UnknownData {
    data_type: String!
    id: ID!
    message: String!
  }

  type PaginatedApprovalLogs {
    logs: [ApprovalLog]!
    hasMore: Boolean!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type ApprovalLogsStatistics {
    total: Int!
    pending: Int!
    approved: Int!
    rejected: Int!
    expired: Int!
  }

  type ApprovalStatusResult {
    success: Boolean!
    message: String!
    log: ApprovalLog
  }

  type Query {
    approvalGetPendingLogs(
      userToken: String!
      limit: Int = 20
      page: Int = 1
    ): PaginatedApprovalLogs!
    
    approvalGetApprovedLogs(
      userToken: String!
      limit: Int = 20
      page: Int = 1
    ): PaginatedApprovalLogs!
    
    approvalGetRejectedLogs(
      userToken: String!
      limit: Int = 20
      page: Int = 1
    ): PaginatedApprovalLogs!
    
    approvalGetLogsStatistics(
      userToken: String!
    ): ApprovalLogsStatistics!
  }

  type Mutation {
    approveLog(
      userToken: String!
      logId: ID!
    ): ApprovalStatusResult!
    
    rejectLog(
      userToken: String!
      logId: ID!
      reason: String!
    ): ApprovalStatusResult!
  }
`;

const checkLogPermission = async (userId, logId) => {
    try {
      const employee = await getEmployeeByUserId({ userId });
      if (!employee) {
        throw new Error("No employee found for user");
      }
  
      const userRoles = await getUserRoles({ userId });
      const roleNames = userRoles.map(role => role.role_name);
  
      // Check if user has permission for this specific log
      const log = await getOneApprovalLogById({ logId });
      if (!log) {
        throw new Error("Approval log not found");
      }
  
      // Check if user can approve this log
      const canApprove = 
        (log.approval_from && parseInt(log.approval_from) === parseInt(employee.id)) || 
        (log.approval_from === null && roleNames.includes(log.authorizer_role));
  
      if (!canApprove) {
        throw new Error("You don't have permission to approve/reject this request");
      }
  
      return {
        employee,
        userRoles,
        roleNames,
        log
      };
    } catch (error) {
      throw new Error(`Permission check failed: ${error.message}`);
    }
  };

// Helper function to fetch approvable data based on type
const fetchApprovableData = async (approvableType, approvableId) => {
    try {
      switch (approvableType) {
        case 'App\\Models\\Reimbursement':
          const reimbursement = await getOneReimbursementsById({ id: approvableId });
          return {
            data_type: 'ReimbursementData',
            ...reimbursement
          };
        
        case 'App\\Models\\OverTimeLog':
          const overtimeLog = await getOneOvertimeLogsById({ id: approvableId });
          return {
            data_type: 'OverTimeLogData',
            ...overtimeLog
          };
        
        case 'App\\Models\\Loan':
          const loan = await getOneLoansById({ id: approvableId });
          return {
            data_type: 'LoanData',
            ...loan
          };
        
        case 'App\\Models\\Leave':
          const leave = await getOneLeavesById({ id: approvableId });
          return {
            data_type: 'LeaveData',
            leave_type: leave.type,
            ...leave,
            type: undefined
          };
        
        case 'App\\Models\\ManualLog':
          const manualLog = await getOneManualLogsById({ id: approvableId });
          return {
            data_type: 'ManualLogData',
            ...manualLog
          };
        
        case 'App\\Models\\AdvanceSalary':
          const advanceSalary = await getOneAdvanceSalaryById({ id: approvableId });
          return {
            data_type: 'AdvanceSalaryData',
            ...advanceSalary
          };
        
        default:
          return {
            data_type: 'UnknownData',
            id: approvableId,
            message: `Unknown approvable type: ${approvableType}`
          };
      }
    } catch (error) {
      console.error(`Error fetching approvable data for ${approvableType} ID ${approvableId}:`, error);
      return {
        data_type: 'UnknownData',
        id: approvableId,
        message: `Error fetching data: ${error.message}`
      };
    }
  };
  
  const updateRelatedModelStatus = async (approvableType, approvableId, status, approverId, authorizerRole) => {
    try {
      const updateData = {
        status: status,
        authorizer_id: approverId,
        authorizer_role: authorizerRole,
        authorize_date: new Date().toISOString().split('T')[0] 
      };
  
    //   console.log(`Updating ${approvableType} ID ${approvableId} to ${updateData.status}`, updateData);
  
      switch (approvableType) {
        case 'App\\Models\\Reimbursement':
          await updateReimbursementStatus({ id: approvableId, ...updateData });
          break;
        
        case 'App\\Models\\OverTimeLog':
          await updateOvertimeLogStatus({ id: approvableId, ...updateData });
          break;
        
        case 'App\\Models\\Loan':
          await updateLoanStatus({ id: approvableId, ...updateData });
          break;
        
        case 'App\\Models\\Leave':
          await updateLeaveStatus({ id: approvableId, ...updateData });
          break;
        
        case 'App\\Models\\ManualLog':
          await updateManualLogStatus({ id: approvableId, ...updateData });
          break;
        
        case 'App\\Models\\AdvanceSalary':
          await updateAdvanceSalaryStatus({ id: approvableId, ...updateData });
          break;
        
        default:
          console.warn(`Unknown approvable type for status update: ${approvableType}`);
          throw new Error(`Cannot update status for unknown type: ${approvableType}`);
      }
  
      console.log(`Successfully updated ${approvableType} ID ${approvableId} to ${updateData.status}`);
    } catch (error) {
      console.error(`Error updating related model status for ${approvableType} ID ${approvableId}:`, error);
      throw error;
    }
  };
  
  
  // Helper function to process logs and fetch approvable data
  const processLogsWithApprovableData = async (logs) => {
    const formattedLogs = formatLogDates(logs);
    
    // Fetch approvable data for each log
    const logsWithData = await Promise.all(
      formattedLogs.map(async (log) => {
        try {
          const approvableData = await fetchApprovableData(log.approvable_type, log.approvable_id);
          return {
            ...log,
            approvable_data: approvableData
          };
        } catch (error) {
          console.error(`Error processing log ${log.id}:`, error);
          return {
            ...log,
            approvable_data: {
              data_type: 'UnknownData',
              id: log.approvable_id,
              message: `Error: ${error.message}`
            }
          };
        }
      })
    );
    
    return logsWithData;
  };
  

  const checkApprovalPermission = async (userId, logId) => {
    try {
      const userRoles = await getUserRoles({ userId });
      const userRoleNames = userRoles.map(role => role.role_name);


      
      // Check if user has any role that can approve
      if (userRoleNames.length === 0) {
        throw new Error("PermissionError: You don't have permission to perform this action");
      }
      
      return {
        userRoles: userRoleNames,
        primaryRole: userRoleNames[0] // Use the first role as primary
      };
    } catch (error) {
      throw new Error(`Permission check failed: ${error.message}`);
    }
  };

const formatLogDates = (logs) => {
  return logs.map(log => ({
    ...log,
    created_at: log.created_at ? 
      new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) : 
      null,
    updated_at: log.updated_at ? 
      new Date(log.updated_at).toISOString().replace('T', ' ').substring(0, 19) : 
      null,
    expire_at: log.expire_at ? 
      new Date(log.expire_at).toISOString().replace('T', ' ').substring(0, 19) : 
      null,
    deleted_at: log.deleted_at ? 
      new Date(log.deleted_at).toISOString().replace('T', ' ').substring(0, 19) : 
      null,
  }));
};


 

const approvalGetPendingLogs = async (parent, args) => {
  const { userToken, limit, page } = args;
  
  const tokenData =  validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (validatedPage - 1) * validatedLimit;

  try {
    const pendingLogs = await getPendingApprovalLogsForUser({ 
      userId: tokenData.userId,
      limit: validatedLimit,
      offset 
    });
    
    const totalCount = await getPendingApprovalLogsCountForUser({ 
      userId: tokenData.userId 
    });
    
    const logsWithData = await processLogsWithApprovableData(pendingLogs);
    
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasMore = validatedPage < totalPages;
    
    return {
      logs: logsWithData,
      hasMore,
      totalCount,
      currentPage: validatedPage,
      totalPages
    };
  } catch (error) {
    console.error('Error fetching pending approval logs:', error);
    throw new Error(`Failed to fetch pending approval logs: ${error.message}`);
  }
};

const approvalGetApprovedLogs = async (parent, args) => {
  const { userToken, limit, page } = args;
  
  const tokenData =  validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (validatedPage - 1) * validatedLimit;

  try {
    const approvedLogs = await getApprovedApprovalLogsForUser({ 
      userId: tokenData.userId,
      limit: validatedLimit,
      offset 
    });
    
    const totalCount = await getApprovedApprovalLogsCountForUser({ 
      userId: tokenData.userId 
    });
    
    const logsWithData = await processLogsWithApprovableData(approvedLogs);
    
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasMore = validatedPage < totalPages;
    
    return {
      logs: logsWithData,
      hasMore,
      totalCount,
      currentPage: validatedPage,
      totalPages
    };
  } catch (error) {
    console.error('Error fetching approved approval logs:', error);
    throw new Error(`Failed to fetch approved approval logs: ${error.message}`);
  }
};

const approvalGetRejectedLogs = async (parent, args) => {
  const { userToken, limit, page } = args;
  
  const tokenData =  validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (validatedPage - 1) * validatedLimit;

  try {
    const rejectedLogs = await getRejectedApprovalLogsForUser({ 
      userId: tokenData.userId,
      limit: validatedLimit,
      offset 
    });
    
    const totalCount = await getRejectedApprovalLogsCountForUser({ 
      userId: tokenData.userId 
    });
    
    const logsWithData = await processLogsWithApprovableData(rejectedLogs);
    
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasMore = validatedPage < totalPages;
    
    return {
      logs: logsWithData,
      hasMore,
      totalCount,
      currentPage: validatedPage,
      totalPages
    };
  } catch (error) {
    console.error('Error fetching rejected approval logs:', error);
    throw new Error(`Failed to fetch rejected approval logs: ${error.message}`);
  }
};

// New resolver for statistics
const approvalGetLogsStatistics = async (parent, args) => {
  const { userToken } = args;
  
  const tokenData =  validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  try {
    const statistics = await getApprovalLogsStatistics({ userId: tokenData.userId });
    return statistics;
  } catch (error) {
    console.error('Error fetching approval logs statistics:', error);
    throw new Error(`Failed to fetch approval logs statistics: ${error.message}`);
  }
};

// Resolver for union type
const ApprovableData = {
  __resolveType(obj, context, info) {
    return obj.data_type;
  }
};

const approveLog = async (parent, args) => {
    const { userToken, logId } = args;
    
    try {
      // Validate user token
      const tokenData =  validateUserToken(userToken);
      if (!tokenData) {
        throw new Error("AuthError: Invalid user token");
      }
  
      // Check permission and get user/employee info
      const { employee, userRoles, roleNames, log } = await checkLogPermission(tokenData.userId, logId);
  
      // Check if log is already processed
      if (log.status !== 'Pending') {
        throw new Error(`This request is already ${log.status.toLowerCase()}`);
      }
  
      // Determine approval_from and authorizer_role
      let approvalFrom = employee.id;
      let authorizerRole = null;
  
      // If employee.id is 0 or null, use role instead
      if (!employee.id || employee.id === 0) {
        approvalFrom = null;
        authorizerRole = roleNames[0] || 'DefaultRole';
      } else {
        // Use the first role for authorizer_role
        authorizerRole = roleNames[0] || null;
      }
  
      // Update approval log status
      const updatedLog = await updateApprovalLogStatus({
        logId,
        status: 'Approved',
        updatedBy: tokenData.userId,
        approvalFrom,
        authorizerRole
      });
  
      // Update the related model (reimbursement, leave, etc.)
      await updateRelatedModelStatus(
        log.approvable_type,
        log.approvable_id,
        'Approved',  // Pass the actual status string
        employee.id,
        authorizerRole
      );
  
      // Format dates for response
      const formattedLog = formatLogDates([updatedLog])[0];
  
      // Fetch approvable data
      const approvableData = await fetchApprovableData(log.approvable_type, log.approvable_id);
  
      return {
        success: true,
        message: "Request approved successfully",
        log: {
          ...formattedLog,
          approvable_data: approvableData
        }
      };
  
    } catch (error) {
      console.error('Error approving log:', error);
      return {
        success: false,
        message: error.message || "Failed to approve request",
        log: null
      };
    }
  };
  
  // Reject log mutation resolver
  const rejectLog = async (parent, args) => {
    const { userToken, logId, reason } = args;
    
    try {
      // Validate user token
      const tokenData =  validateUserToken(userToken);
      if (!tokenData) {
        throw new Error("AuthError: Invalid user token");
      }
  
      // Validate reason
      if (!reason || reason.trim().length === 0) {
        throw new Error("Reason is required for rejection");
      }
  
      // Check permission and get user/employee info
      const { employee, userRoles, roleNames, log } = await checkLogPermission(tokenData.userId, logId);
  
      // Check if log is already processed
      if (log.status !== 'Pending') {
        throw new Error(`This request is already ${log.status.toLowerCase()}`);
      }
  
      // Determine approval_from and authorizer_role
      let approvalFrom = employee.id;
      let authorizerRole = null;
  
      // If employee.id is 0 or null, use role instead
      if (!employee.id || employee.id === 0) {
        approvalFrom = null;
        authorizerRole = roleNames[0] || 'DefaultRole';
      } else {
        // Use the first role for authorizer_role
        authorizerRole = roleNames[0] || null;
      }
  
      // Update approval log status with reason
      const updatedLog = await updateApprovalLogStatus({
        logId,
        status: 'Rejected',  // This is the status for the approval log
        reason: reason.trim(),
        updatedBy: tokenData.userId,
        approvalFrom,
        authorizerRole
      });
  
      // Update the related model (reimbursement, leave, etc.)
      await updateRelatedModelStatus(
        log.approvable_type,
        log.approvable_id,
        'Rejected',  // Pass the actual status string
        employee.id,
        authorizerRole
      );
  
      // Format dates for response
      const formattedLog = formatLogDates([updatedLog])[0];
  
      // Fetch approvable data
      const approvableData = await fetchApprovableData(log.approvable_type, log.approvable_id);
  
      return {
        success: true,
        message: "Request rejected successfully",
        log: {
          ...formattedLog,
          approvable_data: approvableData
        }
      };
  
    } catch (error) {
      console.error('Error rejecting log:', error);
      return {
        success: false,
        message: error.message || "Failed to reject request",
        log: null
      };
    }
  };

const resolvers = {
  Query: {
    approvalGetPendingLogs,
    approvalGetApprovedLogs,
    approvalGetRejectedLogs,
    approvalGetLogsStatistics,
  },
  Mutation: {
    approveLog,
    rejectLog,
  },
  ApprovableData,
};

export default { typeDef, resolvers };