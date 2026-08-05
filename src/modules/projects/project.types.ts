export interface ProjectSongDto {
  id: string
  slug?: string
  title: string
  artistName: string
  audioUrl?: string
  audioFileName?: string
  status: 'Strategy Ready' | 'In Review' | 'Scheduled' | 'Draft'
  releaseDate?: string
  campaignsCount?: number
  gradient?: string
  bpm?: number
  genre?: string
  subgenres?: string[]
  similarArtists?: string[]
  calendarPlanGenerated?: boolean
}

export interface ProjectVaultItemDto {
  id: string
  name: string
  type: 'stem' | 'master' | 'artwork' | 'document'
  size: string
  uploadedAt: string
  fileUrl?: string
}

export interface ProjectCalendarEventDto {
  id: string
  title: string
  date: string
  category: 'Release' | 'Content' | 'Pitch' | 'Promo'
  songTitle?: string
  songId?: string
  completed?: boolean
}

export interface ProjectCampaignItemDto {
  id: string
  title: string
  platform: 'TikTok' | 'Instagram' | 'Spotify' | 'YouTube'
  status: 'Active' | 'Planned' | 'Completed'
  reach: string
  budget?: string
}

export interface ProjectDto {
  id: string
  name: string
  gradient: string
  createdAt: string
  releaseTargetDate?: string
  songs: ProjectSongDto[]
  vaultItems: ProjectVaultItemDto[]
  calendarEvents: ProjectCalendarEventDto[]
  campaigns: ProjectCampaignItemDto[]
}
