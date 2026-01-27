#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function setupAdditionalTables() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('📋 Setting up additional application tables...\n');

    // Create notes table with proper structure
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        folder_id TEXT,
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

    // Create todos/tasks table
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

    // Create tags table for better tag management
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

    // Create junction table for notes_tags relationship
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
        tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (note_id, tag_id)
      );
    `);
    console.log('✅ Created note_tags junction table');

    // Create indexes for better performance
    console.log('\n⚡ Creating indexes...');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(is_deleted)');
    
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_end ON calendar_events(end_time)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_recurring ON calendar_events(is_recurring)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_calendar_deleted ON calendar_events(is_deleted)');
    
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_todos_deleted ON todos(is_deleted)');
    
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)');
    console.log('✅ Created indexes');

    // Create helpful views
    console.log('\n👀 Creating helpful views...');
    
    // Active notes view
    await pgPool.query(`
      CREATE OR REPLACE VIEW active_notes_view AS
      SELECT 
        n.id,
        n.user_id,
        n.title,
        n.content,
        n.folder_id,
        f.name as folder_name,
        n.tags,
        n.priority,
        n.is_pinned,
        n.is_archived,
        n.created_at,
        n.updated_at,
        u.username as author
      FROM notes n
      LEFT JOIN folders f ON n.folder_id = f.id
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.is_deleted = FALSE
      ORDER BY n.is_pinned DESC, n.updated_at DESC;
    `);
    console.log('✅ Created active_notes_view');

    // Upcoming calendar events
    await pgPool.query(`
      CREATE OR REPLACE VIEW upcoming_events_view AS
      SELECT 
        e.id,
        e.user_id,
        e.title,
        e.description,
        e.start_time,
        e.end_time,
        e.is_all_day,
        e.location,
        e.color,
        e.reminder_minutes,
        e.is_recurring,
        e.parent_event_id,
        u.username as organizer
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.is_deleted = FALSE 
      AND e.start_time >= NOW() - INTERVAL '1 hour'
      ORDER BY e.start_time ASC
      LIMIT 100;
    `);
    console.log('✅ Created upcoming_events_view');

    // Pending todos
    await pgPool.query(`
      CREATE OR REPLACE VIEW pending_todos_view AS
      SELECT 
        t.id,
        t.user_id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.tags,
        t.project_id,
        t.assigned_to,
        u1.username as assignee,
        u2.username as creator
      FROM todos t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.user_id = u2.id
      WHERE t.is_deleted = FALSE AND t.completed = FALSE
      ORDER BY 
        CASE WHEN t.due_date IS NOT NULL THEN t.due_date ELSE 'infinity'::timestamp END ASC,
        t.priority DESC;
    `);
    console.log('✅ Created pending_todos_view');

    // Show final statistics
    console.log('\n📊 Table statistics:');
    const statsResult = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
        (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') as total_views
    `);

    const stats = statsResult.rows[0];
    console.log(`📋 Total tables: ${stats.total_tables}`);
    console.log(`👀 Total views: ${stats.total_views}`);

    console.log('\n🎉 Additional tables setup completed successfully!');
    console.log('\n📋 New tables created:');
    console.log('  • notes - structured notes with user ownership');
    console.log('  • calendar_events - calendar events and scheduling');
    console.log('  • todos - task management');
    console.log('  • tags - tag management');
    console.log('  • note_tags - notes-tags relationship');
    console.log('\n👀 Helpful views created:');
    console.log('  • active_notes_view - active notes with folder info');
    console.log('  • upcoming_events_view - upcoming calendar events');
    console.log('  • pending_todos_view - incomplete tasks');

  } catch (error) {
    console.error('❌ Additional tables setup failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

// Migrate existing data to new structure
async function migrateExistingData() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔄 Migrating existing data to new structure...\n');

    // Check if we have existing normalized data
    const hasNormalizedData = await pgPool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'notes_normalized'
      )
    `);

    if (!hasNormalizedData.rows[0].exists) {
      console.log('⚠️  No normalized data found, skipping migration');
      return;
    }

    // Migrate notes from normalized table
    console.log('📝 Migrating notes...');
    const notesResult = await pgPool.query(`
      SELECT * FROM notes_normalized 
      WHERE is_deleted = FALSE
      ORDER BY created_at
    `);

    let notesMigrated = 0;
    for (const note of notesResult.rows) {
      try {
        // Extract user_id (assuming first user for now)
        const userIdResult = await pgPool.query('SELECT id FROM users LIMIT 1');
        const userId = userIdResult.rows[0]?.id || 'default-user';

        await pgPool.query(`
          INSERT INTO notes (
            id, user_id, title, content, folder_id, tags, 
            is_pinned, is_archived, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at
        `, [
          note.id,
          userId,
          note.title || 'Untitled Note',
          note.content || '',
          note.folder_id,
          note.tags || [],
          false,
          note.is_deleted ? true : false,
          note.created_at,
          note.updated_at
        ]);

        notesMigrated++;
      } catch (error) {
        console.log(`⚠️  Error migrating note ${note.id}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${notesMigrated} notes`);

    // Migrate folders
    console.log('📁 Migrating folders...');
    const foldersResult = await pgPool.query(`
      SELECT * FROM folders_normalized 
      WHERE is_deleted = FALSE
      ORDER BY created_at
    `);

    let foldersMigrated = 0;
    for (const folder of foldersResult.rows) {
      try {
        // Create simplified folders table if it doesn't exist
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

        const userIdResult = await pgPool.query('SELECT id FROM users LIMIT 1');
        const userId = userIdResult.rows[0]?.id || 'default-user';

        await pgPool.query(`
          INSERT INTO folders (id, user_id, name, parent_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            updated_at = EXCLUDED.updated_at
        `, [
          folder.id,
          userId,
          folder.name || 'Untitled Folder',
          folder.parent_id,
          folder.created_at,
          folder.updated_at
        ]);

        foldersMigrated++;
      } catch (error) {
        console.log(`⚠️  Error migrating folder ${folder.id}:`, error.message);
      }
    }
    console.log(`✅ Migrated ${foldersMigrated} folders`);

    console.log('\n🎉 Data migration completed!');

  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
  } finally {
    await pgPool.end();
  }
}

async function main() {
  try {
    await setupAdditionalTables();
    await migrateExistingData();
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupAdditionalTables, migrateExistingData };