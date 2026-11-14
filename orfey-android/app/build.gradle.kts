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
        versionCode = project.findProperty("buildVersionCode")?.toString()?.toIntOrNull() ?: 10
        versionName = "1.17"
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
