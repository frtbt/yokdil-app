# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# PdfiumAndroid — PDF metin çıkarma native kütüphanesi
-keep class io.legere.pdfiumandroid.** { *; }
-keepclassmembers class io.legere.pdfiumandroid.** { *; }

# PdfTextModule — custom Kotlin native modülü
-keep class com.yokdil.app.PdfTextModule { *; }
-keep class com.yokdil.app.PdfTextPackage { *; }

# React Native bridge — @ReactMethod annotasyonlu metodların korunması
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}

# Google Sign-In native modülü
-keep class com.reactnativegooglesignin.** { *; }
-keepclassmembers class com.reactnativegooglesignin.** { *; }

# Add any project specific keep options here:
