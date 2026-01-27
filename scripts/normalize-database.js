#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function normalizeTables() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Starting database normalization...\n');

    // Create normalized tables structure
    console.log('🏗️  Creating normalized table structures...\n');

    // Folders table (create first since notes reference it)
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS folders_normalized (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders_normalized(id),
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        appwrite_data JSONB
      );
    `);
    console.log('✅ Created folders_normalized table');

    // Notes table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS notes_normalized (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        folder_id TEXT REFERENCES folders_normalized(id),
        tags TEXT[],
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        appwrite_data JSONB
      );
    `);
    console.log('✅ Created notes_normalized table');

    // Clear existing normalized data
    console.log('\n🗑️  Clearing existing normalized data...');
    await pgPool.query('TRUNCATE TABLE notes_normalized, folders_normalized RESTART IDENTITY CASCADE');
    console.log('✅ Cleared normalized tables');

    // Normalize folders data
    console.log('\n📂 Normalizing folders data...');
    const foldersResult = await pgPool.query(`
      SELECT id, data, created_at, updated_at 
      FROM folders 
      ORDER BY created_at
    `);

    let foldersProcessed = 0;
    for (const row of foldersResult.rows) {
      try {
        const folderData = row.data;
        const insertQuery = `
          INSERT INTO folders_normalized (
            id, name, parent_id, is_deleted, created_at, updated_at, appwrite_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        // Extract data from Appwrite format
        const isDeleted = folderData.tags && folderData.tags.includes('deleted');
        const parentId = folderData.parentId || null;

        await pgPool.query(insertQuery, [
          folderData.$id || row.id,
          folderData.name || 'Untitled Folder',
          parentId,
          isDeleted,
          row.created_at,
          row.updated_at,
          folderData
        ]);

        foldersProcessed++;
      } catch (error) {
        console.log(`⚠️  Error processing folder ${row.id}:`, error.message);
      }
    }
    console.log(`✅ Processed ${foldersProcessed} folders`);

    // Normalize notes data
    console.log('\n📝 Normalizing notes data...');
    const notesResult = await pgPool.query(`
      SELECT id, data, created_at, updated_at 
      FROM notes 
      ORDER BY created_at
    `);

    let notesProcessed = 0;
    for (const row of notesResult.rows) {
      try {
        const noteData = row.data;
        const insertQuery = `
          INSERT INTO notes_normalized (
            id, title, content, folder_id, tags, is_deleted, created_at, updated_at, appwrite_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        // Extract data from Appwrite format
        const isDeleted = noteData.tags && (typeof noteData.tags === 'string' ? 
          noteData.tags.includes('deleted') : 
          Array.isArray(noteData.tags) && noteData.tags.includes('deleted'));
        
        let tags = [];
        if (noteData.tags) {
          if (typeof noteData.tags === 'string') {
            tags = noteData.tags.split(',').filter(tag => tag !== 'deleted' && tag.trim() !== '');
          } else if (Array.isArray(noteData.tags)) {
            tags = noteData.tags.filter(tag => tag !== 'deleted');
          }
        }
        
        const folderId = noteData.folderId || null;

        await pgPool.query(insertQuery, [
          noteData.$id || row.id,
          noteData.title || 'Untitled Note',
          noteData.content || '',
          folderId,
          tags,
          isDeleted,
          row.created_at,
          row.updated_at,
          noteData
        ]);

        notesProcessed++;
      } catch (error) {
        console.log(`⚠️  Error processing note ${row.id}:`, error.message);
      }
    }
    console.log(`✅ Processed ${notesProcessed} notes`);

    // Create indexes for better performance
    console.log('\n⚡ Creating indexes...');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes_normalized(folder_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes_normalized(is_deleted)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_folders_deleted ON folders_normalized(is_deleted)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders_normalized(parent_id)');
    console.log('✅ Created indexes');

    // Show final statistics
    console.log('\n📊 Final statistics:');
    const statsResult = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM folders_normalized) as folders_total,
        (SELECT COUNT(*) FROM folders_normalized WHERE is_deleted = TRUE) as folders_deleted,
        (SELECT COUNT(*) FROM notes_normalized) as notes_total,
        (SELECT COUNT(*) FROM notes_normalized WHERE is_deleted = TRUE) as notes_deleted
    `);

    const stats = statsResult.rows[0];
    console.log(`📁 Folders: ${stats.folders_total} total (${stats.folders_deleted} deleted)`);
    console.log(`📝 Notes: ${stats.notes_total} total (${stats.notes_deleted} deleted)`);

    console.log('\n🎉 Database normalization completed successfully!');
    console.log('\n📋 New tables created:');
    console.log('  • folders_normalized - normalized folder structure');
    console.log('  • notes_normalized - normalized note structure');
    console.log('\nYou can now query these tables with standard SQL!');

  } catch (error) {
    console.error('❌ Normalization failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

// Add view creation for easy querying
async function createViews() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n👀 Creating helpful views...\n');

    // Active folders view
    await pgPool.query(`
      CREATE OR REPLACE VIEW active_folders AS
      SELECT id, name, parent_id, created_at, updated_at
      FROM folders_normalized 
      WHERE is_deleted = FALSE
      ORDER BY name;
    `);
    console.log('✅ Created active_folders view');

    // Active notes view
    await pgPool.query(`
      CREATE OR REPLACE VIEW active_notes AS
      SELECT 
        n.id,
        n.title,
        n.content,
        n.folder_id,
        f.name as folder_name,
        n.tags,
        n.created_at,
        n.updated_at
      FROM notes_normalized n
      LEFT JOIN folders_normalized f ON n.folder_id = f.id
      WHERE n.is_deleted = FALSE
      ORDER BY n.updated_at DESC;
    `);
    console.log('✅ Created active_notes view');

    // Notes with folder hierarchy
    await pgPool.query(`
      CREATE OR REPLACE VIEW notes_with_hierarchy AS
      SELECT 
        n.id,
        n.title,
        n.content,
        n.folder_id,
        COALESCE(f.name, 'No Folder') as folder_name,
        n.tags,
        n.is_deleted,
        n.created_at,
        n.updated_at,
        CASE 
          WHEN f.parent_id IS NOT NULL THEN 
            (SELECT name FROM folders_normalized WHERE id = f.parent_id)
          ELSE NULL 
        END as parent_folder_name
      FROM notes_normalized n
      LEFT JOIN folders_normalized f ON n.folder_id = f.id
      ORDER BY f.name, n.title;
    `);
    console.log('✅ Created notes_with_hierarchy view');

    console.log('\n🎯 Helpful queries you can now run:');
    console.log('  SELECT * FROM active_folders;');
    console.log('  SELECT * FROM active_notes;');
    console.log('  SELECT * FROM notes_with_hierarchy;');
    console.log('  SELECT COUNT(*) FROM active_notes WHERE folder_id = \'some_folder_id\';');

  } catch (error) {
    console.error('❌ View creation failed:', error.message);
  } finally {
    await pgPool.end();
  }
}

async function main() {
  try {
    await normalizeTables();
    await createViews();
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { normalizeTables, createViews };