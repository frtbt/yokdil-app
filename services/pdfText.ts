import { NativeModules } from 'react-native';

// Android: PdfiumAndroid (PdfTextModule.kt) — PdfiumCore + ToUnicode font tabloları
// iOS:     PDFKit       (PdfTextModule.m)   — Apple native framework (iOS 11+)
// Her iki platformda da aynı modül adı ve API kullanılır.
const { PdfTextModule } = NativeModules;

export async function extractPageTextsNative(fileUri: string): Promise<string[]> {
  try {
    if (!PdfTextModule?.extractText) return [];
    const texts: string[] = await PdfTextModule.extractText(fileUri);
    return texts ?? [];
  } catch (e) {
    console.warn('[PdfText] Native metin çıkarma hatası:', e);
    return [];
  }
}
