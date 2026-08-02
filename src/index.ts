import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { startReplyListenerCron } from './jobs/reply-listener.job.js';

import { CampaignSchedulerService } from './services/campaign-scheduler.service';

const PORT = parseInt(env.PORT, 10) || 8000;

async function bootstrap() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ [PostgreSQL] Connected to database via Prisma successfully');

    // Start background Round-Robin Campaign Scheduler Engine
    CampaignSchedulerService.startScheduler(20000); // Poll & process micro-batches every 20s

    app.listen(PORT, () => {
      console.log(`🚀 [Server] Ondel API Server running at http://localhost:${PORT}`);
      console.log(`📡 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ [Bootstrap Error] Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
