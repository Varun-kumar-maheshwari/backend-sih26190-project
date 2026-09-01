import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// 1. Global Middlewares

app.use(cors({
    origin: '*', // For hackathon MVP. In production, restrict this to your frontend URL.
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key']
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

export default app;