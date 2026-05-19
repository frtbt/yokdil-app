export const API_BASE = 'https://euprathessoft.com/yokdil-api';

export const ENDPOINTS = {
  categories:    `${API_BASE}/categories.php`,
  documents:     `${API_BASE}/documents.php`,
  downloads:     `${API_BASE}/downloads.php`,
  userStats:     `${API_BASE}/user_stats.php`,
  studyHistory:  `${API_BASE}/study_history.php`,
  profileUpdate: `${API_BASE}/profile_update.php`,
  shareLink:     `${API_BASE}/share_link.php`,
  view:          `${API_BASE}/view.php`,
  favorites:     `${API_BASE}/favorites.php`,
  authGoogle:    `${API_BASE}/auth_google.php`,
  exams:         `${API_BASE}/exams.php`,
  examDetail:    `${API_BASE}/exam_detail.php`,
  examSubmit:    `${API_BASE}/exam_submit.php`,
  registerToken: `${API_BASE}/register_token.php`,
  searchPdf:     `${API_BASE}/search_pdf.php`,
} as const;
