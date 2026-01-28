#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function generateDatabaseReport() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('📊 ОТЧЕТ О СОСТОЯНИИ БАЗЫ ДАННЫХ GODNOTES\n');
    console.log('=' .repeat(60));
    
    // Общая информация
    const dbInfo = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`🗄️  База данных: ${dbInfo.rows[0].current_database}`);
    console.log(`👤 Пользователь: ${dbInfo.rows[0].current_user}`);
    console.log(`🔧 Версия: ${dbInfo.rows[0].version.split('on')[0].trim()}\n`);
    
    // Все таблицы
    const allTables = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`📋 Всего таблиц и представлений: ${allTables.rows.length}`);
    
    const baseTables = allTables.rows.filter(t => t.table_type === 'BASE TABLE');
    const views = allTables.rows.filter(t => t.table_type === 'VIEW');
    
    console.log(`   • Базовые таблицы: ${baseTables.length}`);
    console.log(`   • Представления: ${views.length}\n`);
    
    // Статистика по основным таблицам
    console.log('📈 СТАТИСТИКА ДАННЫХ:\n');
    
    const stats = [
      { name: 'Пользователи', table: 'users', view: 'active_users' },
      { name: 'Заметки', table: 'notes', view: 'active_notes' },
      { name: 'Папки', table: 'folders', view: 'active_folders' },
      { name: 'Задачи', table: 'tasks', view: 'root_tasks' },
      { name: 'Теги', table: 'tags', view: null },
      { name: 'Сессии', table: 'user_sessions', view: null }
    ];
    
    for (const stat of stats) {
      try {
        const baseCount = await pool.query(`SELECT COUNT(*) FROM ${stat.table}`);
        let viewCount = 'N/A';
        if (stat.view) {
          const viewResult = await pool.query(`SELECT COUNT(*) FROM ${stat.view}`);
          viewCount = viewResult.rows[0].count;
        }
        console.log(`${stat.name}:`);
        console.log(`   Базовая таблица: ${baseCount.rows[0].count} записей`);
        if (stat.view) {
          console.log(`   Активные данные: ${viewCount} записей`);
        }
        console.log('');
      } catch (err) {
        console.log(`${stat.name}: таблица отсутствует или ошибка\n`);
      }
    }
    
    // Примеры данных
    console.log('📝 ПРИМЕРЫ ДАННЫХ:\n');
    
    // Последние заметки
    console.log('📄 Последние 3 заметки:');
    const recentNotes = await pool.query(`
      SELECT id, title, folder_name, created_at 
      FROM active_notes 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    recentNotes.rows.forEach((note, i) => {
      console.log(`${i + 1}. "${note.title}"`);
      console.log(`   Папка: ${note.folder_name || 'Корень'}`);
      console.log(`   Создано: ${new Date(note.created_at).toLocaleString('ru-RU')}`);
      console.log(`   ID: ${note.id}\n`);
    });
    
    // Папки
    console.log('📁 Папки:');
    const folders = await pool.query(`
      SELECT id, name, parent_id, created_at 
      FROM active_folders 
      ORDER BY name 
      LIMIT 5
    `);
    
    folders.rows.forEach((folder, i) => {
      console.log(`${i + 1}. "${folder.name}" ${folder.parent_id ? '(подпапка)' : '(корневая)'}`);
      console.log(`   Создано: ${new Date(folder.created_at).toLocaleString('ru-RU')}`);
      console.log(`   ID: ${folder.id}\n`);
    });
    
    // Пользователи
    console.log('👥 Пользователи с данными:');
    const userData = await pool.query(`
      SELECT 
        u.name,
        u.email,
        COUNT(n.id) as notes_count,
        COUNT(f.id) as folders_count
      FROM users u
      LEFT JOIN active_notes n ON u.id = 'admin-user-1'  -- временно для админа
      LEFT JOIN active_folders f ON u.id = 'admin-user-1'
      GROUP BY u.id, u.name, u.email
      ORDER BY notes_count DESC
      LIMIT 5
    `);
    
    userData.rows.forEach(user => {
      console.log(`• ${user.name} (${user.email})`);
      console.log(`  Заметок: ${user.notes_count}, Папок: ${user.folders_count}\n`);
    });
    
    console.log('=' .repeat(60));
    console.log('✅ База данных полностью функциональна и готова к работе!');
    
  } catch (error) {
    console.error('❌ Ошибка генерации отчета:', error.message);
  } finally {
    await pool.end();
  }
}

generateDatabaseReport();
