export interface DiscoveryJobProgress {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  categories: string[];
  genres: string[];
  countries?: string[];
  targetCount: number;
  processedCount: number;
  leadsFoundCount: number;
  discoveredLeads: Array<{ id: string; name?: string; organization?: string; category: string; contactsCount: number }>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class JobTracker {
  private static jobs = new Map<string, DiscoveryJobProgress>();

  static createJob(id: string, params: { categories: string[]; genres: string[]; countries?: string[]; targetCount: number }): DiscoveryJobProgress {
    const job: DiscoveryJobProgress = {
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

  static getJob(id: string): DiscoveryJobProgress | undefined {
    return this.jobs.get(id);
  }

  static updateProgress(id: string, updates: Partial<DiscoveryJobProgress>) {
    const existing = this.jobs.get(id);
    if (existing) {
      Object.assign(existing, updates, { updatedAt: new Date() });
    }
  }
}
