import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 5001);

app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

