#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function inspectActiveViews() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Инспекция активных представлений\n');
    
    // Активные заметки
    console.log('📄 АКТИВНЫЕ ЗАМЕТКИ (active_notes):');
    const activeNotesCount = await pool.query('SELECT COUNT(*) FROM active_notes');
    console.log(`Всего записей: ${activeNotesCount.rows[0].count}`);
    
    if (activeNotesCount.rows[0].count > 0) {
      const sampleActiveNotes = await pool.query(`
        SELECT id, user_id, title, folder_id, is_pinned, is_favorite, created_at 
        FROM active_notes 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log('\nПоследние 5 записей:');
      sampleActiveNotes.rows.forEach((note, i) => {
        console.log(`${i + 1}. "${note.title}"`);
        console.log(`   ID: ${note.id}`);
        console.log(`   User: ${note.user_id}`);
        console.log(`   Folder: ${note.folder_id || 'root'}`);
        console.log(`   Pinned: ${note.is_pinned ? '✓' : '✗'}, Favorite: ${note.is_favorite ? '✓' : '✗'}`);
        console.log(`   Created: ${new Date(note.created_at).toLocaleString('ru-RU')}\n`);
      });
    }
    
    console.log('=' .repeat(60) + '\n');
    
    // Активные папки
    console.log('📁 АКТИВНЫЕ ПАПКИ (active_folders):');
    const activeFoldersCount = await pool.query('SELECT COUNT(*) FROM active_folders');
    console.log(`Всего записей: ${activeFoldersCount.rows[0].count}`);
    
    if (activeFoldersCount.rows[0].count > 0) {
      const sampleActiveFolders = await pool.query(`
        SELECT id, user_id, name, parent_id, is_favorite, created_at 
        FROM active_folders 
        ORDER BY name 
        LIMIT 5
      `);
      
      console.log('\nПримеры папок:');
      sampleActiveFolders.rows.forEach((folder, i) => {
        console.log(`${i + 1}. "${folder.name}"`);
        console.log(`   ID: ${folder.id}`);
        console.log(`   User: ${folder.user_id}`);
        console.log(`   Parent: ${folder.parent_id || 'root'}`);
        console.log(`   Favorite: ${folder.is_favorite ? '✓' : '✗'}`);
        console.log(`   Created: ${new Date(folder.created_at).toLocaleString('ru-RU')}\n`);
      });
    }
    
    console.log('=' .repeat(60) + '\n');
    
    // Статистика по пользователям
    console.log('👥 СТАТИСТИКА ПОЛЬЗОВАТЕЛЕЙ:');
    const userStats = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        COUNT(n.id) as notes_count,
        COUNT(f.id) as folders_count
      FROM users u
      LEFT JOIN active_notes n ON u.id = n.user_id
      LEFT JOIN active_folders f ON u.id = f.user_id
      GROUP BY u.id, u.email, u.name
      ORDER BY notes_count DESC
    `);
    
    console.log('По пользователям:');
    userStats.rows.forEach(user => {
      console.log(`• ${user.name} (${user.email})`);
      console.log(`  Заметок: ${user.notes_count}, Папок: ${user.folders_count}\n`);
    });
    
    // Проверим normalized таблицы
    console.log('=' .repeat(60) + '\n');
    console.log('📊 NORMALIZED ТАБЛИЦЫ:');
    
    try {
      const normalizedNotes = await pool.query('SELECT COUNT(*) FROM notes_normalized');
      console.log(`notes_normalized: ${normalizedNotes.rows[0].count} записей`);
    } catch (err) {
      console.log(`notes_normalized: ошибка - ${err.message}`);
    }
    
    try {
      const normalizedFolders = await pool.query('SELECT COUNT(*) FROM folders_normalized');
      console.log(`folders_normalized: ${normalizedFolders.rows[0].count} записей`);
    } catch (err) {
      console.log(`folders_normalized: ошибка - ${err.message}`);
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

inspectActiveViews();
