The adb reverse mapping is cleared when the device disconnects or the ADB server restarts. Run it again if the page goes white later.
•
Easiest fix: run `powershell -File adb-watch.ps1` once per session — it re-applies `adb reverse tcp:5173 tcp:5173` automatically for every connected device. `adb-reverse.bat` does it once manually.
•
If you switch back to an emulator, set the debug URL back to http://10.0.2.2:5173.
- No gradlew script: compile Kotlin with `JAVA_HOME="C:\Users\Ahtasham734\.jdks\jbr-21.0.11" ~/.gradle/wrapper/dists/gradle-8.9-bin/*/gradle-8.9/bin/gradle :app:compileDebugKotlin`.
- Voice input bridge: web calls `PicoBridge.startVoiceInput(lang)`; native SpeechRecognizer posts to `window.PicoVoice.{onPartial,onResult,onError,onEnd,onSpeechStart}`. Requires RECORD_AUDIO (already in manifest).
