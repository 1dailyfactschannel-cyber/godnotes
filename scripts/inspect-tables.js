#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function inspectTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Инспекция таблиц notes и folders\n');
    
    // Структура таблицы notes
    console.log('📄 Таблица NOTES:');
    const notesStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'notes' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Структура:');
    notesStructure.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
    // Содержимое таблицы notes
    const notesCount = await pool.query('SELECT COUNT(*) FROM notes');
    console.log(`\nЗаписей: ${notesCount.rows[0].count}`);
    
    if (notesCount.rows[0].count > 0) {
      const sampleNotes = await pool.query('SELECT * FROM notes LIMIT 3');
      console.log('\nПримеры записей:');
      sampleNotes.rows.forEach((note, i) => {
        console.log(`\n  Запись ${i + 1}:`);
        Object.entries(note).forEach(([key, value]) => {
          if (key === 'data' && value) {
            console.log(`    ${key}: JSON (${typeof value === 'object' ? Object.keys(value).length + ' свойств' : 'пусто'})`);
          } else {
            console.log(`    ${key}: ${value}`);
          }
        });
      });
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Структура таблицы folders
    console.log('📁 Таблица FOLDERS:');
    const foldersStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'folders' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Структура:');
    foldersStructure.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
    // Содержимое таблицы folders
    const foldersCount = await pool.query('SELECT COUNT(*) FROM folders');
    console.log(`\nЗаписей: ${foldersCount.rows[0].count}`);
    
    if (foldersCount.rows[0].count > 0) {
      const sampleFolders = await pool.query('SELECT * FROM folders LIMIT 3');
      console.log('\nПримеры записей:');
      sampleFolders.rows.forEach((folder, i) => {
        console.log(`\n  Запись ${i + 1}:`);
        Object.entries(folder).forEach(([key, value]) => {
          if (key === 'data' && value) {
            console.log(`    ${key}: JSON (${typeof value === 'object' ? Object.keys(value).length + ' свойств' : 'пусто'})`);
          } else {
            console.log(`    ${key}: ${value}`);
          }
        });
      });
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Проверим активные представления
    console.log('⚡ Активные представления:');
    const activeViews = ['active_notes', 'active_folders', 'active_users'];
    
    for (const view of activeViews) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${view}`);
        console.log(`  ${view}: ${count.rows[0].count} записей`);
      } catch (err) {
        console.log(`  ${view}: ошибка - ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

inspectTables();
