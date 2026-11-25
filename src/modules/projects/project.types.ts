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
  slug?: string
  name: string
  type: 'stem' | 'master' | 'artwork' | 'document'
  size: string
  uploadedAt: string
  fileUrl?: string
}

export interface ProjectCalendarEventAttachmentDto {
  id: string
  name: string
  kind: 'video' | 'audio' | 'image' | 'document' | 'file'
  size?: number
  url: string
  source: 'upload' | 'vault'
}

export interface ProjectCalendarEventDto {
  id: string
  title: string
  date: string // YYYY-MM-DD
  category: 'Release' | 'Content' | 'Pitch' | 'Promo'
  kind?: 'post' | 'video' | 'conversation' | 'ads' | 'pitch' | 'release'
  platforms?: string[]
  caption?: string
  captions?: Record<string, string>
  why?: string
  time?: string
  timeZone?: string
  remind?: boolean
  isRelease?: boolean
  fromOndie?: boolean
  postedAt?: string
  attachments?: ProjectCalendarEventAttachmentDto[]
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
  releaseType?: 'SINGLE' | 'EP' | 'ALBUM'
  gradient: string
  createdAt: string
  releaseTargetDate?: string
  metadata?: Record<string, any>
  songs: ProjectSongDto[]
  vaultItems: ProjectVaultItemDto[]
  calendarEvents: ProjectCalendarEventDto[]
  campaigns: ProjectCampaignItemDto[]
}
