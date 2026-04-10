import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import API from './routes/API.js';

// Express
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/assets', express.static(path.join(__dirname, 'assets'))); // default img


// Cors
app.use(cors({
  origin: process.env.URL,
  credentials: true
}));


// Cookie
app.use(cookieParser());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//index (usamos el index que aparece en frontend)
app.use(express.static(path.join(process.cwd(), "../frontend/"))); 

// routes
app.use("/api", API);


export default app;