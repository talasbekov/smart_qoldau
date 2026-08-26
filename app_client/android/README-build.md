# Сборка Android: требования к машине

Относится к обоим приложениям — `app_client` и `app_expert`, настройки у
них одинаковые.

## JDK

Нужен **полноценный JDK** (не JRE): `flutter build apk` вызывает `javac`.
Системный `java` без `javac` — самая частая причина «сборка падает
непонятно почему».

Без прав администратора это ставится в домашний каталог:

```bash
mkdir -p ~/.local/jdk && cd ~/.local/jdk
curl -L -o temurin21.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
tar xzf temurin21.tar.gz && rm temurin21.tar.gz
flutter config --jdk-dir="$HOME/.local/jdk/jdk-21.0.12.1+1"
```

Проверка: `flutter doctor` должен показать `[✓] Android toolchain`.

## Android SDK Platform 37

`compileSdk = 37` в `android/app/build.gradle.kts` — не прихоть:
плагины `flutter_secure_storage` и `permission_handler_android`
компилируются против API 37 и **используют его символы**
(`Manifest.permission.ACCESS_LOCAL_NETWORK`,
`Build.VERSION_CODES.CINNAMON_BUN`). Понизить уровень нельзя — компиляция
плагина упадёт на `cannot find symbol`.

Загвоздка в имени пакета: SDK Manager отдаёт платформу как
`platforms;android-37.0`, а Gradle ищет каталог `android-37` и без него
пишет `Failed to find target with hash string 'android-37'`. Пока Google
не выровняет имена, на машине сборки нужен симлинк:

```bash
ln -sfn "$ANDROID_HOME/platforms/android-37.0" "$ANDROID_HOME/platforms/android-37"
```

(`ANDROID_HOME` обычно `~/Android/Sdk`.)

## Core library desugaring

`flutter_local_notifications` требует его включённым — он пользуется
`java.time` на minSdk, где этого API ещё нет в системе. В
`app/build.gradle.kts` это уже прописано:
`isCoreLibraryDesugaringEnabled = true` плюс зависимость
`coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")`.
Трогать не нужно — просто не удаляйте при обновлении Gradle-файлов.

## Первая сборка долгая

Gradle доустанавливает SDK-платформы (34, 35, 37) и тянет ~3 ГБ
зависимостей — на чистой машине это десятки минут и заметный расход
памяти. Последующие сборки идут из кэша.
