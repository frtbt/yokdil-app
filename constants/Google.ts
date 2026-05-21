// Google Cloud Console > APIs & Services > Credentials adresinden alınır.
// "OAuth 2.0 Client IDs" bölümünde 3 ayrı istemci tipi oluşturmanız gerekir:
//   1. Web Application  → webClientId
//   2. Android          → androidClientId   (package: com.yokdil.app)
//   3. iOS              → iosClientId       (bundle: com.yokdil.app)
//
// Android için yetkili yönlendirme URI: com.yokdil.app:/oauth2redirect/google
// iOS için yetkili yönlendirme URI:     com.yokdil.app:/oauth2redirect/google

export const GOOGLE_WEB_CLIENT_ID      = '729425867994-0l0cakjobk8qodq815qtu7cjvllvs5rb.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID  = '729425867994-s9u63uatp9eeg1g7c1gh32oaess1u9v2.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID      = '729425867994-udsdn982llrj7517cvjbidm0krnpvsi6.apps.googleusercontent.com';
