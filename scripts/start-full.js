#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting GodNotes Full Stack Application...\n');

// Start server
console.log('📡 Starting server...');
const server = spawn('npx', [
  'cross-env',
  'PORT=5009',
  'DATABASE_URL=postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes',
  'npx',
  'tsx',
  'server/index.ts'
], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});

// Start client after server is ready
setTimeout(() => {
  console.log('\n🖥️  Starting client...');
  const client = spawn('npm', ['run', 'dev:client'], {
    cwd: path.join(__dirname, '..', 'client'),
    stdio: 'inherit'
  });

  client.on('close', (code) => {
    console.log(`\nClient process exited with code ${code}`);
    server.kill();
  });
}, 3000);

server.on('close', (code) => {
  console.log(`\nServer process exited with code ${code}`);
});

console.log('\n✅ Both server and client are starting...');
console.log('🌐 Server will be available at: http://localhost:5009');
console.log('💻 Client will be available at: http://localhost:5010');
console.log('\nPress Ctrl+C to stop both processes\n');