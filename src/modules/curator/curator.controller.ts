import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware.js';
import { CuratorService } from './curator.service.js';

export class CuratorController {
  static async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const data = await CuratorService.getCuratorWorkspace(req.user.userId);
      if (!data) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      res.status(200).json({ success: true, ...data });
    } catch (error: any) {
      console.error('[CuratorController.getMe error]:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to load curator workspace' });
    }
  }

  static async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const result = await CuratorService.registerCurator(req.user.userId, req.body || {});
      res.status(200).json({
        success: true,
        message: 'Curator registration completed',
        ...result,
      });
    } catch (error: any) {
      console.error('[CuratorController.register error]:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to register curator profile' });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const profile = await CuratorService.updateCuratorProfile(req.user.userId, req.body || {});
      res.status(200).json({ success: true, profile });
    } catch (error: any) {
      console.error('[CuratorController.updateProfile error]:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to update curator profile' });
    }
  }

  static async updateSubmission(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const submissionId = req.params.submissionId as string;
      const submission = await CuratorService.updateSubmission(req.user.userId, submissionId, req.body || {});
      res.status(200).json({ success: true, submission });
    } catch (error: any) {
      console.error('[CuratorController.updateSubmission error]:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to update submission' });
    }
  }

  static async listDirectory(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const curators = await CuratorService.listPublicCurators();
      res.status(200).json({ success: true, curators });
    } catch (error: any) {
      console.error('[CuratorController.listDirectory error]:', error);
      res.status(500).json({ success: false, message: 'Failed to load curators directory' });
    }
  }

  static async submitPitch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const handle = req.params.handle as string;
      const submission = await CuratorService.submitPitchToCurator(req.user.userId, handle, req.body || {});
      res.status(201).json({ success: true, submission });
    } catch (error: any) {
      console.error('[CuratorController.submitPitch error]:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to submit pitch' });
    }
  }

  static async getMyPitches(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const pitches = await CuratorService.getArtistPitches(req.user.userId);
      res.status(200).json({ success: true, pitches });
    } catch (error: any) {
      console.error('[CuratorController.getMyPitches error]:', error);
      res.status(500).json({ success: false, message: 'Failed to load pitches' });
    }
  }

  static async withdrawPitch(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const submissionId = req.params.submissionId as string;
      const result = await CuratorService.withdrawPitch(req.user.userId, submissionId);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      console.error('[CuratorController.withdrawPitch error]:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to withdraw pitch' });
    }
  }
}
