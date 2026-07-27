"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadService = void 0;
const lead_repository_1 = require("./lead.repository");
class LeadService {
    static async createLead(data) {
        return lead_repository_1.LeadRepository.create(data);
    }
    static async getLeadById(id) {
        const lead = await lead_repository_1.LeadRepository.findById(id);
        if (!lead) {
            throw new Error(`Lead with ID ${id} not found`);
        }
        return lead;
    }
    static async getLeads(query) {
        return lead_repository_1.LeadRepository.findMany(query);
    }
    static async updateLeadStatus(id, status) {
        await this.getLeadById(id);
        return lead_repository_1.LeadRepository.updateStatus(id, status);
    }
}
exports.LeadService = LeadService;
