"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const userRoutes_js_1 = __importDefault(require("./routes/userRoutes.js"));
exports.app = (0, express_1.default)();
// Global Middlewares
exports.app.use((0, cors_1.default)({
    origin: '*', // Configure specific frontend domain in production
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true }));
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
// 404 Handler
exports.app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});
