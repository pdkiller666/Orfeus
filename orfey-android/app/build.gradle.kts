plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "ru.orfey.voice"
    compileSdk = 34
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "ru.orfey.voice"
        minSdk = 29
        targetSdk = 34
        val resolvedVersionCode = project.findProperty("buildVersionCode")?.toString()?.toIntOrNull() ?: 10
        versionCode = resolvedVersionCode
        // Keep 1.18 at code 1038; later build codes advance the minor version automatically.
        versionName = "1.${(resolvedVersionCode - 1020).coerceAtLeast(0)}"
    }
    signingConfigs {
        // Постоянный ключ: все сборки подписываются им, поэтому обновления ставятся поверх старой версии.
        create("orfey") {
            storeFile = file("orfey.jks")
            storePassword = "LAOPi688NK8Hr4DjdIKs"
            keyAlias = "orfey"
            keyPassword = "LAOPi688NK8Hr4DjdIKs"
        }
    }
    buildTypes {
        debug { signingConfig = signingConfigs.getByName("orfey") }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("orfey")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
