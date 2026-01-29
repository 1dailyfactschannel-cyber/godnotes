const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes' 
});

async function checkUserNotes() {
  try {
    // Найдем пользователя
    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1', 
      ['1121@mail.ru']
    );
    
    if (userResult.rows.length === 0) {
      console.log('Пользователь 1121@mail.ru не найден');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Пользователь найден:', user);
    
    // Проверим папки пользователя
    const foldersResult = await pool.query(
      'SELECT id, name, parent_id, created_at FROM folders WHERE user_id = $1 ORDER BY created_at',
      [user.id]
    );
    
    console.log('\nПапки пользователя:');
    foldersResult.rows.forEach(folder => {
      console.log('- ' + folder.name + ' (ID: ' + folder.id + ')');
    });
    
    // Проверим заметки пользователя
    const notesResult = await pool.query(
      'SELECT id, name, folder_id, created_at FROM notes WHERE user_id = $1 ORDER BY created_at',
      [user.id]
    );
    
    console.log('\nЗаметки пользователя:');
    notesResult.rows.forEach(note => {
      console.log('- ' + note.name + ' (ID: ' + note.id + ', Folder: ' + (note.folder_id || 'root') + ')');
    });
    
    console.log('\nВсего папок:', foldersResult.rowCount);
    console.log('Всего заметок:', notesResult.rowCount);
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserNotes();