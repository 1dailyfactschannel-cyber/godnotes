const { Pool } = require('pg'); 
require('dotenv').config({ path: '../.env' }); 

const pool = new Pool({ connectionString: process.env.DATABASE_URL }); 

async function checkUsers() {
  try {
    console.log('👥 Current users in database:\n');
    
    const result = await pool.query('SELECT id, email, username, is_active, created_at FROM users ORDER BY created_at');
    
    if (result.rows.length === 0) {
      console.log('📭 No users found in database');
    } else {
      console.log(`📋 Found ${result.rows.length} users:`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} (${user.email}) - ${user.is_active ? 'Active' : 'Inactive'} - ${new Date(user.created_at).toLocaleString()}`);
      });
    }
    
    console.log('\n📊 Statistics:');
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active,
        COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified
      FROM users
    `);
    
    console.log(`Total: ${stats.rows[0].total}`);
    console.log(`Active: ${stats.rows[0].active}`);
    console.log(`Verified: ${stats.rows[0].verified}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();