import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS } from '../constants/Api';
import type { ExamType, Difficulty } from '../constants/Data';

export interface ApiCategory {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  icon: string;
  sort_order: number;
  count: number;
}

export interface ApiDocument {
  id: number;
  title: string;
  subtitle: string;
  exam_type: ExamType;
  pages: number;
  file_size: string;
  file_url: string | null;
  thumbnail_color: string;
  is_new: boolean;
  created_at: string;
  category_slug: string;
  category_name: string;
  difficulty: Difficulty;
  video_url: string | null;
  has_video: boolean;
  view_count: number;
  sort_order: number;
}

export interface RecentHistoryItem {
  document_id: number;
  opened_at: string;
  duration_sec: number;
  title: string;
  thumbnail_color: string;
  file_url: string | null;
}

export interface WeeklyDataItem {
  date: string;
  minutes: number;
}

export interface ExamBreakdownItem {
  exam_type: string;
  minutes: number;
}

export interface DiffBreakdownItem {
  difficulty: string;
  doc_count: number;
}

interface AppState {
  isDarkMode: boolean;
  isFuatBaskanMode: boolean;
  selectedExam: ExamType;
  selectedDifficulty: Difficulty | null;
  searchQuery: string;
  downloadedIds: number[];
  downloadedDocs: Record<number, ApiDocument>;
  favoriteIds: number[];
  favoriteDocs: Record<number, ApiDocument>;

  // İstatistikler (DB'den gelir)
  studyMinutes: number;
  todayStudySec: number;
  openedDocs: number;
  favoriteCount: number;
  streakDays: number;
  recentHistory: RecentHistoryItem[];
  weeklyData: WeeklyDataItem[];
  examBreakdown: ExamBreakdownItem[];
  diffBreakdown: DiffBreakdownItem[];
  isLoadingStats: boolean;

  // Deneme istatistikleri
  examsTaken: number;
  bestScore: number;
  avgScore: number;
  totalQuestionsAnswered: number;

  // Remote data
  categories: ApiCategory[];
  documents: ApiDocument[];
  isLoadingCategories: boolean;
  isLoadingDocuments: boolean;
  fetchError: string | null;

  toggleDarkMode: () => void;
  toggleFuatBaskanMode: () => void;
  setSelectedExam: (exam: ExamType) => void;
  setSelectedDifficulty: (d: Difficulty | null) => void;
  setSearchQuery: (q: string) => void;
  toggleDownload: (id: number, doc?: ApiDocument) => void;
  toggleFavorite: (id: number, token?: string, doc?: ApiDocument) => void;
  fetchFavorites: (token: string) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchDocuments: (examType?: ExamType, difficulty?: Difficulty | null) => Promise<void>;
  fetchUserStats: (token: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<ApiDocument[] | null>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,
      isFuatBaskanMode: true,
      selectedExam: 'YÖKDİL',
      selectedDifficulty: null,
      searchQuery: '',
      downloadedIds: [],
      downloadedDocs: {},
      favoriteIds: [],
      favoriteDocs: {},

      studyMinutes: 0,
      todayStudySec: 0,
      openedDocs: 0,
      favoriteCount: 0,
      streakDays: 0,
      recentHistory: [],
      weeklyData: [],
      examsTaken: 0,
      bestScore: 0,
      avgScore: 0,
      totalQuestionsAnswered: 0,
      examBreakdown: [],
      diffBreakdown: [],
      isLoadingStats: false,

      categories: [],
      documents: [],
      isLoadingCategories: false,
      isLoadingDocuments: false,
      fetchError: null,

      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      toggleFuatBaskanMode: () => set((s) => ({ isFuatBaskanMode: !s.isFuatBaskanMode })),

      setSelectedExam: (exam) => {
        set({ selectedExam: exam });
        get().fetchDocuments(exam, get().selectedDifficulty);
      },

      setSelectedDifficulty: (d) => {
        set({ selectedDifficulty: d });
        get().fetchDocuments(get().selectedExam, d);
      },

      setSearchQuery: (q) => set({ searchQuery: q }),

      toggleDownload: (id, doc) =>
        set((s) => {
          if (s.downloadedIds.includes(id)) {
            const { [id]: _removed, ...rest } = s.downloadedDocs;
            return { downloadedIds: s.downloadedIds.filter((d) => d !== id), downloadedDocs: rest };
          }
          return {
            downloadedIds: [...s.downloadedIds, id],
            downloadedDocs: doc ? { ...s.downloadedDocs, [id]: doc } : s.downloadedDocs,
          };
        }),

      toggleFavorite: (id, token, doc) => {
        const isFav = get().favoriteIds.includes(id);
        set((s) => {
          const favoriteIds = isFav
            ? s.favoriteIds.filter((d) => d !== id)
            : [...s.favoriteIds, id];
          let favoriteDocs = s.favoriteDocs;
          if (!isFav && doc) {
            favoriteDocs = { ...s.favoriteDocs, [id]: doc };
          } else if (isFav) {
            const { [id]: _removed, ...rest } = s.favoriteDocs;
            favoriteDocs = rest;
          }
          return { favoriteIds, favoriteDocs };
        });

        if (!token) return;
        const method = isFav ? 'DELETE' : 'POST';
        fetch(ENDPOINTS.favorites, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ document_id: id }),
        }).catch(() => {
          set((s) => ({
            favoriteIds: isFav
              ? [...s.favoriteIds, id]
              : s.favoriteIds.filter((d) => d !== id),
          }));
        });
      },

      // Uygulama açılışında backend'den favorileri yükle ve yerel ile birleştir
      fetchFavorites: async (token: string) => {
        if (!token) return;
        try {
          const res  = await fetch(ENDPOINTS.favorites, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const remote: number[] = json.data;
            set((s) => {
              const favoriteIds = Array.from(new Set([...remote, ...s.favoriteIds]));
              // Halihazırda yüklü documents listesinden favoriteDocs'u doldur
              const newFavDocs = { ...s.favoriteDocs };
              s.documents.forEach((d) => {
                if (favoriteIds.includes(d.id)) newFavDocs[d.id] = d;
              });
              return { favoriteIds, favoriteDocs: newFavDocs };
            });
          }
        } catch {}
      },

      fetchCategories: async () => {
        set({ isLoadingCategories: true, fetchError: null });
        try {
          const res  = await fetch(ENDPOINTS.categories);
          const json = await res.json();
          if (json.success) {
            set({ categories: json.data, isLoadingCategories: false });
          } else {
            set({ fetchError: 'Kategoriler yüklenemedi', isLoadingCategories: false });
          }
        } catch {
          set({ fetchError: 'Bağlantı hatası', isLoadingCategories: false });
        }
      },

      fetchDocuments: async (examType?: ExamType, difficulty?: Difficulty | null) => {
        const exam = examType ?? get().selectedExam;
        set({ isLoadingDocuments: true, fetchError: null });
        try {
          const params = new URLSearchParams({ exam_type: exam });
          if (difficulty) params.set('difficulty', difficulty);
          const res  = await fetch(`${ENDPOINTS.documents}?${params}`);
          const json = await res.json();
          if (json.success) {
            const docs: ApiDocument[] = json.data;
            // Yüklenen dokümanlar arasında favoriler varsa favoriteDocs'u güncelle
            const { favoriteIds, favoriteDocs } = get();
            const newFavDocs = { ...favoriteDocs };
            docs.forEach((d) => { if (favoriteIds.includes(d.id)) newFavDocs[d.id] = d; });
            set({ documents: docs, isLoadingDocuments: false, favoriteDocs: newFavDocs });
          } else {
            set({ fetchError: 'Dokümanlar yüklenemedi', isLoadingDocuments: false });
          }
        } catch {
          set({ fetchError: 'Bağlantı hatası', isLoadingDocuments: false });
        }
      },

      searchDocuments: async (query: string) => {
        if (!query.trim()) return null;
        try {
          const params = new URLSearchParams({ search: query, exam_type: get().selectedExam });
          const res    = await fetch(`${ENDPOINTS.documents}?${params}`);
          if (!res.ok) return null;
          const json   = await res.json();
          return json.success ? (json.data as ApiDocument[]) : null;
        } catch {
          return null;
        }
      },

      fetchUserStats: async (token: string) => {
        if (!token) return;
        set({ isLoadingStats: true });
        try {
          const res  = await fetch(ENDPOINTS.userStats, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.success) {
            set({
              studyMinutes:           json.data.study_minutes,
              todayStudySec:          json.data.today_study_sec ?? 0,
              openedDocs:             json.data.opened_docs,
              favoriteCount:          json.data.favorite_count,
              streakDays:             json.data.streak_days ?? 0,
              recentHistory:          json.data.recent_history ?? [],
              weeklyData:             json.data.weekly_data ?? [],
              examBreakdown:          json.data.exam_breakdown ?? [],
              diffBreakdown:          json.data.difficulty_breakdown ?? [],
              examsTaken:             json.data.exams_taken ?? 0,
              bestScore:              json.data.best_score ?? 0,
              avgScore:               json.data.avg_score ?? 0,
              totalQuestionsAnswered: json.data.total_questions_answered ?? 0,
              isLoadingStats: false,
            });
          } else {
            set({ isLoadingStats: false });
          }
        } catch {
          set({ isLoadingStats: false });
        }
      },
    }),
    {
      name: 'yokdil-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Sadece kullanıcı tercihlerini ve favorileri disk'e yaz
      partialize: (s) => ({
        isDarkMode:        s.isDarkMode,
        isFuatBaskanMode:  s.isFuatBaskanMode,
        selectedExam:      s.selectedExam,
        favoriteIds:    s.favoriteIds,
        favoriteDocs:   s.favoriteDocs,
        downloadedIds:  s.downloadedIds,
        downloadedDocs: s.downloadedDocs,
      }),
    }
  )
);
