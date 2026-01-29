const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes' 
});

async function checkRecentActivity() {
  try {
    console.log('Последние изменения в базе данных:\n');
    
    // Проверим последние папки
    console.log('Последние 5 папок в системе:');
    const recentFolders = await pool.query(`
      SELECT f.id, f.name, f.created_at, u.email as user_email
      FROM folders f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT 5
    `);
    
    if (recentFolders.rows.length === 0) {
      console.log('Нет папок в базе');
    } else {
      recentFolders.rows.forEach(folder => {
        console.log('- ' + folder.name + ' (' + folder.id + ') от ' + folder.user_email + ' создано ' + folder.created_at);
      });
    }
    
    console.log('\nПоследние 5 заметок в системе:');
    const recentNotes = await pool.query(`
      SELECT n.id, n.title, n.created_at, u.email as user_email
      FROM notes n
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
      LIMIT 5
    `);
    
    if (recentNotes.rows.length === 0) {
      console.log('Нет заметок в базе');
    } else {
      recentNotes.rows.forEach(note => {
        console.log('- ' + note.title + ' (' + note.id + ') от ' + note.user_email + ' создано ' + note.created_at);
      });
    }
    
    // Проверим всех пользователей и их данные
    console.log('\nВсе пользователи системы:');
    const allUsers = await pool.query(`
      SELECT u.id, u.email, u.name, u.created_at,
             (SELECT COUNT(*) FROM folders f WHERE f.user_id = u.id) as folder_count,
             (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) as note_count
      FROM users u
      ORDER BY u.created_at
    `);
    
    allUsers.rows.forEach(user => {
      console.log('- ' + user.email + ' (' + user.name + '): ' + user.folder_count + ' папок, ' + user.note_count + ' заметок');
    });
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkRecentActivity();