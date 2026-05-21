import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Platform,
  Share, TextInput, Alert, Linking, ScrollView,
  KeyboardAvoidingView, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import YoutubePlayer from 'react-native-youtube-iframe';
import HeartButton from '../../components/HeartButton';
import PDFReader from '../../components/PDFReader';
import { useAppStore } from '../../store/useAppStore';
import type { ApiDocument } from '../../store/useAppStore';
import { Colors, DifficultyColors } from '../../constants/Colors';
import { useTheme } from '../../store/useTheme';
import { API_BASE, ENDPOINTS } from '../../constants/Api';
import { useAuthStore } from '../../store/useAuthStore';
import { getDownloadUri, saveDownload, removeDownload } from '../../services/db';
import { useNetworkStatus } from '../../services/network';

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function openYoutubeExternal(url: string) {
  const id = extractYoutubeId(url);
  const target = id ? `https://www.youtube.com/watch?v=${id}` : url;
  const appUrl = id ? `vnd.youtube:${id}` : url;
  const canApp = await Linking.canOpenURL(appUrl);
  Linking.openURL(canApp ? appUrl : target);
}

// ── Önbellek İndirme Ekranı ────────────────────────────────────────────────────

function PrefetchProgressScreen({ progress }: { progress: number }) {
  const { colors: c } = useTheme();
  // progress < 0: Content-Length bilinmiyor (indeterminate)
  const isUnknown = progress < 0;
  const pct = isUnknown ? 0 : Math.round(progress * 100);
  return (
    <View style={styles.prefetchWrap}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={styles.prefetchTitle}>Dosya Hazırlanıyor...</Text>
      {!isUnknown && <Text style={[styles.prefetchPct, { color: c.primary }]}>{pct}%</Text>}
      <View style={styles.prefetchBarBg}>
        <View style={[
          styles.prefetchBarFill,
          isUnknown
            ? { width: '60%', backgroundColor: c.primary, opacity: 0.5 }
            : { width: `${pct}%` as any, backgroundColor: c.primary },
        ]} />
      </View>
    </View>
  );
}

// ── PDF Yok Ekranı ─────────────────────────────────────────────────────────────

function NoFileScreen({ doc, c }: { doc: ApiDocument | null; c: typeof Colors.dark }) {
  return (
    <View style={[styles.noFileWrap, { backgroundColor: c.surfaceSecondary }]}>
      <View style={[styles.noFileIcon, { backgroundColor: (doc?.thumbnail_color ?? c.primary) + '22' }]}>
        <Feather name="file-text" size={52} color={doc?.thumbnail_color ?? c.primary} />
      </View>
      <Text style={[styles.noFileTitle, { color: c.text }]}>{doc?.title ?? 'Doküman'}</Text>
      <Text style={[styles.noFileSub, { color: c.textSecondary }]}>{doc?.subtitle ?? ''}</Text>
      <View style={styles.noFileMeta}>
        {doc?.exam_type && (
          <View style={[styles.metaBadge, { backgroundColor: c.primary + '22' }]}>
            <Text style={[styles.metaBadgeText, { color: c.primary }]}>{doc.exam_type}</Text>
          </View>
        )}
        {doc?.difficulty && (
          <View style={[styles.metaBadge, { backgroundColor: DifficultyColors[doc.difficulty].darkBg }]}>
            <Text style={[styles.metaBadgeText, { color: DifficultyColors[doc.difficulty].darkText }]}>
              {doc.difficulty}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.noFilePlaceholder, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Feather name="clock" size={18} color={c.textTertiary} />
        <Text style={[styles.noFilePlaceholderText, { color: c.textTertiary }]}>
          PDF dosyası henüz yüklenmedi.{'\n'}Yakında erişime açılacak.
        </Text>
      </View>
    </View>
  );
}

// ── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function PDFViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors: c } = useTheme();
  const { documents, toggleFavorite, favoriteIds, toggleDownload, downloadedIds } = useAppStore();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const isOnline = useNetworkStatus();

  // ── Doküman ──
  const [doc, setDoc] = useState<ApiDocument | null>(
    () => documents.find((d) => String(d.id) === String(id)) ?? null
  );
  const [fetchLoading, setFetchLoading] = useState(!doc);
  const [totalPages, setTotalPages] = useState(0);

  // ── İndirme ──
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  // ── Pre-fetch (önbellek indirme) ──
  const [prefetchUri, setPrefetchUri]           = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching]       = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState(0);
  const [prefetchError, setPrefetchError]       = useState(false);
  const prefetchDownloadRef = useRef<any>(null);

  // ── Modaller ──
  const [videoVisible, setVideoVisible] = useState(false);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [hasNote, setHasNote] = useState(false);

  // ── Çalışma süresi ──
  const studyStartRef = useRef<number>(Date.now());
  const studyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [studySec, setStudySec] = useState(0);

  const docId       = Number(id);
  const isFav       = favoriteIds.includes(docId);
  const isDled      = downloadedIds.includes(docId);
  const downloadPath = (FileSystem.documentDirectory ?? '') + `yokdil_${docId}.pdf`;

  // Aynı kategoriden ilgili belgeler
  // view_count'a göre sıralı popüler belgeler (aynı kategori, farklı belge)
  const relatedDocs = useMemo(() => {
    if (!doc) return [];
    return documents
      .filter(d => d.category_slug === doc.category_slug && d.id !== docId)
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 6);
  }, [documents, doc, docId]);

  // ── SQLite'tan yerel URI yükle ──
  const refreshLocalUri = useCallback(async () => {
    const uri = await getDownloadUri(docId);
    setLocalUri(uri);
  }, [docId]);

  useEffect(() => { refreshLocalUri(); }, [refreshLocalUri]);

  // ── Pre-fetch: localUri yoksa cacheDirectory'e sessizce indir ──
  const prefetchPdf = useCallback(async (fileUrl: string) => {
    const cachePath = `${FileSystem.cacheDirectory ?? ''}yokdil_preview_${docId}.pdf`;
    setIsPrefetching(true);
    setPrefetchProgress(0);
    setPrefetchError(false);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let dl: any = null;

    try {
      dl = FileSystem.createDownloadResumable(
        fileUrl, cachePath, {},
        (p) => {
          // Content-Length bilinmiyorsa -1 gönder (indeterminate)
          const prog = p.totalBytesExpectedToWrite > 0
            ? p.totalBytesWritten / p.totalBytesExpectedToWrite
            : -1;
          setPrefetchProgress(prog);
        },
      );
      prefetchDownloadRef.current = dl;

      // 30 saniye timeout: takılı kalırsa direkt URL'den aç
      const timeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = setTimeout(() => {
          dl?.pauseAsync?.().catch(() => {});
          reject(new Error('timeout'));
        }, 30000);
      });

      const result = await Promise.race([dl.downloadAsync(), timeoutPromise]);
      if (result?.uri) {
        setPrefetchUri(result.uri);
      } else {
        // İndirme tamamlandı ama URI yok → direkt URL'den yükle
        setPrefetchUri(fileUrl);
      }
    } catch {
      // Hata veya timeout → direkt URL ile yükle (react-native-pdf remote URL'i destekler)
      setPrefetchUri(fileUrl);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsPrefetching(false);
      prefetchDownloadRef.current = null;
    }
  }, [docId]);

  useEffect(() => {
    setPrefetchError(false);
    setPrefetchProgress(0);
    if (localUri) { setPrefetchUri(localUri); return; }
    if (doc?.file_url) prefetchPdf(doc.file_url);
  }, [localUri, doc?.file_url, prefetchPdf]);

  useEffect(() => () => {
    prefetchDownloadRef.current?.pauseAsync?.().catch(() => {});
  }, []);

  // ── Doküman çek ──
  useEffect(() => {
    if (doc) return;
    setFetchLoading(true);
    fetch(`${API_BASE}/documents.php?id=${id}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setDoc(json.data); })
      .finally(() => setFetchLoading(false));
  }, [id]);

  // ── Notları yükle ──
  useEffect(() => {
    AsyncStorage.getItem(`note_${docId}`).then((n) => {
      if (n) { setNoteText(n); setHasNote(true); }
    });
  }, [docId]);

  // ── Görüntüleme sayısı ──
  useEffect(() => {
    fetch(ENDPOINTS.view, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body:    JSON.stringify({ document_id: docId }),
    }).catch(() => {});
  }, [docId]);

  // ── Çalışma zamanlayıcı ──
  useEffect(() => {
    studyStartRef.current = Date.now();
    studyTimerRef.current = setInterval(() => {
      setStudySec(Math.floor((Date.now() - studyStartRef.current) / 1000));
    }, 1000);
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current);
      const elapsed = Math.floor((Date.now() - studyStartRef.current) / 1000);
      if (elapsed >= 5 && token) {
        fetch(ENDPOINTS.studyHistory, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ document_id: docId, duration_sec: elapsed }),
        }).catch(() => {});
      }
    };
  }, [docId, token]);

  // ── Yazdır ──
  const handlePrint = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Desteklenmiyor', 'Bu cihaz PDF paylaşmayı desteklemiyor.');
        return;
      }
      let fileToShare = localUri;
      if (!fileToShare) {
        if (!doc?.file_url) {
          Alert.alert('Yazdırma', 'PDF dosyası bulunamadı.');
          return;
        }
        const cacheUri = (FileSystem.cacheDirectory ?? '') + `print_${docId}.pdf`;
        try { await FileSystem.downloadAsync(doc.file_url, cacheUri); } catch {}
        fileToShare = cacheUri;
      }
      await Sharing.shareAsync(fileToShare, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Yazdırma', 'PDF yazdırma başlatılamadı.');
    }
  }, [doc, docId, localUri]);

  // ── İndir / Kaldır ──
  const handleDownload = useCallback(async () => {
    if (!doc?.file_url) {
      Alert.alert('İndirme', 'Bu dokümanın PDF dosyası henüz mevcut değil.');
      return;
    }
    if (isDled) {
      Alert.alert('Kaldır', 'Bu PDF indirilenlerin listesinden çıkarılsın mı?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır', style: 'destructive',
          onPress: () => {
            removeDownload(docId);
            toggleDownload(docId);
            setLocalUri(null);
          },
        },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDownloading(true);
    try {
      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) {
        Alert.alert('Hata', 'İndirme dizini bulunamadı.');
        setIsDownloading(false);
        return;
      }
      const dl = FileSystem.createDownloadResumable(
        doc.file_url, downloadPath, {},
        (p) => setDownloadProgress(p.totalBytesWritten / (p.totalBytesExpectedToWrite || 1))
      );
      const result = await dl.downloadAsync();
      if (result?.uri) {
        await saveDownload(docId, result.uri, doc.file_size ?? '');
        toggleDownload(docId, doc);
        setLocalUri(result.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('İndirildi', `"${doc.title}" kütüphanene eklendi.`);
      } else {
        Alert.alert('Hata', 'İndirme tamamlanamadı, tekrar dene.');
      }
    } catch (e: any) {
      Alert.alert('İndirme Hatası', e?.message ?? 'Bilinmeyen bir hata oluştu.');
    } finally { setIsDownloading(false); setDownloadProgress(0); }
  }, [doc, docId, isDled, downloadPath, toggleDownload]);

  // ── Güvenli paylaşım linki ──
  const getShareUrl = useCallback(async (): Promise<string | null> => {
    if (!doc) return null;
    if (!doc.file_url) {
      Alert.alert('Paylaşım', 'Bu dokümanın PDF dosyası henüz yüklenmemiş.');
      return null;
    }
    try {
      const res  = await fetch(ENDPOINTS.shareLink, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ document_id: docId }),
      });
      const json = await res.json();
      if (json.success) return json.url as string;
    } catch {}
    return `https://euprathessoft.com/yokdil-api/viewer.php?file=${encodeURIComponent(doc.file_url)}`;
  }, [doc, docId, token]);

  // ── Paylaşma ──
  const handleSystemShare = useCallback(async () => {
    if (!doc) return;
    setShareMenuVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = await getShareUrl();
    if (!url) return;
    await Share.share({ title: doc.title, message: `${doc.title}\n${url}` });
  }, [doc, getShareUrl]);

  const shareToWhatsApp = useCallback(async () => {
    setShareMenuVisible(false);
    const url = await getShareUrl();
    if (!url || !doc) return;
    const text = encodeURIComponent(`${doc.title}\n${url}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => Alert.alert('WhatsApp yüklü değil'));
  }, [doc, getShareUrl]);

  const shareToTelegram = useCallback(async () => {
    setShareMenuVisible(false);
    const url = await getShareUrl();
    if (!url || !doc) return;
    const text = encodeURIComponent(`${doc.title}\n${url}`);
    Linking.openURL(`tg://msg?text=${text}`).catch(() => Alert.alert('Telegram yüklü değil'));
  }, [doc, getShareUrl]);

  const shareToEmail = useCallback(async () => {
    setShareMenuVisible(false);
    const url = await getShareUrl();
    if (!url || !doc) return;
    const subject = encodeURIComponent(doc.title);
    const body    = encodeURIComponent(`${doc.title}\n${doc.subtitle ?? ''}\n\n${url}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`).catch(() => {});
  }, [doc, getShareUrl]);

  // ── Notlar ──
  const handleSaveNote = useCallback(async () => {
    await AsyncStorage.setItem(`note_${docId}`, noteText);
    setHasNote(noteText.trim().length > 0);
    setNotesVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [docId, noteText]);

  // ── Hesaplamalar ──
  const diffColors = doc?.difficulty ? DifficultyColors[doc.difficulty] : null;
  const studyLabel = studySec >= 60
    ? `${Math.floor(studySec / 60)}dk ${studySec % 60}sn`
    : `${studySec}sn`;

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>

      {/* ── HEADER ── */}
      <LinearGradient colors={['#0F0F1A', '#1A1A3E']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            {fetchLoading ? (
              <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
            ) : (
              <>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {doc?.title ?? 'PDF Görüntüleyici'}
                </Text>
                <View style={styles.headerMeta}>
                  <Text style={styles.docSub}>{totalPages || doc?.pages || 0} sayfa</Text>
                  {doc?.file_size ? <Text style={styles.docSub}> · {doc.file_size}</Text> : null}
                  {studySec > 0 && <Text style={styles.docSub}> · ⏱ {studyLabel}</Text>}
                  {diffColors && doc?.difficulty && (
                    <View style={[styles.smallBadge, { backgroundColor: diffColors.darkBg }]}>
                      <Text style={[styles.smallBadgeText, { color: diffColors.darkText }]}>
                        {doc.difficulty}
                      </Text>
                    </View>
                  )}
                  {doc?.has_video && (
                    <View style={styles.videoBadge}>
                      <Feather name="youtube" size={9} color="#FF4444" />
                      <Text style={styles.videoBadgeText}>Video</Text>
                    </View>
                  )}
                  {localUri && (
                    <View style={styles.offlineBadge}>
                      <Feather name="wifi-off" size={9} color="#43E97B" />
                      <Text style={styles.offlineBadgeText}>
                        {!isOnline ? 'Çevrimdışı' : 'İndirilmiş'}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          <HeartButton
            isFavorite={isFav}
            onPress={() => toggleFavorite(docId, token ?? undefined, doc ?? undefined)}
            size={20}
            inactiveColor="rgba(255,255,255,0.7)"
            style={styles.iconBtn}
          />
        </SafeAreaView>
      </LinearGradient>

      {/* ── İNDİRME PROGRESS ── */}
      {isDownloading && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` as any, backgroundColor: c.primary }]} />
        </View>
      )}

      {/* ── ANA İÇERİK ── */}
      {fetchLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : isPrefetching ? (
        <PrefetchProgressScreen progress={prefetchProgress} />
      ) : !prefetchUri ? (
        <NoFileScreen doc={doc} c={c} />
      ) : (
        <PDFReader
          fileUri={prefetchUri}
          docId={docId}
          isOffline={!isOnline}
          userName={user?.name}
          onLoadComplete={setTotalPages}
        />
      )}

      {/* ── İLGİLİ BELGELER ── */}
      {relatedDocs.length > 0 && prefetchUri && !fetchLoading && !isPrefetching && (
        <RelatedDocsBar docs={relatedDocs} c={c} router={router} />
      )}

      {/* ── TOOLBAR ── */}
      {!fetchLoading && (
        <View style={[
          styles.toolbar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            paddingBottom: Platform.OS === 'ios' ? 28 : insets.bottom + 6,
          },
        ]}>
          <View style={styles.toolbarRow}>

            {/* Yazdır */}
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: c.surfaceSecondary }]}
              onPress={handlePrint}
            >
              <Feather name="printer" size={19} color={c.text} />
            </TouchableOpacity>

            {/* Notlar */}
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: c.surfaceSecondary }]}
              onPress={() => setNotesVisible(true)}
            >
              <Feather name="file-text" size={19} color={hasNote ? '#FF9A3C' : c.text} />
              {hasNote && <View style={styles.noteDot} />}
            </TouchableOpacity>

            {/* Video */}
            {doc?.has_video && doc.video_url ? (
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: '#FF444420' }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVideoVisible(true); }}
              >
                <Feather name="youtube" size={19} color="#FF4444" />
              </TouchableOpacity>
            ) : null}

            {/* İndir */}
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: isDled ? '#43E97B20' : c.surfaceSecondary }]}
              onPress={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#43E97B" />
              ) : (
                <Feather name={isDled ? 'check-circle' : 'download'} size={19} color={isDled ? '#43E97B' : c.text} />
              )}
            </TouchableOpacity>

            {/* Paylaş */}
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: c.surfaceSecondary }]}
              onPress={() => setShareMenuVisible(true)}
            >
              <Feather name="share-2" size={19} color={c.text} />
            </TouchableOpacity>

          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALLER
      ══════════════════════════════════════════════════════ */}

      {/* ── VİDEO ── */}
      <Modal
        visible={videoVisible}
        animationType="slide"
        onRequestClose={() => setVideoVisible(false)}
      >
        <View style={styles.videoModal}>
          <LinearGradient colors={['#0F0F1A', '#1A1A3E']} style={{ paddingBottom: 14 }}>
            <SafeAreaView edges={['top']} style={styles.safeHeader}>
              <TouchableOpacity onPress={() => setVideoVisible(false)} style={styles.iconBtn}>
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc?.title}</Text>
                <Text style={styles.docSub}>Video Anlatım</Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => doc?.video_url && openYoutubeExternal(doc.video_url)}
              >
                <Feather name="external-link" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </SafeAreaView>
          </LinearGradient>
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
            {videoVisible && doc?.video_url ? (
              <YoutubePlayer
                height={300}
                play={videoVisible}
                videoId={extractYoutubeId(doc.video_url) ?? ''}
                webViewStyle={{ backgroundColor: '#000' }}
                webViewProps={{
                  androidLayerType: 'hardware',
                  allowsFullscreenVideo: true,
                }}
                onError={(e: string) => console.warn('YouTube error:', e)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── PAYLAŞMA ── */}
      <Modal
        visible={shareMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setShareMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShareMenuVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.shareSheet, { backgroundColor: c.surface }]}>
                <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
                <Text style={[styles.sheetTitle, { color: c.text }]}>Paylaş</Text>
                <View style={styles.shareGrid}>
                  <TouchableOpacity style={styles.shareOption} onPress={shareToWhatsApp}>
                    <View style={[styles.shareIcon, { backgroundColor: '#25D36622' }]}>
                      <Text style={styles.shareIconEmoji}>💬</Text>
                    </View>
                    <Text style={[styles.shareLabel, { color: c.textSecondary }]}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareOption} onPress={shareToTelegram}>
                    <View style={[styles.shareIcon, { backgroundColor: '#229ED922' }]}>
                      <Text style={styles.shareIconEmoji}>✈️</Text>
                    </View>
                    <Text style={[styles.shareLabel, { color: c.textSecondary }]}>Telegram</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareOption} onPress={shareToEmail}>
                    <View style={[styles.shareIcon, { backgroundColor: '#FF9A3C22' }]}>
                      <Text style={styles.shareIconEmoji}>📧</Text>
                    </View>
                    <Text style={[styles.shareLabel, { color: c.textSecondary }]}>E-posta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareOption} onPress={handleSystemShare}>
                    <View style={[styles.shareIcon, { backgroundColor: c.primary + '22' }]}>
                      <Text style={styles.shareIconEmoji}>⬆️</Text>
                    </View>
                    <Text style={[styles.shareLabel, { color: c.textSecondary }]}>Diğer</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.sheetCancelBtn, { backgroundColor: c.surfaceSecondary }]}
                  onPress={() => setShareMenuVisible(false)}
                >
                  <Text style={[styles.sheetCancelText, { color: c.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── NOTLAR ── */}
      <Modal
        visible={notesVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotesVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotesVisible(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.notesSheet, { backgroundColor: c.surface }]}>
                  <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
                  <View style={styles.notesHeader}>
                    <Text style={[styles.sheetTitle, { color: c.text }]}>✏️ Notlarım</Text>
                    <Text style={[styles.notesSub, { color: c.textTertiary }]}>
                      Bu doküman için kişisel notlar
                    </Text>
                  </View>
                  <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                    placeholder="Notlarınızı buraya yazın..."
                    placeholderTextColor="#6B7280"
                    style={[styles.notesInput, { backgroundColor: c.surfaceSecondary, color: c.text, borderColor: c.border }]}
                    textAlignVertical="top"
                  />
                  <View style={styles.notesActions}>
                    <TouchableOpacity
                      onPress={() => setNotesVisible(false)}
                      style={[styles.notesCancelBtn, { backgroundColor: c.surfaceSecondary }]}
                    >
                      <Text style={[styles.notesCancelText, { color: c.textSecondary }]}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveNote} style={[styles.notesSaveBtn, { backgroundColor: c.primary }]}>
                      <Feather name="check" size={15} color="#fff" />
                      <Text style={styles.notesSaveText}>Kaydet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingBottom: 14 },
  safeHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 8, gap: 8,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  docSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  smallBadgeText: { fontSize: 9, fontWeight: '700' },
  videoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5,
    backgroundColor: 'rgba(255,68,68,0.18)',
  },
  videoBadgeText: { fontSize: 9, fontWeight: '700', color: '#FF4444' },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5,
    backgroundColor: 'rgba(67,233,123,0.18)',
  },
  offlineBadgeText: { fontSize: 9, fontWeight: '700', color: '#43E97B' },

  // Progress
  progressBar: { height: 3, backgroundColor: '#1A1A2E' },
  progressFill: { height: 3, backgroundColor: '#6C63FF' },

  // Pre-fetch
  prefetchWrap: {
    flex: 1, backgroundColor: '#08081A',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  prefetchTitle:   { color: '#E2E8F0', fontSize: 16, fontWeight: '700' as const },
  prefetchPct:     { color: '#6C63FF', fontSize: 42, fontWeight: '800' as const },
  prefetchBarBg:   { width: 220, height: 4, backgroundColor: '#1E1E3A', borderRadius: 2 },
  prefetchBarFill: { height: 4, backgroundColor: '#6C63FF', borderRadius: 2 },

  // States
  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, backgroundColor: '#0A0A14', padding: 32,
  },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },

  // No file
  noFileWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  noFileIcon: { width: 110, height: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  noFileTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  noFileSub: { fontSize: 14, textAlign: 'center' },
  noFileMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  metaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  metaBadgeText: { fontSize: 11, fontWeight: '700' },
  noFilePlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, maxWidth: 300,
  },
  noFilePlaceholderText: { fontSize: 13, lineHeight: 19, flex: 1 },

  // Toolbar
  toolbar: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toolBtn: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  noteDot: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF9A3C',
  },

  // Video modal
  videoModal: { flex: 1, backgroundColor: '#000' },

  // Sheet
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },

  // Paylaşma
  shareSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  shareGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  shareOption: { alignItems: 'center', gap: 8 },
  shareIcon: {
    width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  shareIconEmoji: { fontSize: 26 },
  shareLabel: { fontSize: 12, fontWeight: '600' },
  sheetCancelBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },

  // Notlar
  notesSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  notesHeader: { marginBottom: 16 },
  notesSub: { fontSize: 12, marginTop: 2 },
  notesInput: {
    borderRadius: 14, borderWidth: 1, padding: 14,
    fontSize: 14, lineHeight: 22, minHeight: 140, maxHeight: 240,
  },
  notesActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  notesCancelBtn: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center' },
  notesCancelText: { fontSize: 14, fontWeight: '600' },
  notesSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#6C63FF', borderRadius: 12, padding: 13,
  },
  notesSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ── İlgili Belgeler Bileşeni ──────────────────────────────────────────────────

function RelatedDocsBar({
  docs,
  c,
  router,
}: {
  docs: ApiDocument[];
  c: typeof Colors.dark;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={[relStyles.wrap, { backgroundColor: c.surface, borderTopColor: c.border }]}>
      <View style={relStyles.header}>
        <Feather name="trending-up" size={11} color={c.textTertiary} />
        <Text style={[relStyles.title, { color: c.textTertiary }]}>
          Bu PDF'yi indirenler şunlara da baktı
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={relStyles.scroll}
        decelerationRate="fast"
      >
        {docs.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[relStyles.card, { backgroundColor: c.surfaceSecondary }]}
            onPress={() => router.push(`/pdf/${d.id}` as any)}
            activeOpacity={0.72}
          >
            <View style={[relStyles.thumb, { backgroundColor: d.thumbnail_color }]}>
              <Feather name="file-text" size={14} color="rgba(255,255,255,0.85)" />
            </View>
            <View style={relStyles.cardBody}>
              <Text style={[relStyles.cardTitle, { color: c.text }]} numberOfLines={2}>
                {d.title}
              </Text>
              <View style={relStyles.cardMeta}>
                <Text style={[relStyles.cardSub, { color: c.textTertiary }]}>
                  {d.pages} sayfa
                </Text>
                <View style={[relStyles.examBadge, { backgroundColor: d.thumbnail_color + '22' }]}>
                  <Text style={[relStyles.examBadgeText, { color: d.thumbnail_color }]}>
                    {d.exam_type}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const relStyles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    marginBottom: 7,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 188,
    borderRadius: 13,
    padding: 9,
    gap: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody:  { flex: 1 },
  cardTitle: { fontSize: 11, fontWeight: '600', lineHeight: 15, marginBottom: 4 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSub:   { fontSize: 10 },
  examBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  examBadgeText: { fontSize: 9, fontWeight: '700' },
});
