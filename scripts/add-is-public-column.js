#!/usr/bin/env node

const { Pool } = require('pg');

// Manually parse DATABASE_URL to handle special characters
const DATABASE_URL = process.env.DATABASE_URL?.replace(/^"(.*)"$/, '$1') || 
                    'postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes';

async function addIsPublicColumn() {
  const pgPool = new Pool({
    connectionString: DATABASE_URL
  });

  try {
    console.log('🔍 Adding is_public column to notes table...\n');
    
    // Test connection first
    await pgPool.query('SELECT NOW()');
    console.log('✅ Connected to database successfully');
    
    // Check if column already exists
    const columnExists = await pgPool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notes' 
        AND column_name = 'is_public'
      )
    `);
    
    if (columnExists.rows[0].exists) {
      console.log('✅ Column is_public already exists');
      return;
    }
    
    // Add the column
    await pgPool.query(`
      ALTER TABLE notes 
      ADD COLUMN is_public BOOLEAN DEFAULT FALSE NOT NULL
    `);
    
    console.log('✅ Added is_public column to notes table');
    console.log('📝 Set default value to FALSE for all existing notes');
    
    // Verify the change
    const verify = await pgPool.query(`
      SELECT COUNT(*) as total_notes,
             COUNT(*) FILTER (WHERE is_public = TRUE) as public_notes,
             COUNT(*) FILTER (WHERE is_public = FALSE) as private_notes
      FROM notes
    `);
    
    const stats = verify.rows[0];
    console.log('\n📊 Verification:');
    console.log(`   Total notes: ${stats.total_notes}`);
    console.log(`   Public notes: ${stats.public_notes}`);
    console.log(`   Private notes: ${stats.private_notes}`);
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pgPool.end();
  }
}

if (require.main === module) {
  addIsPublicColumn().catch(error => {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  });
}

module.exports = { addIsPublicColumn };