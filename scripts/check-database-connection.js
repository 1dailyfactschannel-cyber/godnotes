#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function checkDatabaseConnection() {
  console.log('🔍 Проверка подключения к базе данных...\n');
  
  // Проверяем DATABASE_URL из .env
  if (!process.env.DATABASE_URL) {
    console.log('❌ Переменная DATABASE_URL не найдена в .env файле');
    console.log('Проверьте файл .env в корневой директории проекта\n');
    
    // Покажем конфигурацию из .env.migration как пример
    console.log('🔧 Конфигурация из .env.migration:');
    require('dotenv').config({ path: '.env.migration' });
    console.log(`POSTGRES_HOST: ${process.env.POSTGRES_HOST}`);
    console.log(`POSTGRES_PORT: ${process.env.POSTGRES_PORT}`);
    console.log(`POSTGRES_DB: ${process.env.POSTGRES_DB}`);
    console.log(`POSTGRES_USER: ${process.env.POSTGRES_USER}`);
    console.log('(пароль скрыт для безопасности)\n');
    return;
  }

  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Таймаут подключения
    connectionTimeoutMillis: 5000
  });

  try {
    // Проверка подключения
    console.log('🔌 Проверка подключения...');
    const client = await pool.connect();
    console.log('✅ Подключение успешно установлено!\n');
    
    // Получаем информацию о базе данных
    const dbInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log('📊 Информация о базе данных:');
    console.log(`  База данных: ${dbInfo.rows[0].current_database}`);
    console.log(`  Пользователь: ${dbInfo.rows[0].current_user}`);
    console.log(`  Версия: ${dbInfo.rows[0].version.split('on')[0].trim()}\n`);
    
    // Проверяем существующие таблицы
    console.log('📋 Существующие таблицы:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 0) {
      console.log('  Нет таблиц в схеме public');
    } else {
      tables.rows.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
    }
    
    console.log('');
    
    // Проверяем основные таблицы приложения
    const appTables = ['users', 'notes', 'folders', 'sessions'];
    console.log('🔍 Статус основных таблиц приложения:');
    
    for (const table of appTables) {
      try {
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          )
        `, [table]);
        
        if (exists.rows[0].exists) {
          const count = await client.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`  ✅ ${table}: ${count.rows[0].count} записей`);
        } else {
          console.log(`  ❌ ${table}: таблица отсутствует`);
        }
      } catch (err) {
        console.log(`  ⚠️  ${table}: ошибка проверки - ${err.message}`);
      }
    }
    
    client.release();
    
  } catch (error) {
    console.log('❌ Ошибка подключения к базе данных:');
    console.log(`   Сообщение: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   Причина: Сервер не отвечает (возможно, выключен или неверный порт)');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   Причина: Не удалось найти хост (неверное имя хоста или DNS)');
    } else if (error.code === '28P01') {
      console.log('   Причина: Неверный пароль пользователя');
    } else if (error.code === '3D000') {
      console.log('   Причина: База данных не существует');
    } else if (error.code === '28000') {
      console.log('   Причина: Неверное имя пользователя');
    }
    
    console.log('\n🔧 Возможные решения:');
    console.log('  1. Проверьте параметры подключения в .env файле');
    console.log('  2. Убедитесь, что PostgreSQL сервер запущен');
    console.log('  3. Проверьте сетевой доступ к серверу');
    console.log('  4. Убедитесь, что указанный пользователь имеет доступ к базе данных');
    
  } finally {
    await pool.end();
  }
}

// Также проверим конфигурацию из .env.migration
async function checkMigrationConfig() {
  console.log('\n' + '='.repeat(50));
  console.log('🔧 Проверка конфигурации миграции (.env.migration):\n');
  
  require('dotenv').config({ path: '.env.migration' });
  
  console.log('Appwrite:');
  console.log(`  Endpoint: ${process.env.APPWRITE_ENDPOINT}`);
  console.log(`  Project ID: ${process.env.APPWRITE_PROJECT_ID}`);
  console.log(`  Database ID: ${process.env.APPWRITE_DATABASE_ID}\n`);
  
  console.log('PostgreSQL:');
  console.log(`  Host: ${process.env.POSTGRES_HOST}`);
  console.log(`  Port: ${process.env.POSTGRES_PORT}`);
  console.log(`  Database: ${process.env.POSTGRES_DB}`);
  console.log(`  User: ${process.env.POSTGRES_USER}`);
  console.log('  Password: *** (скрыт для безопасности)\n');
  
  // Пробуем подключиться с этими параметрами
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_DB) {
    console.log('🔌 Проверка подключения по параметрам из .env.migration...');
    
    const directPool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      connectionTimeoutMillis: 5000
    });
    
    try {
      const client = await directPool.connect();
      console.log('✅ Подключение успешно установлено!\n');
      client.release();
    } catch (error) {
      console.log('❌ Ошибка подключения:');
      console.log(`   ${error.message}\n`);
    } finally {
      await directPool.end();
    }
  }
}

async function main() {
  await checkDatabaseConnection();
  await checkMigrationConfig();
  console.log('\n🏁 Проверка завершена.');
}

main().catch(console.error);
