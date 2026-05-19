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
            try {
                val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
                val file = File(cleanPath)
                val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val core = PdfiumCore(reactContext, Config())
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
                fd.close()
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("PDF_TEXT_ERROR", e.message ?: "Metin çıkarma başarısız", e)
            }
        }.start()
    }
}
