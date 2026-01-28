import { Sequelize } from "sequelize";
import 'dotenv/config';

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE ,
  process.env.MYSQL_USER ,
  process.env.MYSQL_PASSWORD ,
  {
    host: process.env.MYSQL_HOST ,
    port: process.env.MYSQL_PORT ,
    logging: false,
    dialect: "mysql",
    dialectOptions: process.env.MYSQL_SSL === 'true' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    pool: {
      min: 1,
      max: 20,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3,
      timeout: 30000
    },
      timezone: '+03:00'
  }
);

// const testDbConnection = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log(`✅ Connected to Google Cloud SQL: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`);
//     return true;
//   } catch (error) {
//     console.error("❌ Unable to connect to Google Cloud SQL:", error.message);
//     console.log("⚠️  Please verify:");
//     console.log("   1. IP address is added to Cloud SQL authorized networks");
//     console.log("   2. Database credentials are correct");
//     console.log("   3. SSL connection is properly configured");
//     throw error;
//   }
// };

// // Test connection on import
// testDbConnection();

export default sequelize;