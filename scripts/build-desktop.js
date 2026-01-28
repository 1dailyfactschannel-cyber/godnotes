#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building GodNotes Desktop Application...\n');

try {
  // Build the client
  console.log('📦 Building client...');
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  
  // Build the desktop app
  console.log('\n🖥️  Building desktop application...');
  execSync('npm run dist', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  
  console.log('\n✅ Build completed successfully!');
  
  // Check if build artifacts exist
  const releaseDir = path.join(__dirname, '..', 'dist-release-v1.3.1');
  if (fs.existsSync(releaseDir)) {
    console.log(`\n📁 Build artifacts located in: ${releaseDir}`);
    
    const files = fs.readdirSync(releaseDir);
    console.log('Files created:');
    files.forEach(file => {
      console.log(`  - ${file}`);
    });
  }
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}