plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firebase подключается ТОЛЬКО когда в сборку положен настоящий
// google-services.json (задача 22 эпика E6). Без него плагин Google
// Services валит сборку с "File google-services.json is missing", а
// приложение при PUSH_ENABLED=false к Firebase вообще не обращается —
// поэтому здесь условие, а не безусловный apply.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "kz.smartqoldau.app_client"
    // Не flutter.compileSdkVersion (36): плагины flutter_secure_storage и
    // permission_handler_android компилируются против 37 и используют его
    // API (ACCESS_LOCAL_NETWORK, VERSION_CODES.CINNAMON_BUN), поэтому
    // приложение обязано компилироваться против того же уровня.
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications требует desugaring: он пользуется
        // java.time на minSdk, где его ещё нет в системе.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "kz.smartqoldau.app_client"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // WebRTC (livekit_client, задача 14 эпика E6) требует API 23+ —
        // flutter.minSdkVersion ниже, и сборка с ним падает на линковке.
        minSdk = maxOf(flutter.minSdkVersion, 23)
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
