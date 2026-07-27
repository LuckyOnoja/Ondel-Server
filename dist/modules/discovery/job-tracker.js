"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobTracker = void 0;
class JobTracker {
    static jobs = new Map();
    static createJob(id, params) {
        const job = {
            id,
            status: 'QUEUED',
            categories: params.categories,
            genres: params.genres,
            countries: params.countries,
            targetCount: params.targetCount,
            processedCount: 0,
            leadsFoundCount: 0,
            discoveredLeads: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.jobs.set(id, job);
        return job;
    }
    static getJob(id) {
        return this.jobs.get(id);
    }
    static updateProgress(id, updates) {
        const existing = this.jobs.get(id);
        if (existing) {
            Object.assign(existing, updates, { updatedAt: new Date() });
        }
    }
}
exports.JobTracker = JobTracker;
