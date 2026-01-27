#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function setupCoreTables() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('📋 Setting up core application tables...\n');

    // Create folders table first
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created folders table');

    // Create notes table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        tags TEXT[],
        priority INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Created notes table');

    // Create calendar_events table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        is_all_day BOOLEAN DEFAULT FALSE,
        location TEXT,
        color TEXT,
        reminder_minutes INTEGER[],
        recurrence_rule TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        parent_event_id TEXT REFERENCES calendar_events(id) ON DELETE SET NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Created calendar_events table');

    // Create todos table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        priority INTEGER DEFAULT 1,
        tags TEXT[],
        project_id TEXT,
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Created todos table');

    // Create tags table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      );
    `);
    console.log('✅ Created tags table');

    // Create junction table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
        tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (note_id, tag_id)
      );
    `);
    console.log('✅ Created note_tags junction table');

    // Create indexes
    console.log('\n⚡ Creating indexes...');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)');
    console.log('✅ Created indexes');

    // Create views
    console.log('\n👀 Creating views...');
    await pgPool.query(`
      CREATE OR REPLACE VIEW user_dashboard AS
      SELECT 
        u.id as user_id,
        u.username,
        u.email,
        (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id AND n.is_deleted = FALSE) as notes_count,
        (SELECT COUNT(*) FROM calendar_events ce WHERE ce.user_id = u.id AND ce.is_deleted = FALSE AND ce.start_time >= NOW()) as upcoming_events,
        (SELECT COUNT(*) FROM todos t WHERE t.user_id = u.id AND t.is_deleted = FALSE AND t.completed = FALSE) as pending_tasks,
        u.last_login,
        u.created_at as member_since
      FROM users u
      WHERE u.is_active = TRUE;
    `);
    console.log('✅ Created user_dashboard view');

    console.log('\n📊 Final statistics:');
    const tablesResult = await pgPool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const viewsResult = await pgPool.query(`
      SELECT COUNT(*) as view_count 
      FROM information_schema.views 
      WHERE table_schema = 'public'
    `);

    console.log(`📋 Total tables: ${tablesResult.rows[0].table_count}`);
    console.log(`👀 Total views: ${viewsResult.rows[0].view_count}`);

    console.log('\n🎉 Core application tables setup completed!');
    console.log('Ready for notes, calendar, and todo functionality!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

async function main() {
  try {
    await setupCoreTables();
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupCoreTables };