import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:5001",
      "http://localhost:5002",
      "https://godnotes.vercel.app"
    ];
    // Разрешаем любой vercel.app поддомен и локалхост
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Регистрируем маршруты
registerRoutes(httpServer, app);

export default app;
