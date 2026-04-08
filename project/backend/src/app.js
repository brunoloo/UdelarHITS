import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import routes
import API from './routes/API.js';
import index from './routes/index.js';

// Express
const app = express();

// Cors
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));


// Cookie
app.use(cookieParser());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api", API);
app.use("/", index);

export default app;