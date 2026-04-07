import express from 'express';
import cookieParser from 'cookie-parser';

// Import routes
import API from './routes/API.js';
import index from './routes/index.js';

const app = express();

// Cookie
app.use(cookieParser());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api", API);
app.use("/", index);

export default app;