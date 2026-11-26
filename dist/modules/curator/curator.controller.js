"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuratorController = void 0;
const curator_service_js_1 = require("./curator.service.js");
class CuratorController {
    static async getMe(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const data = await curator_service_js_1.CuratorService.getCuratorWorkspace(req.user.userId);
            if (!data) {
                res.status(404).json({ success: false, message: 'User not found' });
                return;
            }
            res.status(200).json({ success: true, ...data });
        }
        catch (error) {
            console.error('[CuratorController.getMe error]:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to load curator workspace' });
        }
    }
    static async register(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const result = await curator_service_js_1.CuratorService.registerCurator(req.user.userId, req.body || {});
            res.status(200).json({
                success: true,
                message: 'Curator registration completed',
                ...result,
            });
        }
        catch (error) {
            console.error('[CuratorController.register error]:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to register curator profile' });
        }
    }
    static async updateProfile(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const profile = await curator_service_js_1.CuratorService.updateCuratorProfile(req.user.userId, req.body || {});
            res.status(200).json({ success: true, profile });
        }
        catch (error) {
            console.error('[CuratorController.updateProfile error]:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to update curator profile' });
        }
    }
    static async updateSubmission(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const submissionId = req.params.submissionId;
            const submission = await curator_service_js_1.CuratorService.updateSubmission(req.user.userId, submissionId, req.body || {});
            res.status(200).json({ success: true, submission });
        }
        catch (error) {
            console.error('[CuratorController.updateSubmission error]:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to update submission' });
        }
    }
    static async listDirectory(_req, res) {
        try {
            const curators = await curator_service_js_1.CuratorService.listPublicCurators();
            res.status(200).json({ success: true, curators });
        }
        catch (error) {
            console.error('[CuratorController.listDirectory error]:', error);
            res.status(500).json({ success: false, message: 'Failed to load curators directory' });
        }
    }
    static async submitPitch(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const handle = req.params.handle;
            const submission = await curator_service_js_1.CuratorService.submitPitchToCurator(req.user.userId, handle, req.body || {});
            res.status(201).json({ success: true, submission });
        }
        catch (error) {
            console.error('[CuratorController.submitPitch error]:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to submit pitch' });
        }
    }
    static async getMyPitches(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const pitches = await curator_service_js_1.CuratorService.getArtistPitches(req.user.userId);
            res.status(200).json({ success: true, pitches });
        }
        catch (error) {
            console.error('[CuratorController.getMyPitches error]:', error);
            res.status(500).json({ success: false, message: 'Failed to load pitches' });
        }
    }
    static async withdrawPitch(req, res) {
        try {
            if (!req.user?.userId) {
                res.status(401).json({ success: false, message: 'Unauthorized' });
                return;
            }
            const submissionId = req.params.submissionId;
            const result = await curator_service_js_1.CuratorService.withdrawPitch(req.user.userId, submissionId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            console.error('[CuratorController.withdrawPitch error]:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to withdraw pitch' });
        }
    }
}
exports.CuratorController = CuratorController;
