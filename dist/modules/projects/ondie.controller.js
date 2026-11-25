"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOndieChats = getOndieChats;
exports.updateOndieMessage = updateOndieMessage;
exports.deleteOndieChat = deleteOndieChat;
exports.streamOndieChat = streamOndieChat;
exports.streamOndieCaptions = streamOndieCaptions;
const ondie_service_js_1 = require("./ondie.service.js");
async function getOndieChats(req, res) {
    try {
        const projectId = String(req.params.id);
        const chats = await ondie_service_js_1.OndieService.getProjectChats(projectId);
        res.status(200).json({ success: true, chats });
    }
    catch (error) {
        console.error('[getOndieChats error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch chat history' });
    }
}
async function updateOndieMessage(req, res) {
    try {
        const projectId = String(req.params.id);
        const messageId = String(req.params.messageId);
        const updated = await ondie_service_js_1.OndieService.updateChatMessagePayload(projectId, messageId, req.body || {});
        res.status(200).json({ success: true, message: updated });
    }
    catch (error) {
        console.error('[updateOndieMessage error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update message' });
    }
}
async function deleteOndieChat(req, res) {
    try {
        const projectId = String(req.params.id);
        const chatId = String(req.params.chatId);
        await ondie_service_js_1.OndieService.deleteProjectChat(projectId, chatId);
        res.status(200).json({ success: true, message: 'Chat deleted' });
    }
    catch (error) {
        console.error('[deleteOndieChat error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete chat' });
    }
}
async function streamOndieChat(req, res) {
    const projectId = String(req.params.id);
    const { chatId, message, attachments, turns } = req.body || {};
    const userMessage = typeof message === 'string' && message.trim()
        ? message.trim()
        : Array.isArray(turns) && turns.length
            ? String(turns[turns.length - 1]?.content || '').trim()
            : '';
    if (!userMessage) {
        res.status(400).json({ success: false, message: 'Message is required' });
        return;
    }
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded)
            controller.abort();
    });
    const emit = (event) => {
        if (!res.writableEnded) {
            res.write(`${JSON.stringify(event)}\n`);
        }
    };
    try {
        await ondie_service_js_1.OndieService.streamChat(projectId, { chatId, message: userMessage, attachments, turns }, emit, controller.signal);
    }
    catch (error) {
        if (!controller.signal.aborted) {
            emit({ type: 'error', error: error?.message || 'Failed to stream response' });
        }
    }
    finally {
        if (!res.writableEnded)
            res.end();
    }
}
async function streamOndieCaptions(req, res) {
    const projectId = String(req.params.id);
    const { sections, post } = req.body || {};
    if (!Array.isArray(sections) || !sections.length || !post) {
        res.status(400).json({ success: false, message: 'sections and post are required' });
        return;
    }
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded)
            controller.abort();
    });
    const emit = (event) => {
        if (!res.writableEnded) {
            res.write(`${JSON.stringify(event)}\n`);
        }
    };
    try {
        await ondie_service_js_1.OndieService.streamCaptions(projectId, { sections, post }, emit, controller.signal);
    }
    catch (error) {
        if (!controller.signal.aborted) {
            emit({ type: 'error', error: error?.message || 'Failed to draft captions' });
        }
    }
    finally {
        if (!res.writableEnded)
            res.end();
    }
}
