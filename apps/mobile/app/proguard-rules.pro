# Pico release rules — keep WebView JS bridge names intact.
# Every class passed to WebView.addJavascriptInterface must keep its
# @JavascriptInterface methods or the web app loses the bridge after R8.
# Bridges registered in MainActivity.kt:
#   addJavascriptInterface(PicoBridge(...), "PicoBridge")
#   addJavascriptInterface(downloader, "PicoDownload")   // PicoDownloader
-keep class com.askpico.pico.PicoBridge { *; }
-keep class com.askpico.pico.PicoDownloader { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Manifest-declared classes (MainActivity, agent.ShieldService) are kept by
# default rules, but keep them explicit so renaming never breaks lookups.
-keep class com.askpico.pico.MainActivity { *; }
-keep class com.askpico.pico.agent.ShieldService { *; }

# Focus-apps overlay + agent classes used by ShieldService and the bridge
# (FocusPolicy, FocusStore, ActionExecutor, ActionValidation, Capabilities,
# VaultStore, ShieldRules) — keep them so reflection/late binding is safe.
-keep class com.askpico.pico.agent.** { *; }
