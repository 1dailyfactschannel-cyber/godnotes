#!/usr/bin/env node

const { Client, Databases } = require('node-appwrite');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.migration' });

// Appwrite configuration
const appwriteClient = new Client();
appwriteClient
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

// PostgreSQL configuration
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || '89.208.14.253',
  port: parseInt(process.env.POSTGRES_PORT) || 5433,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'godnotes'
});

async function migrateCollection(collectionId, tableName) {
  console.log(`🔄 Migrating collection ${collectionId} to table ${tableName}`);
  
  try {
    // Get all documents from Appwrite collection
    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID || 'YOUR_DATABASE_ID',
      collectionId
    );
    
    const documents = response.documents;
    console.log(`Found ${documents.length} documents`);
    
    if (documents.length === 0) {
      console.log('No documents to migrate');
      return;
    }
    
    // Create table if not exists (basic structure)
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pgPool.query(createTableQuery);
    console.log(`✅ Table ${tableName} ready`);
    
    // Insert documents
    for (const doc of documents) {
      const insertQuery = `
        INSERT INTO ${tableName} (id, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at;
      `;
      
      await pgPool.query(insertQuery, [
        doc.$id,
        doc,
        new Date(doc.$createdAt),
        new Date(doc.$updatedAt)
      ]);
    }
    
    console.log(`✅ Migrated ${documents.length} documents to ${tableName}`);
    
  } catch (error) {
    console.error(`❌ Error migrating collection ${collectionId}:`, error.message);
  }
}

async function testConnections() {
  console.log('🔍 Testing connections...');
  
  try {
    // Test PostgreSQL connection
    const pgClient = await pgPool.connect();
    await pgClient.query('SELECT NOW()');
    pgClient.release();
    console.log('✅ PostgreSQL connection OK');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    throw error;
  }
  
  try {
    // Test Appwrite connection by listing databases
    await databases.list()
    console.log('✅ Appwrite connection OK');
  } catch (error) {
    console.error('❌ Appwrite connection failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting Appwrite to PostgreSQL migration...\n');
    
    // Test connections first
    await testConnections();
    
    // Parse collections mapping from env or use default
    let collectionsMap;
    try {
      const mappingStr = process.env.COLLECTIONS_MAPPING;
      if (mappingStr && mappingStr !== '[]') {
        collectionsMap = JSON.parse(mappingStr);
      } else {
        // Use actual collections from Appwrite if not specified
        console.log('📋 Getting actual collections from Appwrite...');
        const response = await databases.listCollections(
          process.env.APPWRITE_DATABASE_ID
        );
        collectionsMap = response.collections.map(collection => ({
          appwriteId: collection.$id,
          postgresTable: collection.name.toLowerCase()
        }));
      }
    } catch (e) {
      console.log('⚠️  Error parsing COLLECTIONS_MAPPING, using auto-discovery');
      // Auto-discover collections
      const response = await databases.listCollections(
        process.env.APPWRITE_DATABASE_ID
      );
      collectionsMap = response.collections.map(collection => ({
        appwriteId: collection.$id,
        postgresTable: collection.name.toLowerCase()
      }));
    }
    
    console.log(`📋 Migrating ${collectionsMap.length} collections:\n`);
    collectionsMap.forEach(c => {
      console.log(`  • ${c.appwriteId} → ${c.postgresTable}`);
    });
    console.log('');
    
    // Migrate each collection
    for (const collection of collectionsMap) {
      await migrateCollection(collection.appwriteId, collection.postgresTable);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    console.error('Please check your configuration in .env.migration file');
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run migration
if (require.main === module) {
  main();
}

module.exports = { migrateCollection, main };