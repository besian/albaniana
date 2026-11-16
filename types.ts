
export enum UserRole {
  ADMIN = 'ADMIN', // Super Admin
  EDITOR = 'EDITOR', // Section Editor
  AUTHOR = 'AUTHOR', // Contributor
  REVIEWER = 'REVIEWER',
  PUBLIC = 'PUBLIC'
}

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  NEEDS_CHANGES = 'NEEDS_CHANGES'
}

export enum Section {
  LAJME = 'Lajme',
  KULTURE = 'Kulturë',
  SHOQERI = 'Shoqëri', // Renamed from Opinion
  RUBRIKA = 'Rubrika', // Renamed from Intervista
  KRIJIMTARI = 'Krijimtari', // Renamed from Evente
  SHKENCETEK = 'Shkentek', // Renamed from Shkencë dhe Teknologji
  BIBLIOTEKA = 'Biblioteka' // New
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  bio?: string; // Added Bio
  assignedSection?: Section; // New: For Editors restricted to a section
}

export interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'image' | 'quote';
  content: string;
  metadata?: {
    caption?: string;
    alt?: string;
    level?: 1 | 2 | 3;
  };
}

export interface Article {
  id: string;
  kicker?: string; // Added Mbititull (Secondary/Top Title)
  title: string;
  subtitle: string;
  authorId: string;
  authorName?: string; // Denormalized author name
  section: Section;
  subcategory?: string; // Specific subcategory from the predefined list
  tags: string[]; // Freeform tags
  status: ArticleStatus;
  publishDate?: string; // ISO string
  heroImage?: string;
  content: Block[];
  views: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  style?: string;
  aspectRatio: '1:1' | '16:9' | '3:4';
}