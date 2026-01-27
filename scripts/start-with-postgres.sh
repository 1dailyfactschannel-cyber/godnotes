#!/bin/bash

# Script to start GodNotes with PostgreSQL configuration

echo "🚀 Starting GodNotes with PostgreSQL configuration..."

# Check if PostgreSQL is accessible
echo "🔍 Checking PostgreSQL connection..."
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL connection OK'))
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
"

if [ $? -ne 0 ]; then
  echo "💥 Cannot connect to PostgreSQL. Please check your configuration."
  exit 1
fi

# Start the application
echo "🎮 Starting GodNotes application..."
cd ..
npm run dev