#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function inspectViewStructure() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Структура активных представлений\n');
    
    // Проверим структуру active_notes
    console.log('📄 Структура active_notes:');
    try {
      const notesColumns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'active_notes' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      notesColumns.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } catch (err) {
      console.log(`  Ошибка: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(40) + '\n');
    
    // Проверим структуру active_folders
    console.log('📁 Структура active_folders:');
    try {
      const foldersColumns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'active_folders' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      foldersColumns.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } catch (err) {
      console.log(`  Ошибка: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(40) + '\n');
    
    // Посмотрим несколько записей из активных представлений
    console.log('📋 Примеры данных из active_notes:');
    try {
      const sampleNotes = await pool.query('SELECT * FROM active_notes LIMIT 2');
      if (sampleNotes.rows.length > 0) {
        const columns = Object.keys(sampleNotes.rows[0]);
        console.log('Колонки:', columns.join(', '));
        
        sampleNotes.rows.forEach((row, i) => {
          console.log(`\nЗапись ${i + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 100 ? 
              value.substring(0, 100) + '...' : value;
            console.log(`  ${key}: ${displayValue}`);
          });
        });
      }
    } catch (err) {
      console.log(`Ошибка: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(40) + '\n');
    
    console.log('📋 Примеры данных из active_folders:');
    try {
      const sampleFolders = await pool.query('SELECT * FROM active_folders LIMIT 2');
      if (sampleFolders.rows.length > 0) {
        const columns = Object.keys(sampleFolders.rows[0]);
        console.log('Колонки:', columns.join(', '));
        
        sampleFolders.rows.forEach((row, i) => {
          console.log(`\nЗапись ${i + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });
      }
    } catch (err) {
      console.log(`Ошибка: ${err.message}`);
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

inspectViewStructure();
