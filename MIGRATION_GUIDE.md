# Переход с Appwrite на PostgreSQL

## Обзор изменений

Проект GodNotes был успешно переведен с использования Appwrite в качестве бэкенда на PostgreSQL базу данных с собственной системой аутентификации на основе JWT.

## Архитектурные изменения

### База данных
- **Было**: Appwrite Cloud Database
- **Стало**: PostgreSQL 16 на сервере 89.208.14.253

### Аутентификация
- **Было**: Appwrite Authentication (сессии)
- **Стало**: JWT Tokens с PostgreSQL хранением пользователей

### Хранение данных
- **Было**: Appwrite Collections (notes, folders, users)
- **Стало**: PostgreSQL таблицы (notes, folders, users, calendar_events, todos, tags)

## Технические детали

### Новые таблицы в PostgreSQL:
```sql
-- Пользователи
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Папки
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Заметки
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  tags TEXT[],
  priority INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Новая система аутентификации

#### Серверные изменения:
- Реализован JWT middleware для защиты эндпоинтов
- Созданы эндпоинты `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Все существующие эндпоинты обновлены для использования JWT вместо сессий

#### Клиентские изменения:
- Создан `AuthService` для работы с JWT
- Реализован `useAuth` хук для управления состоянием аутентификации
- Создан `AuthContext` для предоставления аутентификации всем компонентам
- Обновлены компоненты `Login` и `App` для использования новой системы

## Конфигурация

### Переменные окружения
```env
# Сервер
DATABASE_URL=postgresql://postgres:StrongPass123!@89.208.14.253:5433/godnotes
SESSION_SECRET=your_very_secure_session_secret_change_this_immediately
PORT=3000

# Клиент
VITE_API_URL=http://localhost:5009/api
```

## Тестирование

### Проверка регистрации:
```bash
curl -X POST http://localhost:5009/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### Проверка логина:
```bash
curl -X POST http://localhost:5009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Проверка получения данных пользователя:
```bash
curl -X GET http://localhost:5009/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Сборка и запуск

### Разработка:
```bash
# Запуск сервера
npm run dev

# Запуск клиента
npm run dev:client

# Запуск всего вместе
npm run dev:full
```

### Сборка десктопного приложения:
```bash
npm run build:desktop
```

## Миграция данных

Если необходимо перенести существующие данные из Appwrite:
1. Использовать скрипты миграции из папки `scripts/`
2. Запустить `node scripts/migrate-appwrite-to-postgres.js`

## Безопасность

- Пароли хранятся в виде хешей (bcrypt)
- JWT токены имеют срок действия 24 часа
- Все эндпоинты защищены авторизацией
- Используется HTTPS в продакшене

## Откат изменений

Для возврата к Appwrite:
1. Восстановить оригинальные файлы из репозитория
2. Обновить конфигурацию .env
3. Пересобрать приложение