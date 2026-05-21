// Ana tema renkleri: #febd01 (altın sarı), #000000 (siyah), #232425 (koyu gri)

export const Colors = {
  dark: {
    background:       '#000000',
    surface:          '#232425',
    surfaceSecondary: '#1a1a1b',
    text:             '#ffffff',
    textSecondary:    '#a0a0a0',
    textTertiary:     '#606060',
    border:           '#2a2a2b',
    borderLight:      '#1f1f20',
    primary:          '#febd01',
    primaryLight:     '#332800',
    tabBar:           '#232425',
    tabBarBorder:     '#2a2a2b',
    headerBg:         '#000000',
    shadow:           '#febd01',
  },
  light: {
    background:       '#f5f5f5',
    surface:          '#ffffff',
    surfaceSecondary: '#f0f0f0',
    text:             '#000000',
    textSecondary:    '#5a5a5a',
    textTertiary:     '#8a8a8a',
    border:           '#e0e0e0',
    borderLight:      '#f0f0f0',
    primary:          '#febd01',
    primaryLight:     '#fff8e0',
    tabBar:           '#ffffff',
    tabBarBorder:     '#e0e0e0',
    headerBg:         '#232425',
    shadow:           '#febd01',
  },
};

export const Gradients = {
  // Kategori gradyanları (bağımsız, tema dışı)
  konu:        ['#667EEA', '#764BA2'] as const,
  deneme:      ['#F093FB', '#F5576C'] as const,
  strateji:    ['#FF9A3C', '#FF6B35'] as const,
  kelime:      ['#4ECDC4', '#2BAE9E'] as const,
  ceviri:      ['#43E97B', '#38F9D7'] as const,
  poster:      ['#F7971E', '#FFD200'] as const,

  // Tema gradyanları
  header:      ['#000000', '#232425'] as const,
  headerCard:  ['#232425', '#2d2d2f'] as const,
  btn:         ['#febd01', '#e0a800'] as const,
};

export const CategoryColors = {
  konu: {
    gradient: Gradients.konu,
    accent: '#667EEA',
    bg: '#EEF0FF',
    darkBg: '#1E1C3A',
  },
  deneme: {
    gradient: Gradients.deneme,
    accent: '#F5576C',
    bg: '#FFF0F2',
    darkBg: '#2A1A1E',
  },
  strateji: {
    gradient: Gradients.strateji,
    accent: '#FF6B35',
    bg: '#FFF4EE',
    darkBg: '#2A1A0E',
  },
  kelime: {
    gradient: Gradients.kelime,
    accent: '#4ECDC4',
    bg: '#F0FFFE',
    darkBg: '#0E2220',
  },
  ceviri: {
    gradient: Gradients.ceviri,
    accent: '#43E97B',
    bg: '#F0FFF5',
    darkBg: '#0E2217',
  },
  poster: {
    gradient: Gradients.poster,
    accent: '#F7971E',
    bg: '#FFFBF0',
    darkBg: '#221A0E',
  },
};

export const DifficultyColors = {
  'Başlangıç': { bg: '#D1FAE5', text: '#059669', darkBg: '#052e16', darkText: '#34d399' },
  'Orta':      { bg: '#FEF3C7', text: '#D97706', darkBg: '#2d1a00', darkText: '#fbbf24' },
  'İleri':     { bg: '#FEE2E2', text: '#DC2626', darkBg: '#2d0a0a', darkText: '#f87171' },
};
