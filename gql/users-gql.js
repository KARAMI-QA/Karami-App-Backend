import gql from "graphql-tag";
import { Sequelize } from "sequelize";
import UsersModel, { getEmail, getOne, getSearch } from "../models/users-model.js";
import cryptoHelper from "../utils/crypto-helper.js";
import { getUserRoles } from "../models/approval-logs-model.js"; 

const typeDef = gql`
  type UserRole {
    role_id: ID!
    role_name: String!
    guard_name: String!
    description: String
  }

  type User {
    id: ID!
    name: String
    first_name: String
    middle_name: String
    last_name: String
    email: String
    phone: String
    image: String
    email_verified_at: String
    phone_verified_at: String
    device_token: String
    device_type: String!
    first_time_password_change: Int!
    remember_token: String
    otp: String
    reset_activation: String
    is_verified: String!
    is_employee: Int!
    is_super: Int!
    status: String!
    created_by: ID
    updated_by: ID
    deleted_by: ID
    deleted_at: String
    created_at: String!
    updated_at: String!
    roles: [UserRole]!  
  }

  type PaginationInfo {
    currentPage: Int!
    perPage: Int!
    totalItems: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type PaginatedUsers {
    users: [User]!
    pagination: PaginationInfo!
  }

  type LoginResponse {
    success: Boolean!
    message: String
    userToken: String
    user: User
  }

  input PaginationInput {
    page: Int = 1
    perPage: Int = 10
  }

  input LoginInput {
    email: String!
    password: String!
    device_type: String
  }

  input ForgotPasswordInput {
    email: String!
  }

  input ResetPasswordInput {
    email: String!
    otp: String!
    new_password: String!
  }

  type Query {
    userGetOne(userToken: String!): User
    userSearch(userToken: String!, searchTerm: String!): [User]
    userGetByEmail(userToken: String!, email: String!): User
    
    # Updated queries with pagination
    userGetAll(userToken: String!, pagination: PaginationInput): PaginatedUsers!
    userGetActiveEmployees(userToken: String!, pagination: PaginationInput): PaginatedUsers!
    userGetAdmins(userToken: String!, pagination: PaginationInput): PaginatedUsers!
    
    # Keep backward compatible queries (deprecated)
    userGet100(userToken: String!): [User] @deprecated(reason: "Use userGetAll with pagination instead")
    
    userValidateToken(userToken: String!): Boolean
    
    # New query to get user roles
    userGetRoles(userToken: String!): [UserRole]
  }

  type Mutation {
    userLogin(loginInput: LoginInput!): LoginResponse!
    userForgotPassword(forgotInput: ForgotPasswordInput!): Boolean!
    userResetPassword(resetInput: ResetPasswordInput!): Boolean!
  }
`;


const generateUserToken = (user) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return Buffer.from(`${user.id}:${timestamp}:${random}`).toString('base64');
};

// Helper function to validate user token
export const validateUserToken = (userToken) => {
  try { 
    if (!userToken) return null;
    
    const decoded = Buffer.from(userToken, 'base64').toString('ascii');
    const [userId] = decoded.split(':');
    
    return {
      userId: parseInt(userId),
      token: userToken
    };
  } catch (error) {
    return null;
  }
};



// Query Resolvers
const userValidateToken = async (parent, args) => {
  const { userToken } = args;
  const tokenData = validateUserToken(userToken);
  
  if (!tokenData) {
    return false;
  }
  
  try {
    const user = await UsersModel.findByPk(tokenData.userId, {
      where: {
        status: 'Active',
        deleted_at: null
      }
    });
    
    return !!user;
  } catch (error) {
    return false;
  }
};

const userGetOne = async (parent, args) => {
  const { userToken } = args;
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  try {
    const user = await getOne({ userId: tokenData.userId });
    const roles = await getUserRoles({ userId: tokenData.userId });
    
    return {
      ...user,
      roles: roles
    };
  } catch (error) {
    throw new Error("User not found");
  }
};

const userGetByEmail = async (parent, args) => {
  const { userToken, email } = args;
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  const authUser = await UsersModel.findByPk(tokenData.userId);
  if (!authUser) {
    throw new Error("AuthError: user not found");
  }

  if (authUser.email !== email && authUser.is_super !== 1) {
    throw new Error("PermissionError: Cannot access other user data");
  }

  try {
    const user = await getEmail({ email });
    const roles = await getUserRoles({ userId: user.id });
    
    return {
      ...user,
      roles: roles
    };
  } catch (error) {
    throw new Error("User not found");
  }
};

// New query to get user roles
const userGetRoles = async (parent, args) => {
  const { userToken } = args;
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  try {
    const roles = await getUserRoles({ userId: tokenData.userId });
    return roles;
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
};


const paginateUsers = async (findOptions, page = 1, perPage = 10) => {
  // Calculate offset
  const offset = (page - 1) * perPage;
  
  // Get total count
  const countOptions = { ...findOptions };
  delete countOptions.limit;
  delete countOptions.offset;
  delete countOptions.order;
  delete countOptions.attributes;
  
  const totalItems = await UsersModel.count(countOptions);
  
  // Calculate total pages
  const totalPages = Math.ceil(totalItems / perPage);
  
  // Get paginated data
  const users = await UsersModel.findAll({
    ...findOptions,
    limit: perPage,
    offset: offset,
    order: findOptions.order || [['created_at', 'DESC']],
    raw: true,
  });
  
  // Format dates and fetch roles for each user
  const formattedUsers = await Promise.all(users.map(async (user) => {
    const roles = await getUserRoles({ userId: user.id });
    
    return {
      ...user,
      roles: roles,
      created_at: user.created_at ? 
        new Date(user.created_at).toISOString().replace('T', ' ').substring(0, 19) : 
        null,
      updated_at: user.updated_at ? 
        new Date(user.updated_at).toISOString().replace('T', ' ').substring(0, 19) : 
        null,
      email_verified_at: user.email_verified_at ? 
        new Date(user.email_verified_at).toISOString().replace('T', ' ').substring(0, 19) : 
        null,
      phone_verified_at: user.phone_verified_at ? 
        new Date(user.phone_verified_at).toISOString().replace('T', ' ').substring(0, 19) : 
        null,
    };
  }));
  
  return {
    users: formattedUsers,
    pagination: {
      currentPage: page,
      perPage: perPage,
      totalItems: totalItems,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }
  };
};

// Update Mutation Resolver for userLogin to include roles
const userLogin = async (parent, args) => {
  const { loginInput } = args;
  const { email, password, device_type } = loginInput;

  try {
    // console.log('Login attempt for email:', email);
    // console.log('Provided password length:', password ? password.length : 'missing');
    
    // Validate input
    if (!password || typeof password !== 'string') {
      console.error('Invalid password provided');
      return {
        success: false,
        message: "Invalid email or password",
        userToken: null,
        user: null
      };
    }

    // Find user by email
    const user = await getEmail({ email }).catch(() => null);
    
    if (!user) {
      console.log('User not found with email:', email);
      return {
        success: false,
        message: "Invalid email or password",
        userToken: null,
        user: null
      };
    }

    // console.log('Found user ID:', user.id);
    // console.log('User status:', user.status);
    // console.log('Hash format check:', user.password ? `Starts with: ${user.password.substring(0, 10)}...` : 'No password');
    
    // Check user status
    if (user.status !== 'Active') {
      return {
        success: false,
        message: `Account is ${user.status}. Please contact support.`,
        userToken: null,
        user: null
      };
    }

    // Check if user is deleted
    if (user.deleted_at) {
      return {
        success: false,
        message: "Account not found",
        userToken: null,
        user: null
      };
    }

    // Compare password using cryptoHelper
    // console.log('Attempting password comparison...');
    const passwordMatch = await cryptoHelper.comparePassword(password, user.password);
    // console.log('Password match result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password comparison failed');
      return {
        success: false,
        message: "Invalid email or password",
        userToken: null,
        user: null
      };
    }

    // console.log('Password verified, generating token...');
    
    // Generate user token
    const userToken = generateUserToken(user);

    // Fetch user roles
    const userRoles = await getUserRoles({ userId: user.id });

    // Update last login timestamp
    await UsersModel.update(
      {
        email_verified_at: user.email_verified_at || new Date(),
        updated_at: new Date()
      },
      { where: { id: user.id } }
    );

    // Remove password from response
    const userResponse = { 
      ...user,
      roles: userRoles  // Add roles to response
    };
    delete userResponse.password;

    return {
      success: true,
      message: "Login successful",
      userToken,
      user: userResponse
    };
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: "Login failed. Please try again.",
      userToken: null,
      user: null
    };
  }
};
// Query Resolvers

const userSearch = async (parent, args) => {
  const { userToken, searchTerm } = args;
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  const authUser = await UsersModel.findByPk(tokenData.userId);
  if (!authUser) {
    throw new Error("AuthError: user not found");
  }

  try {
    const users = await getSearch({ searchTerm });
    return users; // Now returns array of users
  } catch (error) {
    console.error('Search user error:', error);
    return []; // Return empty array instead of throwing error
  }
};

// New paginated query for all users
const userGetAll = async (parent, args) => {
  const { userToken, pagination = {} } = args;
  const { page = 1, perPage = 10 } = pagination;
  
  // Validate pagination parameters
  if (page < 1) {
    throw new Error("Page must be greater than 0");
  }
  
  if (perPage < 1 || perPage > 100) {
    throw new Error("PerPage must be between 1 and 100");
  }
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  const authUser = await UsersModel.findByPk(tokenData.userId);
  if (!authUser || authUser.is_super !== 1) {
    throw new Error("PermissionError: Admin access required");
  }

  try {
    const findOptions = {
      where: {
        deleted_at: null,
      },
      attributes: {
        include: [
          [Sequelize.literal(`DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'created_at'],
          [Sequelize.literal(`DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'updated_at'],
          [Sequelize.literal(`DATE_FORMAT(email_verified_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'email_verified_at'],
          [Sequelize.literal(`DATE_FORMAT(phone_verified_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'phone_verified_at'],
        ],
      },
    };

    return await paginateUsers(findOptions, page, perPage);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error("Error fetching users");
  }
};

// Updated paginated query for active employees
const userGetActiveEmployees = async (parent, args) => {
  const { userToken, pagination = {} } = args;
  const { page = 1, perPage = 10 } = pagination;
  
  // Validate pagination parameters
  if (page < 1) {
    throw new Error("Page must be greater than 0");
  }
  
  if (perPage < 1 || perPage > 1000) {
    throw new Error("PerPage must be between 1 and 1000");
  }
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  try {
    const findOptions = {
      where: {
        is_employee: 1,
        status: 'Active',
        deleted_at: null,
      },
      attributes: {
        include: [
          [Sequelize.literal(`DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'created_at'],
          [Sequelize.literal(`DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'updated_at'],
        ],
      },
      order: [
        ['id', 'ASC'] // or 'DESC' if you want descending order
      ]
    };

    return await paginateUsers(findOptions, page, perPage);
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw new Error("Error fetching employees");
  }
};

// Updated paginated query for admins
const userGetAdmins = async (parent, args) => {
  const { userToken, pagination = {} } = args;
  const { page = 1, perPage = 10 } = pagination;
  
  // Validate pagination parameters
  if (page < 1) {
    throw new Error("Page must be greater than 0");
  }
  
  if (perPage < 1 || perPage > 100) {
    throw new Error("PerPage must be between 1 and 100");
  }
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  const authUser = await UsersModel.findByPk(tokenData.userId);
  if (!authUser || authUser.is_super !== 1) {
    throw new Error("PermissionError: Admin access required");
  }

  try {
    const findOptions = {
      where: {
        is_super: 1,
        status: 'Active',
        deleted_at: null,
      },
      attributes: {
        include: [
          [Sequelize.literal(`DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'created_at'],
          [Sequelize.literal(`DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'updated_at'],
        ],
      },
    };

    return await paginateUsers(findOptions, page, perPage);
  } catch (error) {
    console.error('Error fetching admins:', error);
    throw new Error("Error fetching admins");
  }
};

// Keep backward compatibility for userGet100
const userGet100 = async (parent, args) => {
  const { userToken } = args;
  
  const tokenData = validateUserToken(userToken);
  if (!tokenData) {
    throw new Error("AuthError: invalid user token");
  }

  const authUser = await UsersModel.findByPk(tokenData.userId);
  if (!authUser || authUser.is_super !== 1) {
    throw new Error("PermissionError: Admin access required");
  }

  try {
    const users = await UsersModel.findAll({
      limit: 100,
      where: {
        deleted_at: null,
      },
      attributes: {
        include: [
          [Sequelize.literal(`DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'created_at'],
          [Sequelize.literal(`DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'updated_at'],
          [Sequelize.literal(`DATE_FORMAT(email_verified_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'email_verified_at'],
          [Sequelize.literal(`DATE_FORMAT(phone_verified_at, '%Y-%m-%dT%H:%i:00.000Z')`), 'phone_verified_at'],
        ],
      },
      order: [['created_at', 'DESC']],
      raw: true,
    });

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error("Error fetching users");
  }
};

// Mutation Resolvers


const userForgotPassword = async (parent, args) => {
  const { forgotInput } = args;
  const { email } = forgotInput;

  try {
    const user = await getEmail({ email }).catch(() => null);
    if (!user) {
      // Don't reveal if user exists for security
      return true;
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await UsersModel.update(
      { 
        otp,
        reset_activation: 'Reset',
        updated_at: new Date() 
      },
      { where: { id: user.id } }
    );

    // TODO: Send email with OTP
    console.log(`Password reset OTP for ${email}: ${otp}`);

    return true;
  } catch (error) {
    console.error('Forgot password error:', error);
    throw new Error("Failed to process forgot password request");
  }
};

const userResetPassword = async (parent, args) => {
  const { resetInput } = args;
  const { email, otp, new_password } = resetInput;

  try {
    const user = await getEmail({ email }).catch(() => null);
    if (!user) {
      throw new Error("User not found");
    }

    // Check OTP
    if (user.otp !== otp || user.reset_activation !== 'Reset') {
      throw new Error("Invalid or expired OTP");
    }

    // Check if OTP is older than 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (new Date(user.updated_at) < fifteenMinutesAgo) {
      throw new Error("OTP has expired");
    }

    // Validate new password
    if (!new_password || new_password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Hash the new password using cryptoHelper
    const hashedPassword = await cryptoHelper.hashPassword(new_password);
    
    // Update password with hashed version
    await UsersModel.update(
      { 
        password: hashedPassword,
        otp: null,
        reset_activation: null,
        first_time_password_change: 1,
        updated_at: new Date() 
      },
      { where: { id: user.id } }
    );

    return true;
  } catch (error) {
    console.error('Reset password error:', error.message);
    throw new Error(error.message || "Failed to reset password");
  }
};

const resolvers = {
  Query: {
    userValidateToken,
    userGetOne,
    userSearch,
    userGetByEmail,
    userGetAll, // New paginated query
    userGetActiveEmployees,
    userGetAdmins,
    userGet100, // Keep for backward compatibility
    userGetRoles, // Add new query
  },
  Mutation: {
    userLogin,
    userForgotPassword,
    userResetPassword,
  },
};

export default { typeDef, resolvers };