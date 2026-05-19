import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  Keyboard, Linking, PanResponder, PixelRatio, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Pdf from 'react-native-pdf';
import ViewShot from 'react-native-view-shot';
import Svg, { G, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import BarcodeScanning, { BarcodeFormat } from '@react-native-ml-kit/barcode-scanning';
import {
  loadAnnotations, saveAnnotations, type Stroke,
  loadTextAnnotations, saveTextAnnotations, type TextAnnotation,
} from '../services/db';
import { extractPageTextsNative } from '../services/pdfText';

const { width: SW } = Dimensions.get('window');

// ── SVG yardımcıları ──────────────────────────────────────────────────────────

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y} L${pts[0].x + 0.1},${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1);
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1);
    d += ` Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)},${mx},${my}`;
  }
  const l = pts[pts.length - 1];
  d += ` L${l.x.toFixed(1)},${l.y.toFixed(1)}`;
  return d;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── PDF metin çıkarma — PdfiumAndroid native modül (tam Unicode desteği) ────────
// extractPageTextsNative → PdfTextModule.kt → io.legere:pdfiumandroid → PDFium C++

async function extractPageTexts(fileUri: string): Promise<string[]> {
  return extractPageTextsNative(fileUri);
}

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface PDFReaderProps {
  fileUri: string;
  docId: number;
  isOffline: boolean;
  userName?: string;
  onLoadComplete?: (pages: number) => void;
  onClose?: () => void;
}

const PEN_COLORS  = ['#FF3366', '#3B82F6', '#22C55E', '#F59E0B', '#6C63FF', '#000000'];
const PEN_WIDTHS  = [2, 4, 8];
const ERASER_COLOR = '#FFFFFF';
const ERASER_WIDTH = 24;
const TEXT_COLORS = ['#FFD700', '#FF6B9D', '#00E5FF', '#A8FF3E', '#FFFFFF'];
const TEXT_SIZES  = [12, 16, 20];

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export default function PDFReader({
  fileUri, docId, isOffline, userName, onLoadComplete,
}: PDFReaderProps) {

  const pdfRef = useRef<any>(null);

  // PDF state
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [totalPages, setTotalPages]   = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [overlayH, setOverlayH]       = useState(0);

  // Çizim
  const [drawMode, setDrawMode]   = useState(false);
  const [isEraser, setIsEraser]   = useState(false);
  const [penColor, setPenColor]   = useState('#FF3366');
  const [penWidth, setPenWidth]   = useState(4);
  const [strokes, setStrokes]     = useState<Stroke[]>([]);
  const [activeStroke, setActive] = useState<{ id: string; pts: { x: number; y: number }[] } | null>(null);

  // UI
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolAnim = useRef(new Animated.Value(1)).current;

  // Arama
  const [searchVisible, setSearchVisible]         = useState(false);
  const [searchQuery, setSearchQuery]             = useState('');
  const [searchPages, setSearchPages]             = useState<number[]>([]);
  const [searchIdx, setSearchIdx]                 = useState(0);
  const [searchResultTotal, setSearchResultTotal] = useState(0);
  const searchBarAnim  = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  // Metin çıkarma
  const [pageTexts, setPageTexts]       = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // QR (native ML Kit)
  const [currentQrUrl, setCurrentQrUrl] = useState<string | null>(null);
  const qrScanningRef = useRef(false);

  // Metin notları
  const [textMode, setTextMode]                       = useState(false);
  const [textAnnotations, setTextAnnotations]         = useState<TextAnnotation[]>([]);
  const [pendingTextPos, setPendingTextPos]           = useState<{ x: number; y: number } | null>(null);
  const [pendingTextValue, setPendingTextValue]       = useState('');
  const [editingAnnotationId, setEditingAnnId]        = useState<string | null>(null);
  const [textColor, setTextColor]                     = useState(TEXT_COLORS[0]);
  const [textSize, setTextSize]                       = useState(16);

  // Link badge pulse
  const linkPulse = useRef(new Animated.Value(1)).current;

  // Arama vurgulama pulse
  const highlightPulse = useRef(new Animated.Value(1)).current;

  // Yükleme animasyonu
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Retry key
  const [retryKey, setRetryKey] = useState(0);

  // İçindekiler (TOC)
  const [toc, setToc] = useState<Array<{
    muted: boolean; title: string; children: any[]; pageNumber: number;
  }>>([]);

  // Kırpma modu
  const [cropMode, setCropMode] = useState(false);
  const [cropBox, setCropBox]   = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const viewShotRef  = useRef<any>(null);

  // Çizim için güncel değer ref'leri
  const isEraserRef = useRef(isEraser);
  const penColorRef = useRef(penColor);
  const penWidthRef = useRef(penWidth);
  isEraserRef.current = isEraser;
  penColorRef.current = penColor;
  penWidthRef.current = penWidth;

  // Metin notları için ref'ler
  const textAnnotationsRef = useRef<TextAnnotation[]>([]);
  const textColorRef       = useRef(textColor);
  const textSizeRef        = useRef(textSize);
  textAnnotationsRef.current = textAnnotations;
  textColorRef.current       = textColor;
  textSizeRef.current        = textSize;

  // Annotation cache
  const pendingRef   = useRef<Map<number, Stroke[]>>(new Map());
  const currentRef   = useRef(currentPage);
  const strokesRef   = useRef(strokes);
  strokesRef.current = strokes;
  currentRef.current = currentPage;

  // ── Annotasyon yükleme / kaydetme ────────────────────────────────────────────

  const loadPage = useCallback(async (page: number) => {
    if (pendingRef.current.has(page)) {
      setStrokes(pendingRef.current.get(page)!);
      return;
    }
    const saved = await loadAnnotations(docId, page);
    setStrokes(saved);
  }, [docId]);

  const saveCurrent = useCallback((page: number, current: Stroke[]) => {
    pendingRef.current.set(page, current);
    saveAnnotations(docId, page, current);
  }, [docId]);

  // ── Metin notu yükleme / kaydetme ───────────────────────────────────────────

  const loadTextPage = useCallback(async (page: number) => {
    setTextAnnotations([]);
    const anns = await loadTextAnnotations(docId, page);
    setTextAnnotations(anns);
  }, [docId]);

  const saveTextPage = useCallback((page: number, anns: TextAnnotation[]) => {
    saveTextAnnotations(docId, page, anns);
  }, [docId]);

  // ── Sayfa geçişi ─────────────────────────────────────────────────────────────

  const goToPage = useCallback((target: number) => {
    if (!totalPages) return;
    const page = Math.max(1, Math.min(totalPages, target));
    if (page === currentRef.current) return;
    saveCurrent(currentRef.current, strokesRef.current);
    saveTextPage(currentRef.current, textAnnotationsRef.current);
    currentRef.current = page;
    setCurrentPage(page);
    setActive(null);
    setPendingTextPos(null);
    setPendingTextValue('');
    setEditingAnnId(null);
    loadPage(page);
    loadTextPage(page);
    pdfRef.current?.setPage(page);
    Haptics.selectionAsync();
  }, [totalPages, saveCurrent, loadPage, saveTextPage, loadTextPage]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage === currentRef.current) return;
    saveCurrent(currentRef.current, strokesRef.current);
    saveTextPage(currentRef.current, textAnnotationsRef.current);
    currentRef.current = newPage;
    setCurrentPage(newPage);
    setActive(null);
    setPendingTextPos(null);
    setPendingTextValue('');
    setEditingAnnId(null);
    loadPage(newPage);
    loadTextPage(newPage);
    setCurrentQrUrl(null);
  }, [saveCurrent, loadPage, saveTextPage, loadTextPage]);

  // ── QR tarama (native Google ML Kit — WebView yok, canvas yok) ───────────────

  const scanPageForQR = useCallback(async () => {
    if (!viewShotRef.current || qrScanningRef.current || loading) return;
    qrScanningRef.current = true;
    try {
      const uri      = await viewShotRef.current.capture();
      const barcodes = await BarcodeScanning.scan(uri);
      qrScanningRef.current = false;
      const qr = barcodes.find(
        b => b.format === BarcodeFormat.QR_CODE && b.value && /^https?:\/\//.test(b.value),
      );
      setCurrentQrUrl(qr?.value ?? null);
    } catch {
      qrScanningRef.current = false;
      setCurrentQrUrl(null);
    }
  }, [loading]);

  // ── Metin notu işlemleri ─────────────────────────────────────────────────────

  const handleSaveTextAnnotation = useCallback(() => {
    const q = pendingTextValue.trim();
    if (!q || !pendingTextPos) return;
    const ann: TextAnnotation = {
      id: editingAnnotationId || uid(),
      text: q,
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      color: textColorRef.current,
      fontSize: textSizeRef.current,
    };
    setTextAnnotations(prev => {
      const next = editingAnnotationId
        ? prev.map(a => a.id === editingAnnotationId ? ann : a)
        : [...prev, ann];
      saveTextAnnotations(docId, currentRef.current, next);
      return next;
    });
    setPendingTextPos(null);
    setPendingTextValue('');
    setEditingAnnId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingTextValue, pendingTextPos, editingAnnotationId, docId]);

  const handleDeleteTextAnnotation = useCallback((id: string) => {
    Alert.alert('Notu Sil', 'Bu not silinecek, emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: () => {
          setTextAnnotations(prev => {
            const next = prev.filter(a => a.id !== id);
            saveTextAnnotations(docId, currentRef.current, next);
            return next;
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [docId]);

  const handleEditTextAnnotation = useCallback((ann: TextAnnotation) => {
    setPendingTextPos({ x: ann.x, y: ann.y });
    setPendingTextValue(ann.text);
    setEditingAnnId(ann.id);
  }, []);

  // ── Effect'ler ───────────────────────────────────────────────────────────────

  useEffect(() => { loadPage(1); loadTextPage(1); }, [loadPage, loadTextPage]);

  useEffect(() => {
    if (!loading) return;
    loadTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 30000);
    return () => { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); };
  }, [loading]);

  useEffect(() => {
    if (!loading) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, pulseAnim]);

  useEffect(() => () => {
    saveCurrent(currentRef.current, strokesRef.current);
    saveTextPage(currentRef.current, textAnnotationsRef.current);
  }, [saveCurrent, saveTextPage]);

  // fileUri değiştiğinde tüm state'i sıfırla
  useEffect(() => {
    setLoading(true);
    setError(false);
    setCurrentPage(1);
    setTotalPages(0);
    setToc([]);
    setSearchPages([]);
    setSearchIdx(0);
    setSearchResultTotal(0);
    setPageTexts([]);
    setIsExtracting(false);
    setCurrentQrUrl(null);
    setCropMode(false);
    setCropBox(null);
    cropStartRef.current = null;
    setTextMode(false);
    setTextAnnotations([]);
    setPendingTextPos(null);
    setPendingTextValue('');
    setEditingAnnId(null);
    currentRef.current = 1;
    pendingRef.current.clear();
    loadPage(1);
    loadTextPage(1);
  }, [fileUri, loadTextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // QR URL badge pulse animasyonu
  useEffect(() => {
    if (!currentQrUrl) { linkPulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(linkPulse, { toValue: 0.55, duration: 850, useNativeDriver: true }),
        Animated.timing(linkPulse, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); linkPulse.setValue(1); };
  }, [currentQrUrl, linkPulse]);

  // Sayfa değişince QR tara (700ms gecikme — render bitmesini bekler)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(scanPageForQR, 700);
    return () => clearTimeout(t);
  }, [currentPage, loading, scanPageForQR]);

  // Arama eşleşmesi olan sayfada vurgulama pulsu
  useEffect(() => {
    const isMatch = searchPages.length > 0 && searchPages.includes(currentPage) && !!searchQuery;
    if (!isMatch) { highlightPulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightPulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        Animated.timing(highlightPulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); highlightPulse.setValue(1); };
  }, [searchPages, currentPage, searchQuery, highlightPulse]);

  // ── Arama ────────────────────────────────────────────────────────────────────

  const toggleSearch = useCallback(() => {
    const next = !searchVisible;
    setSearchVisible(next);
    Animated.spring(searchBarAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
    if (next) {
      setTimeout(() => searchInputRef.current?.focus(), 250);
    } else {
      setSearchQuery('');
      setSearchPages([]);
      setSearchIdx(0);
      Keyboard.dismiss();
    }
  }, [searchVisible, searchBarAnim]);

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    Keyboard.dismiss();

    if (pageTexts.length === 0) {
      setSearchPages([]);
      return;
    }

    const escaped = q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re      = new RegExp(escaped, 'gi');
    const matches: number[] = [];
    let total = 0;

    pageTexts.forEach((text, i) => {
      if (!text) return;
      const ms = text.match(re);
      if (ms && ms.length > 0) {
        matches.push(i + 1);
        total += ms.length;
      }
    });

    setSearchResultTotal(total);
    setSearchPages(matches);
    setSearchIdx(0);

    if (matches.length > 0) {
      goToPage(matches[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [searchQuery, pageTexts, goToPage]);

  const goNextMatch = useCallback(() => {
    if (!searchPages.length) return;
    const idx = (searchIdx + 1) % searchPages.length;
    setSearchIdx(idx);
    goToPage(searchPages[idx]);
    Haptics.selectionAsync();
  }, [searchPages, searchIdx, goToPage]);

  const goPrevMatch = useCallback(() => {
    if (!searchPages.length) return;
    const idx = (searchIdx - 1 + searchPages.length) % searchPages.length;
    setSearchIdx(idx);
    goToPage(searchPages[idx]);
    Haptics.selectionAsync();
  }, [searchPages, searchIdx, goToPage]);

  // ── Kırpma ───────────────────────────────────────────────────────────────────

  const cropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        cropStartRef.current = { x, y };
        setCropBox({ x, y, w: 0, h: 0 });
      },
      onPanResponderMove: (e) => {
        if (!cropStartRef.current) return;
        const { locationX: x, locationY: y } = e.nativeEvent;
        const sx = cropStartRef.current.x;
        const sy = cropStartRef.current.y;
        setCropBox({
          x: Math.min(sx, x),
          y: Math.min(sy, y),
          w: Math.abs(x - sx),
          h: Math.abs(y - sy),
        });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // ── Metin modu dokunma yakalayıcı ───────────────────────────────────────────

  const textTapResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => false,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setPendingTextPos({ x, y });
        setPendingTextValue('');
        setEditingAnnId(null);
      },
    })
  ).current;

  const handleCropSave = useCallback(async () => {
    if (!viewShotRef.current || !cropBox || cropBox.w < 20 || cropBox.h < 20) {
      Alert.alert('Seçim gerekli', 'Kaydetmek istediğiniz alanı parmağınızla çizin.');
      return;
    }
    const box = { ...cropBox };
    // Overlay'i kaldırarak temiz ekran görüntüsü al
    setCropMode(false);
    setCropBox(null);
    cropStartRef.current = null;
    await new Promise<void>(r => setTimeout(r, 60));
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin gerekli', 'Galeri erişim izni verilmedi.');
        return;
      }
      const uri    = await viewShotRef.current.capture();
      const ratio  = PixelRatio.get();
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: {
          originX: Math.round(box.x * ratio),
          originY: Math.round(box.y * ratio),
          width:   Math.max(1, Math.round(box.w * ratio)),
          height:  Math.max(1, Math.round(box.h * ratio)),
        }}],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.92 },
      );
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      await MediaLibrary.createAlbumAsync('YÖKDİL', asset, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Kaydedildi ✓', 'Görsel YÖKDİL albümüne eklendi.');
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Görsel kaydedilemedi.');
    }
  }, [cropBox]);

  // ── PanResponder (çizim) ─────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setActive({ id: uid(), pts: [{ x, y }] });
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setActive(prev => prev ? { ...prev, pts: [...prev.pts, { x, y }] } : prev);
      },
      onPanResponderRelease: () => {
        setActive(prev => {
          if (!prev || prev.pts.length === 0) return null;
          const newStroke: Stroke = {
            id:     prev.id,
            color:  isEraserRef.current ? ERASER_COLOR : penColorRef.current,
            width:  isEraserRef.current ? ERASER_WIDTH : penWidthRef.current,
            points: prev.pts,
          };
          const updated = [...strokesRef.current, newStroke];
          strokesRef.current = updated;
          setStrokes(updated);
          saveCurrent(currentRef.current, updated);
          Haptics.selectionAsync();
          return null;
        });
      },
    })
  ).current;

  // ── Geri al / Temizle ────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      saveCurrent(currentRef.current, next);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [saveCurrent]);

  const handleClear = useCallback(() => {
    Alert.alert('Çizimleri Temizle', 'Bu sayfadaki tüm çizimler silinecek, emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Temizle', style: 'destructive',
        onPress: () => {
          setStrokes([]);
          saveCurrent(currentRef.current, []);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [saveCurrent]);

  // ── Toolbar aç/kapat ─────────────────────────────────────────────────────────

  const toggleToolbar = useCallback(() => {
    const to = toolbarVisible ? 0 : 1;
    Animated.timing(toolAnim, { toValue: to, duration: 200, useNativeDriver: true }).start();
    setToolbarVisible(!toolbarVisible);
  }, [toolbarVisible, toolAnim]);

  // ── Hesaplamalar ─────────────────────────────────────────────────────────────

  const isLocal        = fileUri.startsWith('file://');
  const source         = { uri: fileUri, cache: !isLocal, expiration: isLocal ? 0 : 86400 * 7 };
  const searchBarH     = searchBarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });
  const isOnResultPage = searchPages.length > 0 && searchPages.includes(currentPage);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── ARAMA BARI ── */}
      <Animated.View style={[styles.searchBar, { height: searchBarH }]}>
        <View style={styles.searchInner}>
          {isExtracting ? (
            <ActivityIndicator size="small" color="#6C63FF" style={styles.searchIcon} />
          ) : (
            <Feather name="search" size={15} color="#6B7280" style={styles.searchIcon} />
          )}
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="Kelime ara (metin taraması)..."
            placeholderTextColor="#4B5563"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchPages.length > 0 && (
            <View style={styles.matchRow}>
              <TouchableOpacity onPress={goPrevMatch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="chevron-up" size={16} color="#6C63FF" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.matchTxt}>{searchIdx + 1} / {searchPages.length}</Text>
                {searchResultTotal > 0 && (
                  <Text style={styles.matchTotalTxt}>{searchResultTotal} eşleşme</Text>
                )}
              </View>
              <TouchableOpacity onPress={goNextMatch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="chevron-down" size={16} color="#6C63FF" />
              </TouchableOpacity>
            </View>
          )}
          {isExtracting && searchPages.length === 0 && (
            <Text style={styles.extractTxt}>Analiz...</Text>
          )}
          {!isExtracting && searchQuery.length > 0 && searchPages.length === 0 && (
            <Text style={styles.noMatchTxt}>0 sonuç</Text>
          )}
          <TouchableOpacity onPress={toggleSearch} style={styles.searchClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── PDF ALANI (ViewShot ile kırpma için sarıldı) ── */}
      <ViewShot ref={viewShotRef} style={{ flex: 1 }} options={{ format: 'jpg', quality: 0.9 }}>
        <View
          style={styles.pdfWrap}
          onLayout={e => setOverlayH(e.nativeEvent.layout.height)}
        >
          <Pdf
            ref={pdfRef}
            key={`${fileUri}-${retryKey}`}
            source={source}
            enablePaging
            horizontal
            page={1}
            enableAntialiasing
            {...{ enableTextSelection: true } as any}
            onLoadComplete={(n, _path, _size, tocItems) => {
              if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
              setTotalPages(n);
              setToc((tocItems as any[]) || []);
              setLoading(false);
              onLoadComplete?.(n);
              // Metin çıkarma: sadece yerel dosyalar, arka planda
              if (fileUri.startsWith('file://')) {
                setIsExtracting(true);
                extractPageTexts(fileUri).then(texts => {
                  setPageTexts(texts);
                  setIsExtracting(false);
                });
              }
            }}
            onPageChanged={(p) => handlePageChange(p)}
            onError={(err) => {
              if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
              console.warn('PDFReader error:', err);
              setLoading(false);
              setError(true);
            }}
            style={[styles.pdf, { pointerEvents: (drawMode || cropMode) ? 'none' : 'auto' } as any]}
            trustAllCerts
          />

          {/* Sayfa chip */}
          <TouchableOpacity style={styles.pageChip} onPress={toggleToolbar} activeOpacity={0.8}>
            <Text style={styles.pageChipTxt}>{currentPage} / {totalPages || '—'}</Text>
            {isOffline && <Text style={styles.offlineDot}> ⚡</Text>}
          </TouchableOpacity>

          {/* 🔗 QR Badge — native ML Kit QR tespit edilince */}
          {currentQrUrl && !drawMode && !cropMode && !textMode && !loading && (
            <Animated.View style={[styles.linkBadge, { opacity: linkPulse }]}>
              <TouchableOpacity
                style={styles.linkBadgeInner}
                onPress={() => Linking.openURL(currentQrUrl).catch(() => {})}
                activeOpacity={0.8}
              >
                <Feather name="link" size={11} color="#fff" />
                <Text style={styles.linkBadgeTxt}>Linke Git</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* 🔍 Arama highlight chip — eşleşme sayfasında pulse ile */}
          {isOnResultPage && !cropMode && !!searchQuery && (
            <Animated.View
              style={[styles.matchBannerWrap, { opacity: highlightPulse }]}
              pointerEvents="none"
            >
              <View style={styles.matchBanner}>
                <Feather name="search" size={11} color="#1a1200" />
                <Text style={styles.matchBannerKeyword} numberOfLines={1}>
                  {searchQuery.length > 18 ? searchQuery.slice(0, 18) + '…' : searchQuery}
                </Text>
                <View style={styles.matchBannerDivider} />
                <Text style={styles.matchBannerCount}>
                  {searchIdx + 1} / {searchPages.length}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ── Metin notları ── */}
          {textAnnotations.map(ann => (
            <View
              key={ann.id}
              style={[styles.textNote, { left: ann.x, top: ann.y - ann.fontSize - 10 }]}
              pointerEvents={(drawMode || cropMode) ? 'none' : 'auto'}
            >
              <Text style={[styles.textNoteTxt, { color: ann.color, fontSize: ann.fontSize }]}>
                {ann.text}
              </Text>
              {textMode && !pendingTextPos && (
                <View style={styles.textNoteActions}>
                  <TouchableOpacity
                    onPress={() => handleEditTextAnnotation(ann)}
                    hitSlop={{ top: 8, right: 6, bottom: 8, left: 6 }}
                    style={styles.textNoteAction}
                  >
                    <Feather name="edit-2" size={9} color="#E2E8F0" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteTextAnnotation(ann.id)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 6 }}
                    style={[styles.textNoteAction, { backgroundColor: '#FF3B3022' }]}
                  >
                    <Feather name="x" size={9} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {/* Metin modu dokunma yakalayıcı */}
          {textMode && !pendingTextPos && overlayH > 0 && (
            <View
              style={[styles.textTapOverlay, { height: overlayH }]}
              {...textTapResponder.panHandlers}
            >
              <View style={styles.textTapHint} pointerEvents="none">
                <Text style={styles.textTapHintTxt}>Not eklemek için yere dokun</Text>
              </View>
            </View>
          )}

          {/* Bekleyen metin giriş kartı */}
          {pendingTextPos && textMode && (
            <View
              style={[
                styles.textInputCard,
                {
                  top:  Math.max(8, pendingTextPos.y > overlayH * 0.65
                    ? pendingTextPos.y - 160
                    : pendingTextPos.y + 14),
                  left: Math.max(8, Math.min(pendingTextPos.x - 110, SW - 244)),
                },
              ]}
            >
              <TextInput
                value={pendingTextValue}
                onChangeText={setPendingTextValue}
                style={styles.textInputField}
                multiline
                autoFocus
                maxLength={200}
                placeholder="Notunuzu yazın..."
                placeholderTextColor="#6B7280"
                blurOnSubmit={false}
              />
              <View style={styles.textInputActions}>
                <TouchableOpacity
                  onPress={() => { setPendingTextPos(null); setPendingTextValue(''); setEditingAnnId(null); }}
                  style={styles.textInputCancelBtn}
                >
                  <Text style={styles.textInputCancelTxt}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveTextAnnotation}
                  style={[styles.textInputSaveBtn, !pendingTextValue.trim() && { opacity: 0.4 }]}
                  disabled={!pendingTextValue.trim()}
                >
                  <Feather name="check" size={13} color="#000" />
                  <Text style={styles.textInputSaveTxt}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Çizim katmanı */}
          {drawMode && overlayH > 0 && (
            <View
              style={[styles.overlay, { height: overlayH }]}
              {...panResponder.panHandlers}
            >
              <Svg width={SW} height={overlayH} style={StyleSheet.absoluteFill} pointerEvents="none">
                <G>
                  {strokes.map(s => (
                    <Path
                      key={s.id}
                      d={smoothPath(s.points)}
                      stroke={s.color}
                      strokeWidth={s.width}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {activeStroke && (
                    <Path
                      d={smoothPath(activeStroke.pts)}
                      stroke={isEraser ? ERASER_COLOR : penColor}
                      strokeWidth={isEraser ? ERASER_WIDTH : penWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </G>
              </Svg>
            </View>
          )}

          {/* Kırpma overlay */}
          {cropMode && overlayH > 0 && (
            <View
              style={[styles.cropOverlay, { height: overlayH }]}
              {...cropPanResponder.panHandlers}
            >
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }]}
                pointerEvents="none"
              />
              {cropBox && cropBox.w > 4 && cropBox.h > 4 && (
                <View
                  pointerEvents="none"
                  style={[styles.cropBox, {
                    left: cropBox.x, top: cropBox.y,
                    width: cropBox.w, height: cropBox.h,
                  }]}
                />
              )}
              <View style={styles.cropHint} pointerEvents="none">
                <Text style={styles.cropHintTxt}>Parmağınızla kırpılacak alanı seçin</Text>
              </View>
            </View>
          )}

          {/* Yükleniyor */}
          {loading && !error && (
            <View style={styles.overlay2}>
              <Animated.View style={[styles.loadingCard, { opacity: pulseAnim }]}>
                <View style={styles.loadingRing}>
                  <ActivityIndicator size="large" color="#6C63FF" />
                </View>
                <Text style={styles.loadTxt}>PDF açılıyor...</Text>
                <Text style={styles.loadSubTxt}>Lütfen bekleyin</Text>
              </Animated.View>
            </View>
          )}

          {/* Hata */}
          {error && (
            <View style={styles.overlay2}>
              <View style={[
                styles.errorIconWrap,
                { backgroundColor: isOffline ? '#43E97B18' : '#FF6B6B18' },
              ]}>
                <Feather
                  name={isOffline ? 'wifi-off' : 'alert-circle'}
                  size={34}
                  color={isOffline ? '#43E97B' : '#FF6B6B'}
                />
              </View>
              <Text style={styles.errorTxt}>PDF yüklenemedi</Text>
              <Text style={styles.errorSub}>
                {isOffline
                  ? 'İnternet bağlantısı yok ve PDF indirilmemiş.'
                  : 'Dosya açılamadı. Lütfen tekrar deneyin.'}
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setRetryKey(k => k + 1); setError(false); setLoading(true); }}
              >
                <Feather name="refresh-cw" size={14} color="#fff" />
                <Text style={styles.retryTxt}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Kaydedilmiş çizim önizlemesi */}
          {strokes.length > 0 && !drawMode && !cropMode && overlayH > 0 && (
            <TouchableOpacity
              style={[styles.annotBadge, { height: overlayH }]}
              onPress={() => setDrawMode(true)}
              activeOpacity={1}
            >
              <Svg width={SW} height={overlayH} style={StyleSheet.absoluteFill} pointerEvents="none">
                <G>
                  {strokes.map(s => (
                    <Path
                      key={s.id}
                      d={smoothPath(s.points)}
                      stroke={s.color}
                      strokeWidth={s.width}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.6}
                    />
                  ))}
                </G>
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </ViewShot>

      {/* ── ALT TOOLBAR ── */}
      <Animated.View style={[
        styles.toolbar,
        {
          opacity: toolAnim,
          transform: [{
            translateY: toolAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }),
          }],
        },
      ]}>
        {cropMode ? (
          <View style={[styles.toolRow, { justifyContent: 'center', gap: 14 }]}>
            <TouchableOpacity
              style={[styles.cropActionBtn, { backgroundColor: '#1E1E3A' }]}
              onPress={() => { setCropMode(false); setCropBox(null); cropStartRef.current = null; }}
            >
              <Feather name="x" size={16} color="#6B7280" />
              <Text style={[styles.cropActionTxt, { color: '#6B7280' }]}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cropActionBtn, { backgroundColor: '#F59E0B' }]}
              onPress={handleCropSave}
            >
              <Feather name="save" size={16} color="#fff" />
              <Text style={[styles.cropActionTxt, { color: '#fff' }]}>Galeriye Kaydet</Text>
            </TouchableOpacity>
          </View>
        ) : textMode ? (
          /* ── Metin modu araç çubuğu ── */
          <View style={styles.toolRow}>
            {TEXT_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setTextColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c, borderColor: '#1E1E3A', borderWidth: 1 },
                  textColor === c && styles.colorDotActive,
                ]}
              />
            ))}
            <View style={styles.sep} />
            {TEXT_SIZES.map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setTextSize(s)}
                style={[
                  styles.widthBtn,
                  textSize === s && { backgroundColor: textColor + '33' },
                ]}
              >
                <Text style={{
                  fontSize: s === 12 ? 10 : s === 16 ? 12 : 14,
                  color: textSize === s ? textColor : '#6B7280',
                  fontWeight: '700',
                }}>
                  {s === 12 ? 'S' : s === 16 ? 'M' : 'L'}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.sep} />
            <ToolBtn
              icon="check-circle"
              onPress={() => {
                setPendingTextPos(null);
                setPendingTextValue('');
                setEditingAnnId(null);
                setTextMode(false);
              }}
              active
              activeColor="#43E97B"
            />
          </View>
        ) : !drawMode ? (
          <View style={styles.toolRow}>
            <ToolBtn icon="arrow-left"  onPress={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} />
            <ToolBtn icon="arrow-right" onPress={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} />
            <View style={styles.sep} />
            <ToolBtn icon="search" onPress={toggleSearch} active={searchVisible} activeColor="#6C63FF" />
            <ToolBtn
              icon="edit-2"
              onPress={() => { setDrawMode(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              active={false}
              activeColor="#FF3366"
              label={strokes.length > 0 ? `${strokes.length}` : undefined}
            />
            <ToolBtn
              icon="type"
              onPress={() => { setTextMode(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              active={false}
              activeColor="#F59E0B"
              label={textAnnotations.length > 0 ? `${textAnnotations.length}` : undefined}
            />
            <ToolBtn
              icon="scissors"
              onPress={() => {
                setCropMode(true);
                setCropBox(null);
                cropStartRef.current = null;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              active={false}
              activeColor="#F59E0B"
            />
          </View>
        ) : (
          <View style={styles.toolRow}>
            {PEN_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => { setIsEraser(false); setPenColor(c); }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  !isEraser && penColor === c && styles.colorDotActive,
                ]}
              />
            ))}
            <View style={styles.sep} />
            {PEN_WIDTHS.map(w => (
              <TouchableOpacity
                key={w}
                onPress={() => { setIsEraser(false); setPenWidth(w); }}
                style={[
                  styles.widthBtn,
                  !isEraser && penWidth === w && { backgroundColor: penColor + '33' },
                ]}
              >
                <View style={{
                  width: w * 2.5, height: w * 2.5, borderRadius: w * 2.5,
                  backgroundColor: (!isEraser && penWidth === w) ? penColor : '#6B7280',
                }} />
              </TouchableOpacity>
            ))}
            <View style={styles.sep} />
            <ToolBtn icon="delete"         onPress={() => setIsEraser(!isEraser)} active={isEraser} activeColor="#F59E0B" />
            <ToolBtn icon="corner-up-left" onPress={handleUndo}  disabled={strokes.length === 0} />
            <ToolBtn icon="trash-2"        onPress={handleClear} />
            <ToolBtn icon="check-circle"   onPress={() => setDrawMode(false)} activeColor="#43E97B" active />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ── Küçük buton ───────────────────────────────────────────────────────────────

function ToolBtn({
  icon, onPress, active, activeColor, disabled, label,
}: {
  icon: string; onPress: () => void; active?: boolean;
  activeColor?: string; disabled?: boolean; label?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toolBtn,
        active    && { backgroundColor: (activeColor ?? '#6C63FF') + '22' },
        disabled  && { opacity: 0.35 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Feather name={icon as any} size={19} color={active ? (activeColor ?? '#6C63FF') : '#CBD5E1'} />
      {label ? <Text style={[styles.toolBadge, { color: activeColor ?? '#6C63FF' }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1A2E' },
  searchBar: { backgroundColor: '#0D0D1F', borderBottomWidth: 1, borderBottomColor: '#1E1E3A', overflow: 'hidden' },
  searchInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 4 },
  searchIcon:  { marginHorizontal: 10 },
  searchInput: { flex: 1, color: '#E2E8F0', fontSize: 14, paddingVertical: 0, paddingHorizontal: 4 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6C63FF18', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5, marginHorizontal: 4,
  },
  matchTxt:      { color: '#6C63FF', fontSize: 12, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  matchTotalTxt: { color: '#A78BFA', fontSize: 9,  fontWeight: '600', textAlign: 'center' },
  extractTxt:    { color: '#6B7280', fontSize: 10, marginHorizontal: 4 },
  noMatchTxt:    { color: '#6B7280', fontSize: 12, marginHorizontal: 8 },
  searchClose:   { paddingHorizontal: 10, paddingVertical: 6 },

  pdfWrap: { flex: 1, position: 'relative' },
  pdf:     { flex: 1, width: SW, backgroundColor: '#fff' },

  pageChip: {
    position: 'absolute', top: 12, left: SW / 2 - 44,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    flexDirection: 'row', alignItems: 'center', zIndex: 30,
  },
  pageChipTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  offlineDot:  { color: '#43E97B', fontSize: 12 },

  linkBadge: { position: 'absolute', top: 12, right: 12, zIndex: 32 },
  linkBadgeInner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#6C63FF', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65, shadowRadius: 10, elevation: 8,
  },
  linkBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  matchBannerWrap: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center', zIndex: 28 },
  matchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFD700', borderRadius: 20,
    paddingHorizontal: 13, paddingVertical: 7,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
    maxWidth: SW - 32,
  },
  matchBannerKeyword: {
    color: '#1a1200', fontSize: 12, fontWeight: '800',
    maxWidth: 140, flexShrink: 1,
  },
  matchBannerDivider: { width: 1, height: 12, backgroundColor: 'rgba(0,0,0,0.2)' },
  matchBannerCount: { color: '#3a2e00', fontSize: 11, fontWeight: '600' },

  overlay: { position: 'absolute', top: 0, left: 0, width: SW, zIndex: 10 },

  cropOverlay: { position: 'absolute', top: 0, left: 0, width: SW, zIndex: 16 },
  cropBox: { position: 'absolute', borderWidth: 2, borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.08)' },
  cropHint: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  cropHintTxt: {
    color: '#F59E0B', fontSize: 13, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, overflow: 'hidden',
  },

  cropActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  cropActionTxt: { fontSize: 14, fontWeight: '700' },

  overlay2: { ...StyleSheet.absoluteFillObject, backgroundColor: '#08081A', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  loadingCard: { alignItems: 'center', gap: 14 },
  loadingRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#6C63FF18', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#6C63FF33',
  },
  loadTxt:    { color: '#E2E8F0', fontSize: 15, fontWeight: '600' },
  loadSubTxt: { color: '#4B5563', fontSize: 12 },

  errorIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTxt: { fontSize: 17, fontWeight: '700', color: '#F1F5F9', marginBottom: 8 },
  errorSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 28, lineHeight: 19 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 22, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, backgroundColor: '#6C63FF' },
  retryTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  annotBadge: { position: 'absolute', top: 0, left: 0, width: SW, zIndex: 5 },

  toolbar: {
    backgroundColor: '#0D0D1F', borderTopWidth: 1, borderTopColor: '#1E1E3A',
    paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 10, zIndex: 30,
  },
  toolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6, flexWrap: 'wrap' },
  toolBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolBadge: { fontSize: 9, fontWeight: '800', position: 'absolute', top: 5, right: 5 },
  sep: { width: 1, height: 24, backgroundColor: '#1E1E3A', marginHorizontal: 2 },

  colorDot:       { width: 24, height: 24, borderRadius: 12 },
  colorDotActive: { borderWidth: 2.5, borderColor: '#fff' },
  widthBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // ── Metin notları ────────────────────────────────────────────────────────────
  textNote: {
    position: 'absolute',
    maxWidth: 210,
    backgroundColor: 'rgba(0,0,0,0.74)',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textNoteTxt: {
    flex: 1,
    fontWeight: '600',
    lineHeight: 19,
    flexShrink: 1,
  },
  textNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
    gap: 3,
    flexShrink: 0,
  },
  textNoteAction: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1E1E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textTapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    zIndex: 8,
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  textTapHint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  textTapHintTxt: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textInputCard: {
    position: 'absolute',
    width: 228,
    backgroundColor: '#12122A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B55',
    padding: 10,
    zIndex: 42,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 12,
  },
  textInputField: {
    color: '#E2E8F0',
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#0D0D1F',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E1E3A',
    marginBottom: 8,
  },
  textInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  textInputCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1E1E3A',
  },
  textInputCancelTxt: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  textInputSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  textInputSaveTxt: { color: '#000', fontSize: 13, fontWeight: '700' },
});
