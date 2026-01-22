import sequelize from "./connection.js";

export async function inspectTableSchema() {
  try {
    console.log('Inspecting database tables...');
    
    // Get all tables
    const [tables] = await sequelize.query("SHOW TABLES");
    console.log('Available tables:', tables);
    
    // For each table, show its structure
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\n=== Structure of table: ${tableName} ===`);
      
      const [columns] = await sequelize.query(`DESCRIBE ${tableName}`);
      console.table(columns);
      
      // Show sample data (first 5 rows)
      try {
        const [rows] = await sequelize.query(`SELECT * FROM ${tableName} LIMIT 5`);
        console.log(`Sample data (first 5 rows):`);
        console.table(rows);
      } catch (err) {
        console.log(`Could not fetch sample data from ${tableName}`);
      }
    }
    
  } catch (error) {
    console.error('Error inspecting schema:', error);
  }
}