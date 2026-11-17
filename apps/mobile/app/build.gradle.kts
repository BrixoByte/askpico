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
        // IMPORTANT: every upload to Play must increase versionCode.
        versionCode = 1
        versionName = "1.0.0-beta.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "WEB_URL", "\"https://go.askpico.app\"")
        buildConfigField("String", "ALLOWED_HOST_SUFFIX", "\"askpico.app\"")
        buildConfigField("boolean", "BUNDLED_WEB", "false")
    }

    // Release signing reads four values (names only — never commit values):
    // KEYSTORE_PATH, KEYSTORE_ALIAS, KEYSTORE_PASSWORD, KEY_PASSWORD.
    // Accepted as gradle properties (-PNAME=value) or environment variables.
    // The check only fires when a task that needs the signing config is
    // requested (assemble/bundle/package/sign/upload a release), so compile,
    // manifest, debug and staging tasks still work without a keystore. If any
    // value is missing the build fails — it never falls back to debug signing.
    signingConfigs {
        create("release") {
            fun prop(name: String): String? =
                (project.findProperty(name) as String?) ?: System.getenv(name)
            val signsRelease = gradle.startParameter.taskNames.any { task ->
                val t = task.lowercase()
                t.contains("release") &&
                    listOf("assemble", "bundle", "package", "sign", "upload", "publish")
                        .any(t::contains)
            }
            if (signsRelease) {
                val keystorePath = prop("KEYSTORE_PATH")
                val alias = prop("KEYSTORE_ALIAS")
                val storePass = prop("KEYSTORE_PASSWORD")
                val keyPass = prop("KEY_PASSWORD")
                val missing = listOfNotNull(
                    if (keystorePath.isNullOrBlank()) "KEYSTORE_PATH" else null,
                    if (alias.isNullOrBlank()) "KEYSTORE_ALIAS" else null,
                    if (storePass.isNullOrBlank()) "KEYSTORE_PASSWORD" else null,
                    if (keyPass.isNullOrBlank()) "KEY_PASSWORD" else null,
                )
                if (missing.isNotEmpty()) {
                    throw GradleException(
                        "Release signing is not configured. Missing: " +
                            missing.joinToString(", ") +
                            ". Set them as -P properties or environment variables."
                    )
                }
                storeFile = file(keystorePath!!)
                keyAlias = alias
                storePassword = storePass
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        debug {
            // Physical device: `adb reverse tcp:5173 tcp:5173` forwards localhost to the PC's Vite server.
            // For an emulator, switch back to http://10.0.2.2:5173.
            // Override with -PWEB_URL=https://go.askpico.app to test the deployed site instead.
            val webUrl = (project.findProperty("WEB_URL") as String?) ?: "http://localhost:5173"
            buildConfigField("String", "WEB_URL", "\"$webUrl\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
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
    testImplementation("junit:junit:4.13.2")
}

// Copies apps/web/dist into the staging asset dir. Run `yarn build` in apps/web first,
// then `./gradlew assembleStaging`. Wired so staging builds pick up the latest dist.
val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    from("../../web/dist")
    into("src/staging/assets/web")
}
tasks.matching { it.name == "preBuild" && it.project.path == ":app" }
    .configureEach { dependsOn(syncWebAssets) }
