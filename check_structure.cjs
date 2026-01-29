const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes' 
});

async function checkTables() {
  try {
    // Проверим структуру таблицы folders
    const folderColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'folders' 
      ORDER BY ordinal_position
    `);
    
    console.log('Структура таблицы folders:');
    folderColumns.rows.forEach(col => {
      console.log('- ' + col.column_name + ' (' + col.data_type + ')');
    });
    
    console.log('\nСтруктура таблицы notes:');
    const noteColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notes' 
      ORDER BY ordinal_position
    `);
    
    noteColumns.rows.forEach(col => {
      console.log('- ' + col.column_name + ' (' + col.data_type + ')');
    });
    
    // Проверим данные пользователя
    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1', 
      ['1121@mail.ru']
    );
    
    if (userResult.rows.length === 0) {
      console.log('\nПользователь 1121@mail.ru не найден');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('\nПользователь найден:', user.id);
    
    // Проверим папки пользователя с правильными полями
    const foldersResult = await pool.query(
      'SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at',
      [user.id]
    );
    
    console.log('\nПапки пользователя (' + foldersResult.rowCount + '):');
    foldersResult.rows.forEach(folder => {
      console.log('- ID: ' + folder.id + ', Name: ' + (folder.title || folder.name || 'Без названия'));
    });
    
    // Проверим заметки пользователя
    const notesResult = await pool.query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at',
      [user.id]
    );
    
    console.log('\nЗаметки пользователя (' + notesResult.rowCount + '):');
    notesResult.rows.forEach(note => {
      console.log('- ID: ' + note.id + ', Name: ' + (note.title || note.name || 'Без названия') + ', Folder: ' + (note.folder_id || 'root'));
    });
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();