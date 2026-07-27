"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
async function testAIDiscovery() {
    console.log('Testing AI Seed Target URL Discovery for "Afrobeats" in "United Kingdom"...');
    const prompt = `You are a music industry intelligence search bot. Return a list of 10 real, publicly accessible websites or submission pages for independent Afrobeats playlist curators, music blogs, radio stations, or record labels in the UK that accept music submissions.

Return a valid JSON array of strings containing ONLY the full web URLs (e.g. ["https://example.com/submit", "https://anotherblog.com/contact"]):`;
    try {
        const res = await axios_1.default.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
        }, {
            headers: {
                Authorization: `Bearer ${env_1.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        console.log('AI Seed URLs Output:', res.data?.choices?.[0]?.message?.content);
    }
    catch (err) {
        console.error('DeepSeek AI Discovery error:', err.message);
        // Fallback to Gemini
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env_1.env.GEMINI_API_KEY}`;
            const gRes = await axios_1.default.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' },
            }, { timeout: 10000 });
            console.log('Gemini AI Seed URLs Output:', gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text);
        }
        catch (gErr) {
            console.error('Gemini AI Discovery error:', gErr.message);
        }
    }
}
testAIDiscovery();
