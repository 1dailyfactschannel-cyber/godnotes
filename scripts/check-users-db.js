const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUsers() {
  try {
    console.log('👥 Current users in database:\n');
    
    const result = await pool.query('SELECT id, email, name, username FROM users ORDER BY created_at');
    
    if (result.rows.length === 0) {
      console.log('📭 No users found in database');
    } else {
      console.log(`📋 Found ${result.rows.length} users:`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - Username: ${user.username || 'null'} - ID: ${user.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();