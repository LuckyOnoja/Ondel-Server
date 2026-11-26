import path from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import leadRoutes from './modules/leads/lead.routes.js';
import discoveryRoutes from './modules/discovery/discovery.routes.js';
import creditRoutes from './modules/credits/credit.routes.js';
import matchingRoutes from './modules/matching/matching.routes.js';
import campaignRoutes from './modules/campaigns/campaign.routes.js';
import songRoutes from './modules/songs/song.routes.js';
import webhookRoutes from './modules/webhooks/webhook.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import curatorRoutes from './modules/curator/curator.routes.js';
import publicRoutes from './routes/publicRoutes.js';

export const app = express();

// Global Middlewares
app.use(cors({
  origin: '*', // Configure specific frontend domain in production
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads (audio demos)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Ondel Backend API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/api/v1/credits', creditRoutes);
app.use('/api/v1/matching', matchingRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/songs', songRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/v1/curator', curatorRoutes);
app.use('/api/curator', curatorRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/public', publicRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});
