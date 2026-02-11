import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../mysql/connection.js";

const UsersModel = sequelize.define(
  "users",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
    first_name: { type: DataTypes.STRING(255), allowNull: true },
    middle_name: { type: DataTypes.STRING(255), allowNull: true },
    last_name: { type: DataTypes.STRING(255), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(255), allowNull: true },
    image: { type: DataTypes.STRING(255), allowNull: true },
    email_verified_at: { type: DataTypes.DATE, allowNull: true },
    phone_verified_at: { type: DataTypes.DATE, allowNull: true },
    device_token: { type: DataTypes.TEXT, allowNull: true },
    device_type: { type: DataTypes.ENUM('Android', 'IOS', 'Web'), allowNull: false, defaultValue: 'Web' },
    first_time_password_change: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    remember_token: { type: DataTypes.STRING(100), allowNull: true },
    otp: { type: DataTypes.STRING(14), allowNull: true },
    reset_activation: { type: DataTypes.ENUM('Activation', 'Reset'), allowNull: true },
    is_verified: { type: DataTypes.ENUM('Verified', 'Not Verified'), allowNull: false, defaultValue: 'Not Verified' },
    is_employee: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    is_super: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM('Active', 'InActive'), allowNull: false, defaultValue: 'Active' },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    updated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "users",
  }
);

export default UsersModel;

export const getEmail = async ({ email }) => {
    try {
      const users = await sequelize.query(
        `
       SELECT *,
        DATE_FORMAT(created_at, '%Y-%m-%d') AS created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%d') AS updated_at,
        DATE_FORMAT(email_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS email_verified_at,
        DATE_FORMAT(phone_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS phone_verified_at
      FROM users
      WHERE email = :email
        AND status = 'Active'
        AND deleted_at IS NULL
      LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { email }
        }
      );
  
      if (users.length === 0) {
        throw new Error(`No user found with email: ${email}`);
      }
  
      return users[0];
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  };

  export const getSearch = async ({ searchTerm }) => {
    try {
      // Search by email, phone, or name with multiple results
      const users = await sequelize.query(
        `
        SELECT *,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(email_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS email_verified_at,
          DATE_FORMAT(phone_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS phone_verified_at
        FROM users
        WHERE (email LIKE :emailSearch 
               OR phone LIKE :phoneSearch 
               OR name LIKE :nameSearch
               OR CONCAT(first_name, ' ', last_name) LIKE :fullNameSearch
               OR CONCAT(first_name, ' ', middle_name, ' ', last_name) LIKE :fullNameSearch2)
          AND deleted_at IS NULL
          AND status = 'Active'
        ORDER BY 
          CASE 
            WHEN name = :exactSearch THEN 1
            WHEN name LIKE :startsWithSearch THEN 2
            ELSE 3
          END,
          name ASC
        LIMIT 20; -- Limit results for performance
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { 
            emailSearch: `%${searchTerm}%`,
            phoneSearch: `%${searchTerm}%`,
            nameSearch: `%${searchTerm}%`,
            fullNameSearch: `%${searchTerm}%`,
            fullNameSearch2: `%${searchTerm}%`,
            exactSearch: searchTerm,
            startsWithSearch: `${searchTerm}%`
          }
        }
      );
  
      if (users.length === 0) {
        return []; // Return empty array instead of throwing error
      }
  
      return users;
    } catch (error) {
      console.error('Search user error:', error);
      return []; // Return empty array on error
    }
  };
  
  export const getOne = async ({ userId }) => {
    try {
      const users = await sequelize.query(
        `
        SELECT *,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:00.000Z') AS created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:00.000Z') AS updated_at,
          DATE_FORMAT(email_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS email_verified_at,
          DATE_FORMAT(phone_verified_at, '%Y-%m-%dT%H:%i:00.000Z') AS phone_verified_at,
          DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:00.000Z') AS deleted_at
        FROM users
        WHERE id = :userId
        AND status = 'Active'
        AND deleted_at IS NULL
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { userId },
        }
      );
  
      if (users.length === 0) {
        throw new Error(`No user found with id: ${userId}`);
      }
  
      return users[0];
    } catch (error) {
      console.error('Error fetching user by id:', error);
      throw error;
    }
  };
  
  export const changeProfileImage = async ({id, imageUrl}) => {
    const userItem = await UsersModel.findByPk(id);
    if (!userItem) {
      return null;
    }
  
    userItem.image = imageUrl;
    await userItem.save();
    return userItem;
  };
  
  export const updateUserStatus = async ({id, status, updated_by}) => {
    const userItem = await UsersModel.findByPk(id);
    if (!userItem) {
      throw new Error("User not found");
    }
  
    userItem.status = status;
    userItem.updated_by = updated_by;
    userItem.updated_at = new Date();
    await userItem.save();
    
    return userItem;
  };
  
  export const softDeleteUser = async ({id, deleted_by}) => {
    const userItem = await UsersModel.findByPk(id);
    if (!userItem) {
      throw new Error("User not found");
    }
  
    userItem.deleted_at = new Date();
    userItem.deleted_by = deleted_by;
    userItem.status = 'InActive';
    userItem.updated_at = new Date();
    await userItem.save();
    
    return userItem;
  };
  
  export const restoreUser = async ({id, updated_by}) => {
    const userItem = await UsersModel.findByPk(id);
    if (!userItem) {
      throw new Error("User not found");
    }
  
    userItem.deleted_at = null;
    userItem.deleted_by = null;
    userItem.status = 'Active';
    userItem.updated_by = updated_by;
    userItem.updated_at = new Date();
    await userItem.save();
    
    return userItem;
  };
  
  export const verifyUserEmail = async ({id}) => {
    const userItem = await UsersModel.findByPk(id);
    if (!userItem) {
      throw new Error("User not found");
    }
  
    userItem.email_verified_at = new Date();
    userItem.is_verified = 'Verified';
    userItem.updated_at = new Date();
    await userItem.save();
    
    return userItem;
  };