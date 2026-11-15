# Pico release rules — keep WebView JS bridge names intact
-keepclassmembers class com.askpico.pico.PicoBridge {
    @android.webkit.JavascriptInterface <methods>;
}
