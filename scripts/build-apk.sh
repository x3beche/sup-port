#!/usr/bin/env bash
# Yerel Android Studio araç zinciriyle release APK derler.
# Kullanım: EXPO_PUBLIC_API_URL=http://<lan-ip>:4000 scripts/build-apk.sh
set -euo pipefail

STUDIO=/mnt/ssd1/android-studio
source "$STUDIO/env.sh"
export JAVA_HOME="$STUDIO/ide/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

: "${EXPO_PUBLIC_API_URL:?EXPO_PUBLIC_API_URL gerekli (telefonun ulaşacağı backend adresi)}"
export EXPO_PUBLIC_API_URL

cd "$(dirname "$0")/.."

echo "== JDK =="; java -version
echo "== SDK == $ANDROID_HOME"
echo "== API  == $EXPO_PUBLIC_API_URL"

echo "== prebuild =="
npx expo prebuild --platform android --no-install

# Gradle SDK'yı ANDROID_HOME'dan bulur; yine de açıkça yazıyoruz.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "== assembleRelease =="
cd android
./gradlew assembleRelease --no-daemon \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

APK=$(find app/build/outputs/apk/release -name '*.apk' | head -1)
cd ..
mkdir -p dist
VERSION=$(node -p "require('./app.json').expo.version")
DEST="dist/sup-port-${VERSION}.apk"
cp "android/${APK}" "$DEST"
echo "APK: $(pwd)/${DEST}"
ls -lh "$DEST"
