export type ExamType = 'YÖKDİL' | 'YDS' | 'YDT';
export type CategoryType = 'konu' | 'deneme' | 'strateji' | 'kelime' | 'ceviri' | 'poster';
export type Difficulty = 'Başlangıç' | 'Orta' | 'İleri';

export interface PDFDocument {
  id: string;
  title: string;
  subtitle: string;
  examType: ExamType;
  category: CategoryType;
  pages: number;
  size: string;
  addedAt: string;
  isDownloaded: boolean;
  isNew: boolean;
  thumbnailColor: string;
  difficulty?: Difficulty;
  hasVideo?: boolean;
  videoUrl?: string | null;
  viewCount?: number;
}

export interface Category {
  id: CategoryType;
  title: string;
  subtitle: string;
  icon: string;
  count: number;
}

export const CATEGORIES: Category[] = [
  {
    id: 'konu',
    title: 'Konu Anlatımları',
    subtitle: 'Zamanlar, bağlaçlar, edatlar',
    icon: 'book-open',
    count: 10,
  },
  {
    id: 'deneme',
    title: 'Deneme ve Testler',
    subtitle: 'Cevap anahtarlı denemeler',
    icon: 'file-text',
    count: 8,
  },
  {
    id: 'strateji',
    title: 'Strateji ve İpuçları',
    subtitle: 'Zaman yönetimi, taktikler',
    icon: 'target',
    count: 5,
  },
  {
    id: 'kelime',
    title: 'Kelime Listeleri',
    subtitle: 'Akademik kelimeler, kök-ek',
    icon: 'list',
    count: 6,
  },
  {
    id: 'ceviri',
    title: 'Çeviri Çalışmaları',
    subtitle: 'Fen, sosyal, sağlık metinleri',
    icon: 'refresh-cw',
    count: 4,
  },
  {
    id: 'poster',
    title: 'Notlar ve Posterler',
    subtitle: 'Görsel PDF özet tablolar',
    icon: 'layout',
    count: 5,
  },
];

export const EXAM_TYPES: ExamType[] = ['YÖKDİL', 'YDS', 'YDT'];

export const DIFFICULTY_LEVELS: Difficulty[] = ['Başlangıç', 'Orta', 'İleri'];
