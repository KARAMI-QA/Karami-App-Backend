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


export default sequelize;