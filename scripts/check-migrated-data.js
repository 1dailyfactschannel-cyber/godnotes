#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

// PostgreSQL configuration
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkMigratedData() {
  try {
    console.log('🔍 Checking migrated data in PostgreSQL...\n');
    
    // Check tables
    const tablesResult = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📋 Tables found: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach(table => {
      console.log(`  • ${table.table_name}`);
    });
    console.log('');
    
    // Check data in each table
    for (const table of tablesResult.rows) {
      const countResult = await pgPool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
      const count = countResult.rows[0].count;
      
      console.log(`📊 ${table.table_name}: ${count} records`);
      
      if (count > 0) {
        // Show sample data structure
        const sampleResult = await pgPool.query(`SELECT * FROM ${table.table_name} LIMIT 1`);
        if (sampleResult.rows.length > 0) {
          console.log(`   Sample structure:`);
          Object.keys(sampleResult.rows[0]).forEach(key => {
            const value = sampleResult.rows[0][key];
            const valueType = typeof value;
            console.log(`     ${key}: ${valueType}${valueType === 'object' ? ` (${Array.isArray(value) ? 'array' : 'object'})` : ''}`);
          });
        }
      }
      console.log('');
    }
    
    console.log('✅ Data validation completed!');
    
  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    await pgPool.end();
  }
}

checkMigratedData();