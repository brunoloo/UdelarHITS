import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import index from './routes/index.js';

const app = express();

// Para usar __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../../frontend')));

// API routes
app.use(express.json());
app.use("/api", index);


// get index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

export default app;