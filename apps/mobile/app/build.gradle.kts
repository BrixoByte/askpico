    plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.askpico.pico"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.askpico.pico"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0-beta.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "WEB_URL", "\"https://chat.askpico.app\"")
        buildConfigField("String", "ALLOWED_HOST_SUFFIX", "\"askpico.app\"")
        buildConfigField("boolean", "BUNDLED_WEB", "false")
    }

    buildTypes {
        debug {
            // Physical device: `adb reverse tcp:5173 tcp:5173` forwards localhost to the PC's Vite server.
            // For an emulator, switch back to http://10.0.2.2:5173.
            buildConfigField("String", "WEB_URL", "\"http://localhost:5173\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        // Staging: debuggable (WebView inspect works) + bundled web build served from APK
        // assets at the http://localhost:5173 origin, so no vite server / adb reverse :5173
        // is needed. The API is still reached at http://localhost:3001 (adb reverse :3001).
        create("staging") {
            initWith(getByName("debug"))
            buildConfigField("boolean", "BUNDLED_WEB", "true")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.security:security-crypto:1.0.0")
}

// Copies apps/web/dist into the staging asset dir. Run `yarn build` in apps/web first,
// then `./gradlew assembleStaging`. Wired so staging builds pick up the latest dist.
val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    from("../web/dist")
    into("src/staging/assets/web")
}
tasks.matching { it.name == "preBuild" && it.project.path == ":app" }
    .configureEach { dependsOn(syncWebAssets) }
