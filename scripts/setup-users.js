#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function setupUsersTable() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('👥 Setting up users table...\n');

    // Create users table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created users table');

    // Create sessions table for authentication
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
      );
    `);
    console.log('✅ Created user_sessions table');

    // Create indexes for better performance
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)');
    console.log('✅ Created indexes');

    // Create a view for active users
    await pgPool.query(`
      CREATE OR REPLACE VIEW active_users AS
      SELECT 
        id,
        email,
        username,
        full_name,
        avatar_url,
        is_verified,
        last_login,
        created_at
      FROM users 
      WHERE is_active = TRUE
      ORDER BY created_at DESC;
    `);
    console.log('✅ Created active_users view');

    // Add some sample users (optional)
    console.log('\n👤 Adding sample users...');
    try {
      // Check if users already exist
      const userCount = await pgPool.query('SELECT COUNT(*) FROM users');
      if (userCount.rows[0].count === '0') {
        // Add a default admin user (insecure password, change in production!)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await pgPool.query(`
          INSERT INTO users (id, email, username, password_hash, full_name, is_verified)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'admin-user-1',
          'admin@godnotes.com',
          'admin',
          hashedPassword,
          'Administrator',
          true
        ]);
        console.log('✅ Added default admin user (email: admin@godnotes.com, password: admin123)');
      } else {
        console.log('ℹ️  Users already exist, skipping sample data');
      }
    } catch (error) {
      console.log('⚠️  Could not add sample users:', error.message);
    }

    // Show final statistics
    console.log('\n📊 Users table statistics:');
    const statsResult = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
        (SELECT COUNT(*) FROM users WHERE is_verified = TRUE) as verified_users
    `);

    const stats = statsResult.rows[0];
    console.log(`👥 Total users: ${stats.total_users}`);
    console.log(`✅ Active users: ${stats.active_users}`);
    console.log(`✅ Verified users: ${stats.verified_users}`);

    console.log('\n🎉 Users table setup completed successfully!');
    console.log('\n📋 New tables created:');
    console.log('  • users - user accounts and profiles');
    console.log('  • user_sessions - authentication sessions');
    console.log('\n👀 Helpful view created:');
    console.log('  • active_users - active user accounts');

  } catch (error) {
    console.error('❌ Users table setup failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

// Add authentication helper functions
async function createAuthFunctions() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔐 Creating authentication functions...\n');

    // Function to create user session
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION create_user_session(
        p_user_id TEXT,
        p_token TEXT,
        p_expires_in INTERVAL DEFAULT '7 days',
        p_ip_address TEXT DEFAULT NULL,
        p_user_agent TEXT DEFAULT NULL
      ) RETURNS TEXT AS $$
      DECLARE
        session_id TEXT;
      BEGIN
        -- Generate session ID
        session_id := gen_random_uuid()::TEXT;
        
        -- Insert new session
        INSERT INTO user_sessions (id, user_id, token, expires_at, ip_address, user_agent)
        VALUES (session_id, p_user_id, p_token, NOW() + p_expires_in, p_ip_address, p_user_agent);
        
        -- Update user's last login
        UPDATE users SET last_login = NOW() WHERE id = p_user_id;
        
        RETURN session_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created create_user_session function');

    // Function to validate session
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION validate_session(p_token TEXT)
      RETURNS TABLE(user_id TEXT, email TEXT, username TEXT, full_name TEXT) AS $$
      BEGIN
        RETURN QUERY
        SELECT u.id, u.email, u.username, u.full_name
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.token = p_token 
        AND s.expires_at > NOW()
        AND u.is_active = TRUE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created validate_session function');

    // Function to cleanup expired sessions
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM user_sessions 
        WHERE expires_at < NOW();
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created cleanup_expired_sessions function');

    console.log('\n🎯 Authentication functions ready to use:');
    console.log('  SELECT create_user_session(\'user_id\', \'token\', \'7 days\');');
    console.log('  SELECT * FROM validate_session(\'session_token\');');
    console.log('  SELECT cleanup_expired_sessions();');

  } catch (error) {
    console.error('❌ Auth functions creation failed:', error.message);
  } finally {
    await pgPool.end();
  }
}

async function main() {
  try {
    await setupUsersTable();
    await createAuthFunctions();
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupUsersTable, createAuthFunctions };