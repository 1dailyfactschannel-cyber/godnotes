#!/usr/bin/env node

const { Client, Databases } = require('node-appwrite');
const { Pool } = require('pg');
require('dotenv').config();

// Appwrite configuration
const appwriteClient = new Client();
appwriteClient
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'YOUR_APPWRITE_ENDPOINT')
  .setProject(process.env.APPWRITE_PROJECT_ID || 'YOUR_PROJECT_ID')
  .setKey(process.env.APPWRITE_API_KEY || 'YOUR_API_KEY');

const databases = new Databases(appwriteClient);

// PostgreSQL configuration
const pgPool = new Pool({
  host: '89.208.14.253',
  port: 5433,
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'YourSecurePassword123!',
  database: 'godnotes'
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

async function main() {
  try {
    console.log('🚀 Starting Appwrite to PostgreSQL migration...');
    
    // Define your collections mapping
    const collectionsMap = [
      { appwriteId: 'notes', postgresTable: 'notes' },
      { appwriteId: 'users', postgresTable: 'users' },
      { appwriteId: 'tags', postgresTable: 'tags' },
      // Add more collections as needed
    ];
    
    // Migrate each collection
    for (const collection of collectionsMap) {
      await migrateCollection(collection.appwriteId, collection.postgresTable);
    }
    
    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pgPool.end();
  }
}

// Run migration
if (require.main === module) {
  main();
}

module.exports = { migrateCollection, main };