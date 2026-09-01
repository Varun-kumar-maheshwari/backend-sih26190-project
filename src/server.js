import app from './app.js';
import prisma from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // 1. Test the database connection BEFORE accepting HTTP traffic
        await prisma.$connect();
        console.log('✅ PostgreSQL Connected [Prisma ORM]');

        // 2. Start listening
        app.listen(PORT, () => {
            console.log(`SakshyaSetu API running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Fatal Server Error: Could not connect to Database', error);
        await prisma.$disconnect();
        process.exit(1);
    }
};

startServer();