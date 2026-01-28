#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function fixUsersTable() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Fixing users table structure...\n');

    // Check current structure
    console.log('📋 Current table structure:');
    const currentColumns = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    currentColumns.rows.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type})`);
    });

    // Rename columns to match application expectations
    console.log('\n🔄 Renaming columns...');
    
    // Check if we need to rename columns
    const hasOldStructure = currentColumns.rows.some(col => 
      col.column_name === 'email' || col.column_name === 'password_hash' || col.column_name === 'full_name'
    );

    if (hasOldStructure) {
      // Rename columns
      await pgPool.query('ALTER TABLE users RENAME COLUMN email TO username');
      console.log('✅ Renamed email → username');
      
      await pgPool.query('ALTER TABLE users RENAME COLUMN password_hash TO password');
      console.log('✅ Renamed password_hash → password');
      
      await pgPool.query('ALTER TABLE users RENAME COLUMN full_name TO name');
      console.log('✅ Renamed full_name → name');
      
      // Make username unique
      await pgPool.query('ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username)');
      console.log('✅ Added unique constraint on username');
      
      // Update existing admin user
      await pgPool.query(`
        UPDATE users 
        SET username = email, password = password_hash, name = full_name 
        WHERE id = 'admin-user-1'
      `);
      console.log('✅ Updated admin user data');
    } else {
      console.log('✅ Table structure is already correct');
    }

    // Verify new structure
    console.log('\n📋 New table structure:');
    const newColumns = await pgPool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    newColumns.rows.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Test user creation
    console.log('\n🧪 Testing user creation...');
    try {
      const testUser = await pgPool.query(`
        INSERT INTO users (id, username, password, name) 
        VALUES ('test-user-' || gen_random_uuid(), 'test@example.com', 'hashed_password', 'Test User')
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username
      `);
      
      if (testUser.rows.length > 0) {
        console.log(`✅ Successfully created test user: ${testUser.rows[0].username}`);
        
        // Clean up test user
        await pgPool.query('DELETE FROM users WHERE id = $1', [testUser.rows[0].id]);
        console.log('✅ Cleaned up test user');
      } else {
        console.log('ℹ️  Test user already exists or creation skipped');
      }
    } catch (error) {
      console.log('❌ User creation test failed:', error.message);
    }

    console.log('\n🎉 Users table structure fixed successfully!');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

fixUsersTable();