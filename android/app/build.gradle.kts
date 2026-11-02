plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Firma: si GitHub tiene los datos secretos de la llave (ver android/LEEME.md), firma con esa llave para que
// cada versión se instale encima de la anterior. Si no, usa la llave de prueba (sirve para instalar y probar).
val llave = System.getenv("FIRMA_ARCHIVO")?.takeIf { it.isNotBlank() && file(it).exists() }

android {
    namespace = "ar.com.smilescampana.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ar.com.smilescampana.app"
        minSdk = 29
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }

    signingConfigs {
        if (llave != null) {
            create("consultorio") {
                storeFile = file(llave)
                storePassword = System.getenv("FIRMA_CLAVE")
                keyAlias = System.getenv("FIRMA_ALIAS")
                keyPassword = System.getenv("FIRMA_CLAVE")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (llave != null) signingConfigs.getByName("consultorio") else signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
    val camerax = "1.3.4"
    implementation("androidx.camera:camera-core:$camerax")
    implementation("androidx.camera:camera-camera2:$camerax")
    implementation("androidx.camera:camera-lifecycle:$camerax")
    implementation("androidx.camera:camera-view:$camerax")
}
