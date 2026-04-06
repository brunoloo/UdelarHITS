import express from 'express';

// Import routes
import API from './routes/API.js';
import index from './routes/index.js';

const app = express();

// routes
app.use(express.json());
app.use("/api", API);
app.use("/", index);

export default app;