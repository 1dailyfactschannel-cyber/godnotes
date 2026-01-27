#!/usr/bin/env node

// Manual data export script using direct HTTP requests
const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.migration' });

function makeAppwriteRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cloud.appwrite.io',
      port: 443,
      path: `/v1${path}`,
      method: 'GET',
      headers: {
        'X-Appwrite-Project': process.env.APPWRITE_PROJECT_ID,
        'X-Appwrite-Key': process.env.APPWRITE_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function exportAppwriteData() {
  try {
    console.log('📥 Exporting data from Appwrite...\n');
    
    // Get collections
    console.log('📚 Getting collections...');
    const databaseResponse = await makeAppwriteRequest(`/databases/${process.env.APPWRITE_DATABASE_ID}/collections`);
    const collections = databaseResponse.collections || [];
    
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`  • ${col.name} (${col.$id})`);
    });
    
    // Export data from each collection
    const exportedData = {};
    
    for (const collection of collections) {
      console.log(`\n📥 Exporting ${collection.name}...`);
      exportedData[collection.$id] = [];
      
      let offset = 0;
      const limit = 100;
      
      while (true) {
        try {
          const documentsResponse = await makeAppwriteRequest(
            `/databases/${process.env.APPWRITE_DATABASE_ID}/collections/${collection.$id}/documents?limit=${limit}&offset=${offset}`
          );
          
          const documents = documentsResponse.documents || [];
          if (documents.length === 0) break;
          
          exportedData[collection.$id].push(...documents);
          console.log(`  Fetched ${documents.length} documents (total: ${exportedData[collection.$id].length})`);
          
          if (documents.length < limit) break;
          offset += limit;
          
        } catch (error) {
          console.log(`  ❌ Error fetching documents: ${error.message}`);
          break;
        }
      }
    }
    
    // Save to files
    const fs = require('fs');
    fs.writeFileSync('appwrite-export.json', JSON.stringify(exportedData, null, 2));
    console.log('\n💾 Data exported to appwrite-export.json');
    
    // Show summary
    console.log('\n📊 Export summary:');
    Object.entries(exportedData).forEach(([collectionId, documents]) => {
      const collection = collections.find(c => c.$id === collectionId);
      console.log(`  ${collection?.name || collectionId}: ${documents.length} documents`);
    });
    
    return exportedData;
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

async function importToPostgreSQL(exportedData) {
  try {
    console.log('\n📤 Importing to PostgreSQL...');
    
    const pgPool = new Pool({
      host: process.env.POSTGRES_HOST || '89.208.14.253',
      port: parseInt(process.env.POSTGRES_PORT) || 5433,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'godnotes'
    });
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await pgPool.query('TRUNCATE TABLE notes, folders RESTART IDENTITY CASCADE');
    
    // Import data
    for (const [collectionId, documents] of Object.entries(exportedData)) {
      const tableName = collectionId === 'notes' ? 'notes' : 'folders';
      console.log(`📥 Importing ${documents.length} documents to ${tableName}...`);
      
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
      
      console.log(`  ✅ Imported ${documents.length} documents to ${tableName}`);
    }
    
    await pgPool.end();
    console.log('\n🎉 Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting manual Appwrite to PostgreSQL transfer...\n');
    
    // Export data
    const exportedData = await exportAppwriteData();
    
    // Import to PostgreSQL
    await importToPostgreSQL(exportedData);
    
    // Verify
    console.log('\n🔍 Verifying imported data...');
    const { execSync } = require('child_process');
    execSync('node check-migrated-data.js', { stdio: 'inherit' });
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { exportAppwriteData, importToPostgreSQL };