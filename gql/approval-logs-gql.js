import gql from "graphql-tag";
import { validateUserToken } from "./users-gql.js"; 
import { 
  getPendingApprovalLogsForUser, 
  getUserRoles, 
  getApprovedApprovalLogsForUser,
  getPendingApprovalLogsCountForUser,
  getApprovedApprovalLogsCountForUser
} from "../models/approval-logs-model.js";

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
  }

  type PaginatedApprovalLogs {
    logs: [ApprovalLog]!
    hasMore: Boolean!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
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
  }
`;

const checkApprovalPermission = async (userId, logId, allowedRoles) => {
  try {
    const userRoles = await getUserRoles({ userId });
    const userRoleNames = userRoles.map(role => role.role_name);
    
    const hasPermission = userRoleNames.some(role => allowedRoles.includes(role));
    
    if (!hasPermission) {
      throw new Error("PermissionError: You don't have permission to perform this action");
    }
    
    return userRoleNames;
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
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  // Validate pagination parameters
  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // Limit to 100 max
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (validatedPage - 1) * validatedLimit;

  try {
    // Get paginated logs
    const pendingLogs = await getPendingApprovalLogsForUser({ 
      userId: tokenData.userId,
      limit: validatedLimit,
      offset 
    });
    
    // Get total count
    const totalCount = await getPendingApprovalLogsCountForUser({ 
      userId: tokenData.userId 
    });
    
    // Format dates
    const formattedLogs = formatLogDates(pendingLogs);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasMore = validatedPage < totalPages;
    
    return {
      logs: formattedLogs,
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
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: Invalid user token");
  }

  // Validate pagination parameters
  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  const offset = (validatedPage - 1) * validatedLimit;

  try {
    // Get paginated logs
    const approvedLogs = await getApprovedApprovalLogsForUser({ 
      userId: tokenData.userId,
      limit: validatedLimit,
      offset 
    });
    
    // Get total count
    const totalCount = await getApprovedApprovalLogsCountForUser({ 
      userId: tokenData.userId 
    });
    
    // Format dates
    const formattedLogs = formatLogDates(approvedLogs);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasMore = validatedPage < totalPages;
    
    return {
      logs: formattedLogs,
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

const resolvers = {
  Query: {
    approvalGetPendingLogs,
    approvalGetApprovedLogs,
  },
};

export default { typeDef, resolvers };