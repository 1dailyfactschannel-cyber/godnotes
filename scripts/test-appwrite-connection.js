#!/usr/bin/env node

const { Client, Databases, Health } = require('node-appwrite');
require('dotenv').config({ path: '.env.migration' });

async function testAppwriteConnection() {
  try {
    console.log('🔍 Testing Appwrite connection...\n');
    
    const client = new Client();
    client
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const health = new Health(client);
    
    // Test basic connectivity
    console.log('📡 Testing basic connectivity...');
    try {
      const healthCheck = await health.get();
      console.log('✅ Health check passed');
    } catch (error) {
      console.log('⚠️  Health check failed:', error.message);
    }
    
    // Test database access
    console.log('\n📚 Testing database access...');
    try {
      const dbList = await databases.list();
      console.log(`✅ Database access OK, found ${dbList.total} databases`);
    } catch (error) {
      console.log('❌ Database access failed:', error.message);
      return;
    }
    
    // Test specific database
    console.log('\n📂 Testing target database...');
    try {
      const collections = await databases.listCollections(process.env.APPWRITE_DATABASE_ID);
      console.log(`✅ Database '${process.env.APPWRITE_DATABASE_ID}' accessible`);
      console.log(`📊 Collections found: ${collections.total}`);
      
      collections.collections.forEach((collection, index) => {
        console.log(`  ${index + 1}. ${collection.name} (${collection.$id}) - ${collection.documentsCount || 0} documents`);
      });
      
    } catch (error) {
      console.log(`❌ Database '${process.env.APPWRITE_DATABASE_ID}' access failed:`, error.message);
      return;
    }
    
    // Test document access for each collection
    console.log('\n📄 Testing document access...');
    const collections = await databases.listCollections(process.env.APPWRITE_DATABASE_ID);
    
    for (const collection of collections.collections) {
      try {
        const documents = await databases.listDocuments(
          process.env.APPWRITE_DATABASE_ID,
          collection.$id,
          []
        );
        console.log(`  ✅ ${collection.name}: ${documents.total} documents accessible`);
      } catch (error) {
        console.log(`  ❌ ${collection.name}: Document access failed - ${error.message}`);
      }
    }
    
    console.log('\n🎉 All connection tests completed!');
    
  } catch (error) {
    console.error('💥 Connection test failed:', error.message);
    console.error('Error details:', error);
  }
}

testAppwriteConnection();