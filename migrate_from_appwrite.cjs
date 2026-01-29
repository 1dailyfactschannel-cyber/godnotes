const { Pool } = require('pg');
const { Client, Databases, Users } = require('node-appwrite');

// PostgreSQL connection
const pgPool = new Pool({ 
  connectionString: 'postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes' 
});

// Appwrite connection
const appwriteClient = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('696f3047000b49d7776e')
    .setKey('standard_976835a8125ae088f5e9eb69fa4e38532eed693da3d103b04010afb08fd4018d33043a4bc5dc0136eb4d74925c84296d7155a2c6d2f61926b9428f70e51856b6b2b4ec7107829e9d191befe5c3ccb8d41ddb59064698b9faa76f20c337acd4891b9400520c4a73b67c778d1212301000840d81a5a6b38c4085d13affae11a697');

const databases = new Databases(appwriteClient);
const appwriteUsers = new Users(appwriteClient);

async function migrateData() {
  try {
    console.log('🚀 Начинаю миграцию данных из Appwrite в PostgreSQL...\n');
    
    // Получим всех пользователей из Appwrite
    console.log('📥 Получаю пользователей из Appwrite...');
    const appwriteUserList = await appwriteUsers.list();
    console.log(`Найдено пользователей в Appwrite: ${appwriteUserList.users.length}`);
    
    // Создадим соответствие между Appwrite ID и PostgreSQL ID
    const userIdMapping = new Map();
    
    // Переносим пользователей
    console.log('\n👥 Переношу пользователей...');
    for (const appwriteUser of appwriteUserList.users) {
      try {
        // Проверим, существует ли такой пользователь в PostgreSQL
        const existingUser = await pgPool.query(
          'SELECT id FROM users WHERE email = $1',
          [appwriteUser.email]
        );
        
        let pgUserId;
        if (existingUser.rows.length > 0) {
          pgUserId = existingUser.rows[0].id;
          console.log(`  ✅ Пользователь ${appwriteUser.email} уже существует (ID: ${pgUserId})`);
        } else {
          // Создаем нового пользователя
          const newUser = await pgPool.query(
            `INSERT INTO users (id, email, name, password, created_at, updated_at, is_active, is_verified)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, false)
             RETURNING id`,
            [
              appwriteUser.email,
              appwriteUser.name || appwriteUser.email.split('@')[0],
              '$2a$10$example_hash_placeholder', // временный хеш
              new Date(appwriteUser.$createdAt),
              new Date(appwriteUser.$updatedAt)
            ]
          );
          pgUserId = newUser.rows[0].id;
          console.log(`  ➕ Создан пользователь ${appwriteUser.email} (новый ID: ${pgUserId})`);
        }
        
        userIdMapping.set(appwriteUser.$id, pgUserId);
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке пользователя ${appwriteUser.email}:`, error.message);
      }
    }
    
    console.log(`\nСоздано соответствие для ${userIdMapping.size} пользователей`);
    
    // Переносим папки
    console.log('\n📁 Переношу папки...');
    let foldersMigrated = 0;
    try {
      const appwriteFolders = await databases.listDocuments('godnotes-db', 'folders');
      console.log(`Найдено папок в Appwrite: ${appwriteFolders.total}`);
      
      for (const folder of appwriteFolders.documents) {
        try {
          const pgUserId = userIdMapping.get(folder.userId);
          if (!pgUserId) {
            console.log(`  ⚠️  Пропущена папка "${folder.name}" - пользователь не найден`);
            continue;
          }
          
          // Проверим, существует ли такая папка
          const existingFolder = await pgPool.query(
            'SELECT id FROM folders WHERE user_id = $1 AND name = $2',
            [pgUserId, folder.name]
          );
          
          if (existingFolder.rows.length === 0) {
            await pgPool.query(
              `INSERT INTO folders (id, user_id, name, parent_id, created_at, updated_at, is_deleted, is_favorite)
               VALUES ($1, $2, $3, $4, $5, $6, false, false)`,
              [
                folder.$id,
                pgUserId,
                folder.name,
                folder.parentId || null,
                new Date(folder.$createdAt),
                new Date(folder.$updatedAt)
              ]
            );
            foldersMigrated++;
          }
        } catch (error) {
          console.error(`  ❌ Ошибка при переносе папки "${folder.name}":`, error.message);
        }
      }
      console.log(`  ✅ Перенесено папок: ${foldersMigrated}`);
    } catch (error) {
      console.error('Ошибка при получении папок:', error.message);
    }
    
    // Переносим заметки
    console.log('\n📝 Переношу заметки...');
    let notesMigrated = 0;
    try {
      const appwriteNotes = await databases.listDocuments('godnotes-db', 'notes');
      console.log(`Найдено заметок в Appwrite: ${appwriteNotes.total}`);
      
      for (const note of appwriteNotes.documents) {
        try {
          const pgUserId = userIdMapping.get(note.userId);
          if (!pgUserId) {
            console.log(`  ⚠️  Пропущена заметка "${note.title}" - пользователь не найден`);
            continue;
          }
          
          // Проверим, существует ли такая заметка
          const existingNote = await pgPool.query(
            'SELECT id FROM notes WHERE user_id = $1 AND title = $2',
            [pgUserId, note.title]
          );
          
          if (existingNote.rows.length === 0) {
            await pgPool.query(
              `INSERT INTO notes (id, user_id, title, content, folder_id, created_at, updated_at, is_deleted, is_favorite, is_pinned, is_archived, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, $8, false, $9)`,
              [
                note.$id,
                pgUserId,
                note.title,
                note.content || '',
                note.folderId || null,
                new Date(note.$createdAt),
                new Date(note.$updatedAt),
                note.isPinned || false,
                note.priority || 0
              ]
            );
            notesMigrated++;
          }
        } catch (error) {
          console.error(`  ❌ Ошибка при переносе заметки "${note.title}":`, error.message);
        }
      }
      console.log(`  ✅ Перенесено заметок: ${notesMigrated}`);
    } catch (error) {
      console.error('Ошибка при получении заметок:', error.message);
    }
    
    // Проверим результат
    console.log('\n📊 Результат миграции:');
    const finalStats = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM folders) as total_folders,
        (SELECT COUNT(*) FROM notes) as total_notes
    `);
    
    console.log(`  👤 Пользователей: ${finalStats.rows[0].total_users}`);
    console.log(`  📁 Папок: ${finalStats.rows[0].total_folders}`);
    console.log(`  📝 Заметок: ${finalStats.rows[0].total_notes}`);
    
    console.log('\n✅ Миграция завершена успешно!');
    
  } catch (error) {
    console.error('💥 Ошибка миграции:', error.message);
    console.error(error.stack);
  } finally {
    await pgPool.end();
  }
}

migrateData();