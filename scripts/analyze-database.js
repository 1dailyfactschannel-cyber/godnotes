#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

// PostgreSQL configuration
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function analyzeDatabaseContent() {
  try {
    console.log('🔍 Detailed database analysis...\n');
    
    // Check if tables exist and their structure
    const tablesResult = await pgPool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('notes', 'folders')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('📋 Table structures:');
    const tables = {};
    tablesResult.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
    });
    
    Object.entries(tables).forEach(([table, columns]) => {
      console.log(`\n📄 ${table}:`);
      columns.forEach(col => console.log(`  • ${col}`));
    });
    
    console.log('\n📊 Data content analysis:');
    
    // Check actual data content
    for (const tableName of ['notes', 'folders']) {
      console.log(`\n--- ${tableName.toUpperCase()} ---`);
      
      // Count records
      const countResult = await pgPool.query(`SELECT COUNT(*) FROM ${tableName}`);
      const count = countResult.rows[0].count;
      console.log(`Total records: ${count}`);
      
      if (count > 0) {
        // Show sample raw data
        const rawData = await pgPool.query(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log('\nRaw sample records:');
        rawData.rows.forEach((row, index) => {
          console.log(`\nRecord ${index + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            if (key === 'data' && typeof value === 'object') {
              console.log(`  ${key}: JSON object with ${Object.keys(value).length} properties`);
              // Show first few properties
              const props = Object.keys(value).slice(0, 3);
              props.forEach(prop => {
                const val = value[prop];
                const displayVal = typeof val === 'string' && val.length > 50 ? 
                  val.substring(0, 50) + '...' : val;
                console.log(`    ${prop}: ${displayVal}`);
              });
              if (Object.keys(value).length > 3) {
                console.log(`    ...and ${Object.keys(value).length - 3} more properties`);
              }
            } else {
              console.log(`  ${key}: ${value}`);
            }
          });
        });
        
        // Check if data field has actual content
        const dataCheck = await pgPool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(data) as with_data,
            COUNT(CASE WHEN data IS NULL THEN 1 END) as null_data
          FROM ${tableName}
        `);
        
        console.log(`\nData field statistics:`);
        console.log(`  Total records: ${dataCheck.rows[0].total}`);
        console.log(`  Records with data: ${dataCheck.rows[0].with_data}`);
        console.log(`  Records with null data: ${dataCheck.rows[0].null_data}`);
        
      } else {
        console.log('No records found');
      }
    }
    
    // Check Appwrite source data availability
    console.log('\n🔍 Checking Appwrite source data...');
    try {
      const { Client, Databases } = require('node-appwrite');
      require('dotenv').config({ path: '.env.migration' });
      
      const client = new Client();
      client
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);
      
      const databases = new Databases(client);
      
      const collections = await databases.listCollections(process.env.APPWRITE_DATABASE_ID);
      console.log(`\nAppwrite collections available: ${collections.collections.length}`);
      
      for (const collection of collections.collections) {
        const docs = await databases.listDocuments(
          process.env.APPWRITE_DATABASE_ID,
          collection.$id,
          []
        );
        console.log(`  ${collection.name} (${collection.$id}): ${docs.total} documents`);
      }
      
    } catch (error) {
      console.log(`❌ Cannot access Appwrite: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error analyzing database:', error.message);
  } finally {
    await pgPool.end();
  }
}

analyzeDatabaseContent();