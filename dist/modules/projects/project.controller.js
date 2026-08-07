"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.createProject = createProject;
exports.addSongToProject = addSongToProject;
exports.addVaultItemToProject = addVaultItemToProject;
exports.uploadVaultFileToProject = uploadVaultFileToProject;
exports.deleteVaultItemFromProject = deleteVaultItemFromProject;
exports.addCalendarEventToProject = addCalendarEventToProject;
exports.renameProject = renameProject;
const project_service_js_1 = require("./project.service.js");
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
        const { name, gradient, initialSongTitle, audioFileName, audioUrl } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!name || typeof name !== 'string') {
            res.status(400).json({ success: false, message: 'Project name is required' });
            return;
        }
        const project = await project_service_js_1.projectService.createProject(userIdentifier, name, gradient, initialSongTitle, audioFileName, audioUrl);
        res.status(201).json({ success: true, project });
    }
    catch (error) {
        console.error('[createProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to create project' });
    }
}
async function addSongToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { title, artistName, audioUrl, audioFileName, status, releaseDate } = req.body;
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
        const vaultItem = await project_service_js_1.projectService.addVaultItemToProject(userIdentifier, projectId, {
            name,
            type: type || 'stem',
            size: size || 'Unknown size',
            uploadedAt: uploadedAt || new Date().toISOString().split('T')[0],
            fileUrl,
        });
        res.status(201).json({ success: true, vaultItem });
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
        const vaultItem = await project_service_js_1.projectService.uploadVaultFileToProject(userIdentifier, projectId, fileBuffer, fileName, type || 'master', size);
        res.status(201).json({ success: true, vaultItem });
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
async function addCalendarEventToProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { title, date, category, songTitle } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!title || !date) {
            res.status(400).json({ success: false, message: 'Event title and date are required' });
            return;
        }
        const event = await project_service_js_1.projectService.addCalendarEventToProject(userIdentifier, projectId, {
            title,
            date,
            category: category || 'Release',
            songTitle,
        });
        res.status(201).json({ success: true, event });
    }
    catch (error) {
        console.error('[addCalendarEventToProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to add calendar event to project' });
    }
}
async function renameProject(req, res) {
    try {
        const projectId = String(req.params.id);
        const { name } = req.body;
        const userIdentifier = req.user?.email || 'default_user';
        if (!name || typeof name !== 'string') {
            res.status(400).json({ success: false, message: 'Project name is required' });
            return;
        }
        const project = await project_service_js_1.projectService.renameProject(userIdentifier, projectId, name);
        res.status(200).json({ success: true, project });
    }
    catch (error) {
        console.error('[renameProject error]:', error);
        res.status(500).json({ success: false, message: 'Failed to rename project' });
    }
}
