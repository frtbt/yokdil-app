package com.yokdil.app

import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.legere.pdfiumandroid.PdfiumCore
import io.legere.pdfiumandroid.util.Config
import java.io.File

class PdfTextModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PdfTextModule"

    @ReactMethod
    fun extractText(filePath: String, promise: Promise) {
        Thread {
            var fd: ParcelFileDescriptor? = null
            var core: PdfiumCore? = null
            try {
                val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
                val file = File(cleanPath)

                if (!file.exists() || !file.canRead()) {
                    promise.reject("PDF_TEXT_ERROR", "Dosya bulunamadi veya okunamadi: $cleanPath")
                    return@Thread
                }

                fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                core = PdfiumCore(reactContext, Config())
                val doc = core.newDocument(fd)
                val pageCount = doc.getPageCount()

                val result = Arguments.createArray()
                for (i in 0 until pageCount) {
                    val page = doc.openPage(i)
                    try {
                        val textPage = page.openTextPage()
                        try {
                            val charCount = textPage.textPageCountChars()
                            val text = if (charCount > 0) textPage.textPageGetText(0, charCount) ?: "" else ""
                            result.pushString(text)
                        } finally {
                            textPage.close()
                        }
                    } finally {
                        page.close()
                    }
                }

                doc.close()
                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("PDF_TEXT_ERROR", e.message ?: "Metin cikarma basarisiz")
            } finally {
                try { fd?.close() } catch (_: Throwable) {}
                core = null
            }
        }.start()
    }
}
