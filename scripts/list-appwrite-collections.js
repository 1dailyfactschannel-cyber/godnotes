#!/usr/bin/env node

const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.migration' });

// Appwrite configuration
const appwriteClient = new Client();
appwriteClient
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);

async function listCollections() {
  try {
    console.log('🔍 Getting list of collections from Appwrite...\n');
    
    const response = await databases.listCollections(
      process.env.APPWRITE_DATABASE_ID
    );
    
    const collections = response.collections;
    
    if (collections.length === 0) {
      console.log('📭 No collections found in the database');
      return;
    }
    
    console.log(`📋 Found ${collections.length} collections:\n`);
    
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
      console.log(`   ID: ${collection.$id}`);
      console.log(`   Documents: ${collection.documentsCount}`);
      console.log(`   Created: ${new Date(collection.$createdAt).toLocaleString()}`);
      console.log('');
    });
    
    console.log('🔧 Suggested mapping for .env.migration:');
    console.log('COLLECTIONS_MAPPING=[');
    collections.forEach((collection, index) => {
      const isLast = index === collections.length - 1;
      console.log(`  {"appwriteId": "${collection.$id}", "postgresTable": "${collection.name.toLowerCase()}"}${isLast ? '' : ','}`);
    });
    console.log(']');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listCollections();