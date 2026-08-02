"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const prisma_js_1 = require("./config/prisma.js");
const campaign_scheduler_service_1 = require("./services/campaign-scheduler.service");
const PORT = parseInt(env_js_1.env.PORT, 10) || 8000;
async function bootstrap() {
    try {
        // Verify database connection
        await prisma_js_1.prisma.$connect();
        console.log('✅ [PostgreSQL] Connected to database via Prisma successfully');
        // Start background Round-Robin Campaign Scheduler Engine
        campaign_scheduler_service_1.CampaignSchedulerService.startScheduler(20000); // Poll & process micro-batches every 20s
        app_js_1.app.listen(PORT, () => {
            console.log(`🚀 [Server] Ondel API Server running at http://localhost:${PORT}`);
            console.log(`📡 Environment: ${env_js_1.env.NODE_ENV}`);
        });
    }
    catch (error) {
        console.error('❌ [Bootstrap Error] Failed to start server:', error);
        process.exit(1);
    }
}
bootstrap();
