import { LeadRepository } from './lead.repository';
import { CreateLeadDTO, QueryLeadDTO } from './lead.types';

export class LeadService {
  static async createLead(data: CreateLeadDTO) {
    return LeadRepository.create(data);
  }

  static async getLeadById(id: string) {
    const lead = await LeadRepository.findById(id);
    if (!lead) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    return lead;
  }

  static async getLeads(query: QueryLeadDTO) {
    return LeadRepository.findMany(query);
  }

  static async updateLeadStatus(id: string, status: any) {
    await this.getLeadById(id);
    return LeadRepository.updateStatus(id, status);
  }
}
