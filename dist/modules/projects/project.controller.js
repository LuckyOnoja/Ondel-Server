"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMediaToCloudinary = uploadMediaToCloudinary;
exports.getProjects = getProjects;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.addSongToProject = addSongToProject;
exports.addVaultItemToProject = addVaultItemToProject;
exports.uploadVaultFileToProject = uploadVaultFileToProject;
exports.deleteVaultItemFromProject = deleteVaultItemFromProject;
exports.renameVaultItemInProject = renameVaultItemInProject;
exports.renameSongInProject = renameSongInProject;
exports.getCalendarEvents = getCalendarEvents;
exports.addCalendarEventToProject = addCalendarEventToProject;
exports.batchAddCalendarEvents = batchAddCalendarEvents;
exports.updateCalendarEvent = updateCalendarEvent;
exports.deleteCalendarEvent = deleteCalendarEvent;
const project_service_js_1 = require("./project.service.js");
const cloudinary_service_js_1 = require("../../services/cloudinary.service.js");
const AUDIO_EXT_RE = /\.(wav|aif|aiff|flac|mp3|m4a|aac|ogg|wma)$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;
const DOC_EXT_RE = /\.(pdf|doc|docx)$/i;
async function uploadMediaToCloudinary(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file provided.' });
            return;
        }
        const fileName = req.file.originalname || 'upload';
        const mimeType = (req.file.mimetype || '').toLowerCase();
        const folder = typeof req.body?.folder === 'string' && req.body.folder.trim() ? req.body.folder.trim() : 'ondel_vault';
        const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';
        const isAudio = mimeType.startsWith('audio/') || AUDIO_EXT_RE.test(fileName);
        const isImage = mimeType.startsWith('image/') || IMAGE_EXT_RE.test(fileName);
        const isVideo = mimeType.startsWith('video/') || VIDEO_EXT_RE.test(fileName);
        const isSplitDoc = mimeType === 'application/pdf' ||
            mimeType === 'application/msword' ||
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            DOC_EXT_RE.test(fileName);
        // Strict server-side role enforcement
        if (['master', 'clean', 'instrumental', 'acapella', 'mix', 'stem'].includes(role) && !isAudio) {
            res.status(400).json({
                success: false,
                message: 'Only audio files (WAV, MP3, FLAC, AIFF, M4A, AAC, OGG) are accepted for this step.',
            });
            return;
        }
        if (role === 'cover' && !isImage && !isVideo) {
            res.status(400).json({
                success: false,
                message: 'Cover must be an image (PNG, JPG, WEBP) or a video up to 10 seconds (MP4, MOV, WEBM).',
            });
            return;
        }
        if (role === 'splits' && !isSplitDoc) {
            res.status(400).json({
                success: false,
                message: 'Split sheet must be a PDF or Word document (.pdf, .doc, .docx).',
            });
            return;
        }
        const maxDurationSeconds = role === 'cover' && isVideo
            ? 10
            : req.body?.maxDurationSeconds
                ? Number(req.body.maxDurationSeconds)
                : undefined;
        const uploaded = await cloudinary_service_js_1.CloudinaryService.uploadMediaBuffer(req.file.buffer, fileName, mimeType, {
            folder,
            maxDurationSeconds: Number.isFinite(maxDurationSeconds) ? maxDurationSeconds : undefined,
        });
        res.status(201).json({
            success: true,
            url: uploaded.url,
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType,
            duration: uploaded.duration,
            bytes: uploaded.bytes,
        });
    }
    catch (error) {
        console.error('[uploadMediaToCloudinary error]:', error);
        const status = /must be .* seconds or shorter|Only .* accepted|must be a/i.test(error?.message || '') ? 400 : 500;
        res.status(status).json({
            success: false,
            message: error?.message || 'Cloudinary upload failed',
        });
    }
}
async function getProjects(req, res) {
    try {
        const userIdentifier = req.user?.email || 'default_user';
        const projects = await project_service_js_1.projectService.getUserProjects(userIdentifier);
        res.status(200).json({ success: true, projects });
    }
    catch (error) {
        console.error('[getProjects error]:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch projects' });
    }
}
async function createProject(req, res) {
    try {
        const { name, gradient, initialSongTitle, audioFileName, audioUrl, releaseType, releaseTargetDate } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!name || typeof name !== 'string') {
            res.status(400).json({ success: false, message: 'Project name is required' });
            return;
        }
        const project = await project_service_js_1.projectService.createProject(userIdentifier, name, gradient, initialSongTitle, audioFileName, audioUrl, releaseType, releaseTargetDate);
        res.status(201).json({ success: true, project });
    }
    catch (error) {
        console.error('[createProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to create project' });
    }
}
async function updateProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { name, releaseTargetDate, releaseType, metadata } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (name === undefined &&
            releaseTargetDate === undefined &&
            releaseType === undefined &&
            metadata === undefined) {
            res.status(400).json({ success: false, message: 'At least one field to update is required' });
            return;
        }
        const project = await project_service_js_1.projectService.updateProject(userIdentifier, projectId, {
            name,
            releaseTargetDate,
            releaseType,
            metadata,
        });
        res.status(200).json({ success: true, project });
    }
    catch (error) {
        console.error('[updateProject error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update project' });
    }
}
async function addSongToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { title, artistName, audioUrl, audioFileName, status, releaseDate, genre } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!title) {
            res.status(400).json({ success: false, message: 'Song title is required' });
            return;
        }
        const song = await project_service_js_1.projectService.addSongToProject(userIdentifier, projectId, {
            title,
            artistName: artistName || 'Artist',
            audioUrl,
            audioFileName,
            status: status || 'Strategy Ready',
            releaseDate,
            genre,
        });
        res.status(201).json({ success: true, song });
    }
    catch (error) {
        console.error('[addSongToProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to add song to project' });
    }
}
async function addVaultItemToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { name, type, size, uploadedAt, fileUrl } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!name || !type) {
            res.status(400).json({ success: false, message: 'Vault item name and type are required' });
            return;
        }
        const { vaultItem, song } = await project_service_js_1.projectService.addVaultItemToProject(userIdentifier, projectId, {
            name,
            type: type || 'stem',
            size: size || 'Unknown size',
            uploadedAt: uploadedAt || new Date().toISOString().split('T')[0],
            fileUrl,
        });
        res.status(201).json({ success: true, vaultItem, ...(song ? { song } : {}) });
    }
    catch (error) {
        console.error('[addVaultItemToProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to add vault item to project' });
    }
}
async function uploadVaultFileToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const userIdentifier = req.user?.email || 'default_user';
        const { name, type, size } = req.body;
        const fileBuffer = req.file ? req.file.buffer : undefined;
        const fileName = req.file ? req.file.originalname : name;
        const { vaultItem, song } = await project_service_js_1.projectService.uploadVaultFileToProject(userIdentifier, projectId, fileBuffer, fileName, type || 'master', size);
        res.status(201).json({ success: true, vaultItem, ...(song ? { song } : {}) });
    }
    catch (error) {
        console.error('[uploadVaultFileToProject error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to upload vault item' });
    }
}
async function deleteVaultItemFromProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const vaultItemId = String(req.params.vaultItemId);
        const userIdentifier = req.user?.email || 'default_user';
        await project_service_js_1.projectService.deleteVaultItemFromProject(userIdentifier, projectId, vaultItemId);
        res.status(200).json({ success: true, message: 'Vault item deleted successfully' });
    }
    catch (error) {
        console.error('[deleteVaultItemFromProject error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete vault item' });
    }
}
async function renameVaultItemInProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const vaultItemId = String(req.params.vaultItemId);
        const { name } = req.body || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ success: false, message: 'Name is required' });
            return;
        }
        const result = await project_service_js_1.projectService.renameVaultItemInProject(projectId, vaultItemId, name);
        res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        console.error('[renameVaultItemInProject error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to rename vault item' });
    }
}
async function renameSongInProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const songId = String(req.params.songId);
        const { title } = req.body || {};
        if (!title || typeof title !== 'string' || !title.trim()) {
            res.status(400).json({ success: false, message: 'Song title is required' });
            return;
        }
        const song = await project_service_js_1.projectService.renameSongInProject(projectId, songId, title);
        res.status(200).json({ success: true, song });
    }
    catch (error) {
        console.error('[renameSongInProject error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to rename song' });
    }
}
async function getCalendarEvents(req, res) {
    try {
        const projectId = String(req.params.id);
        const events = await project_service_js_1.projectService.getCalendarEventsForProject(projectId);
        res.status(200).json({ success: true, events });
    }
    catch (error) {
        console.error('[getCalendarEvents error]:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch calendar events' });
    }
}
async function addCalendarEventToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { title, date, category, kind, platforms, caption, captions, why, time, timeZone, remind, isRelease, fromOndie, postedAt, attachments, songTitle, songId, completed, } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!title || !date) {
            res.status(400).json({ success: false, message: 'Event title and date are required' });
            return;
        }
        const event = await project_service_js_1.projectService.addCalendarEventToProject(userIdentifier, projectId, {
            title,
            date,
            category: category || 'Content',
            kind,
            platforms,
            caption,
            captions,
            why,
            time,
            timeZone,
            remind,
            isRelease,
            fromOndie,
            postedAt,
            attachments,
            songTitle,
            songId,
            completed,
        });
        res.status(201).json({ success: true, event });
    }
    catch (error) {
        console.error('[addCalendarEventToProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to add calendar event to project' });
    }
}
async function batchAddCalendarEvents(req, res) {
    try {
        const projectId = String(req.params.id);
        const { events } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!Array.isArray(events) || events.length === 0) {
            res.status(400).json({ success: false, message: 'Non-empty events array is required' });
            return;
        }
        const created = await project_service_js_1.projectService.batchAddCalendarEvents(userIdentifier, projectId, events);
        res.status(201).json({ success: true, events: created });
    }
    catch (error) {
        console.error('[batchAddCalendarEvents error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to save calendar events' });
    }
}
async function updateCalendarEvent(req, res) {
    try {
        const projectId = String(req.params.id);
        const eventId = String(req.params.eventId);
        const userIdentifier = req.user?.email || 'default_user';
        const event = await project_service_js_1.projectService.updateCalendarEvent(userIdentifier, projectId, eventId, req.body);
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        console.error('[updateCalendarEvent error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update calendar event' });
    }
}
async function deleteCalendarEvent(req, res) {
    try {
        const projectId = String(req.params.id);
        const eventId = String(req.params.eventId);
        const userIdentifier = req.user?.email || 'default_user';
        await project_service_js_1.projectService.deleteCalendarEvent(userIdentifier, projectId, eventId);
        res.status(200).json({ success: true, message: 'Calendar event deleted' });
    }
    catch (error) {
        console.error('[deleteCalendarEvent error]:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete calendar event' });
    }
}
