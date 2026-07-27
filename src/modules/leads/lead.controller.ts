import { Request, Response } from 'express';
import { LeadService } from './lead.service';
import { CreateLeadSchema, QueryLeadSchema } from './lead.types';

export class LeadController {
  static async createLead(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = CreateLeadSchema.parse(req.body);
      const lead = await LeadService.createLead(validatedData);
      res.status(201).json({ success: true, data: lead });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getLeadById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const lead = await LeadService.getLeadById(id);
      res.status(200).json({ success: true, data: lead });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getLeads(req: Request, res: Response): Promise<void> {
    try {
      const query = QueryLeadSchema.parse(req.query);
      const result = await LeadService.getLeads(query);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      const updatedLead = await LeadService.updateLeadStatus(id, status);
      res.status(200).json({ success: true, data: updatedLead });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
