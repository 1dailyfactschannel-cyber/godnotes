const { Pool } = require('pg'); 
require('dotenv').config({ path: '../.env' }); 

const pool = new Pool({ connectionString: process.env.DATABASE_URL }); 

async function addMissingColumns() {
  try {
    console.log('➕ Adding missing columns...\n');
    
    // Check if password column exists
    const hasPassword = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password'
    `);
    
    if (hasPassword.rows.length === 0) {
      // Add password column
      await pool.query('ALTER TABLE users ADD COLUMN password TEXT');
      console.log('✅ Added password column');
      
      // Copy data from password_hash to password
      await pool.query('UPDATE users SET password = password_hash');
      console.log('✅ Copied password_hash to password');
    } else {
      console.log('✅ Password column already exists');
    }
    
    // Check if name column exists
    const hasName = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'name'
    `);
    
    if (hasName.rows.length === 0) {
      // Add name column
      await pool.query('ALTER TABLE users ADD COLUMN name TEXT');
      console.log('✅ Added name column');
      
      // Copy data from full_name to name
      await pool.query('UPDATE users SET name = full_name');
      console.log('✅ Copied full_name to name');
    } else {
      console.log('✅ Name column already exists');
    }
    
    // Make username unique if not already
    const constraints = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
    `);
    
    const hasUniqueUsername = constraints.rows.some(c => c.constraint_name.includes('username'));
    if (!hasUniqueUsername) {
      await pool.query('ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username)');
      console.log('✅ Added unique constraint on username');
    } else {
      console.log('✅ Unique constraint on username already exists');
    }
    
    // Verify final structure
    console.log('\n📋 Final table structure:');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    finalColumns.rows.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n🎉 Table structure updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addMissingColumns();