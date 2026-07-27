"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadController = void 0;
const lead_service_1 = require("./lead.service");
const lead_types_1 = require("./lead.types");
class LeadController {
    static async createLead(req, res) {
        try {
            const validatedData = lead_types_1.CreateLeadSchema.parse(req.body);
            const lead = await lead_service_1.LeadService.createLead(validatedData);
            res.status(201).json({ success: true, data: lead });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async getLeadById(req, res) {
        try {
            const id = String(req.params.id);
            const lead = await lead_service_1.LeadService.getLeadById(id);
            res.status(200).json({ success: true, data: lead });
        }
        catch (error) {
            res.status(404).json({ success: false, error: error.message });
        }
    }
    static async getLeads(req, res) {
        try {
            const query = lead_types_1.QueryLeadSchema.parse(req.query);
            const result = await lead_service_1.LeadService.getLeads(query);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async updateStatus(req, res) {
        try {
            const id = String(req.params.id);
            const { status } = req.body;
            const updatedLead = await lead_service_1.LeadService.updateLeadStatus(id, status);
            res.status(200).json({ success: true, data: updatedLead });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.LeadController = LeadController;
