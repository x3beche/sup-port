#!/usr/bin/env bash
# Yerel Android Studio araç zinciriyle release APK derler.
#
# Ayarlar build-config.yaml'dan okunur (API adresi, sürüm, paket adı...).
# O dosyayı düzenleyip çalıştırman yeterli:  bash scripts/build-apk.sh
# Tek seferlik override:  EXPO_PUBLIC_API_URL=http://x:4000 bash scripts/build-apk.sh
set -euo pipefail

STUDIO=/mnt/ssd1/android-studio
source "$STUDIO/env.sh"
export JAVA_HOME="$STUDIO/ide/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/.."

# Aktif API adresini ve sürümü build-config.yaml'dan (veya override'dan) çöz.
IFS=' ' read -r API VERSION < <(node -e '
  const fs = require("fs"), yaml = require("js-yaml");
  const c = yaml.load(fs.readFileSync("build-config.yaml", "utf8")) || {};
  const env = c.environment || "lan";
  const api = process.env.EXPO_PUBLIC_API_URL || (c.api && c.api[env]) || "";
  const version = (c.app && c.app.version) || "0.0.0";
  process.stdout.write(api + " " + version + "\n");
')

if [ -z "$API" ]; then
  echo "HATA: build-config.yaml içinde aktif ortam için api adresi yok." >&2
  exit 1
fi

echo "== JDK =="; java -version
echo "== SDK == $ANDROID_HOME"
echo "== API  == $API"
echo "== Sürüm == $VERSION"

echo "== prebuild =="
npx expo prebuild --platform android --no-install

# Gradle SDK'yı ANDROID_HOME'dan bulur; yine de açıkça yazıyoruz.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "== assembleRelease =="
cd android
# lintVital bir Expo bağımlılığında patlıyor; yan-yükleme APK'sı için atlanır.
./gradlew assembleRelease --no-daemon \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

APK=$(find app/build/outputs/apk/release -name '*.apk' | head -1)
cd ..
mkdir -p dist
DEST="dist/sup-port-${VERSION}.apk"
cp "android/${APK}" "$DEST"
echo "APK: $(pwd)/${DEST}"
ls -lh "$DEST"
