import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import userRoutes from './routes/userRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

const app = express();

// 1. Global Middlewares

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Parses incoming JSON payloads
app.use(express.json());

// 2. Base Health Check
// When you deploy this to AWS/Render, the load balancer will hit this endpoint to check if your server is alive.
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'Operational',
        service: 'SakshyaSetu API',
        timestamp: new Date().toISOString()
    });
});

// 3. Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents/:caseId', documentRoutes);

export default app;