import { create } from 'zustand';
import { ENDPOINTS } from '../constants/Api';
import type { ExamType, Difficulty } from '../constants/Data';

export interface Exam {
  id: number;
  title: string;
  description: string | null;
  exam_date: string | null;
  exam_type: ExamType;
  difficulty: Difficulty;
  duration_minutes: number;
  question_count: number;
  user_completed: boolean;
  user_best_pct: number | null;
  user_best_score: number | null;
  user_best_total: number | null;
  user_attempt_count: number;
}

export interface Question {
  id: number;
  exam_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  sort_order: number;
}

export interface QuestionCorrection {
  question_id: number;
  question_text: string;
  your_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
  video_url: string | null;
  options: Record<string, string>;
}

export interface ExamResult {
  exam_id: number;
  score: number;
  total: number;
  percentage: number;
  time_spent_seconds: number;
  corrections: QuestionCorrection[];
}

interface ExamState {
  exams: Exam[];
  loadingExams: boolean;
  activeExam: Exam | null;
  activeQuestions: Question[];
  loadingDetail: boolean;
  lastResult: ExamResult | null;

  fetchExams: (examType?: string, token?: string) => Promise<void>;
  fetchExamDetail: (id: number) => Promise<void>;
  submitExam: (
    examId: number,
    answers: Record<number, string>,
    timeSpent: number,
    token: string,
  ) => Promise<ExamResult | null>;
  clearResult: () => void;
}

export const useExamStore = create<ExamState>()((set) => ({
  exams: [],
  loadingExams: false,
  activeExam: null,
  activeQuestions: [],
  loadingDetail: false,
  lastResult: null,

  fetchExams: async (examType?: string, token?: string) => {
    set({ loadingExams: true });
    try {
      const params = new URLSearchParams();
      if (examType) params.set('exam_type', examType);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res  = await fetch(`${ENDPOINTS.exams}?${params}`, { headers });
      const json = await res.json();
      if (json.success) {
        set({ exams: json.data as Exam[], loadingExams: false });
      } else {
        set({ loadingExams: false });
      }
    } catch {
      set({ loadingExams: false });
    }
  },

  fetchExamDetail: async (id: number) => {
    set({ loadingDetail: true, activeExam: null, activeQuestions: [] });
    try {
      const res  = await fetch(`${ENDPOINTS.examDetail}?id=${id}`);
      const json = await res.json();
      if (json.success) {
        set({
          activeExam:      json.exam      as Exam,
          activeQuestions: json.questions as Question[],
          loadingDetail:   false,
        });
      } else {
        set({ loadingDetail: false });
      }
    } catch {
      set({ loadingDetail: false });
    }
  },

  submitExam: async (
    examId: number,
    answers: Record<number, string>,
    timeSpent: number,
    token: string,
  ): Promise<ExamResult | null> => {
    try {
      const res  = await fetch(ENDPOINTS.examSubmit, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          exam_id:             examId,
          answers:             answers,
          time_spent_seconds:  timeSpent,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const result: ExamResult = {
          exam_id:             examId,
          score:               json.score,
          total:               json.total,
          percentage:          json.percentage,
          time_spent_seconds:  json.time_spent_seconds ?? timeSpent,
          corrections:         json.corrections,
        };
        set({ lastResult: result });
        return result;
      }
      return null;
    } catch {
      return null;
    }
  },

  clearResult: () => set({ lastResult: null }),
}));
