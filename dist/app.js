"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const userRoutes_js_1 = __importDefault(require("./routes/userRoutes.js"));
const waitlistRoutes_js_1 = __importDefault(require("./routes/waitlistRoutes.js"));
const lead_routes_js_1 = __importDefault(require("./modules/leads/lead.routes.js"));
const discovery_routes_js_1 = __importDefault(require("./modules/discovery/discovery.routes.js"));
const credit_routes_js_1 = __importDefault(require("./modules/credits/credit.routes.js"));
const matching_routes_js_1 = __importDefault(require("./modules/matching/matching.routes.js"));
const campaign_routes_js_1 = __importDefault(require("./modules/campaigns/campaign.routes.js"));
const webhook_routes_js_1 = __importDefault(require("./modules/webhooks/webhook.routes.js"));
exports.app = (0, express_1.default)();
// Global Middlewares
exports.app.use((0, cors_1.default)({
    origin: '*', // Configure specific frontend domain in production
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: '50mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Serve static uploads (audio demos)
exports.app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Health check endpoint
exports.app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'Ondel Backend API',
    });
});
// API Routes
exports.app.use('/api/auth', authRoutes_js_1.default);
exports.app.use('/api/users', userRoutes_js_1.default);
exports.app.use('/api/waitlist', waitlistRoutes_js_1.default);
exports.app.use('/api/v1/leads', lead_routes_js_1.default);
exports.app.use('/api/leads', lead_routes_js_1.default);
exports.app.use('/api/v1/discovery', discovery_routes_js_1.default);
exports.app.use('/api/v1/credits', credit_routes_js_1.default);
exports.app.use('/api/v1/matching', matching_routes_js_1.default);
exports.app.use('/api/v1/campaigns', campaign_routes_js_1.default);
exports.app.use('/api/v1/webhooks', webhook_routes_js_1.default);
exports.app.use('/api/webhooks', webhook_routes_js_1.default);
// 404 Handler
exports.app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});
