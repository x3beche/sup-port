#!/usr/bin/env bash
# Play Store için imzalı AAB (Android App Bundle) derler.
#
# Ayarlar build-config.yaml'dan okunur. Play dağıtımı AAB üzerinden yapılır;
# yan-yükleme/test için ayrıca scripts/build-apk.sh var.
#
#   bash scripts/build-aab.sh
#
# Güvenlik: release derlemesi 'production' ortamı bekler (test API'si Play'e
# gitmesin). Bilerek başka ortamla derlemek için:  REQUIRE_PRODUCTION=0 bash ...
set -euo pipefail

STUDIO=/mnt/ssd1/android-studio
source "$STUDIO/env.sh"
export JAVA_HOME="$STUDIO/ide/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/.."

IFS=' ' read -r ENVNAME API VERSION VCODE < <(node -e '
  const fs = require("fs"), yaml = require("js-yaml");
  const c = yaml.load(fs.readFileSync("build-config.yaml", "utf8")) || {};
  const env = c.environment || "lan";
  const api = process.env.EXPO_PUBLIC_API_URL || (c.api && c.api[env]) || "";
  const app = c.app || {};
  process.stdout.write([env, api, app.version || "0.0.0", app.version_code || 1].join(" ") + "\n");
')

# Test API'si production yapıya sızmasın.
if [ "${REQUIRE_PRODUCTION:-1}" = "1" ] && [ "$ENVNAME" != "production" ]; then
  echo "HATA: environment '$ENVNAME' (production değil). Play yapısı test API'siyle" >&2
  echo "      derlenmemeli. build-config.yaml'da environment: production yap ya da" >&2
  echo "      bilerek devam etmek için REQUIRE_PRODUCTION=0 ver." >&2
  exit 1
fi

if [ ! -f keystore.properties ]; then
  echo "HATA: keystore.properties yok. keystore.properties.example'ı kopyalayıp" >&2
  echo "      release keystore bilgilerini doldur (bkz. RELEASE.md)." >&2
  exit 1
fi

echo "== Ortam == $ENVNAME"
echo "== API    == $API"
echo "== Sürüm  == $VERSION ($VCODE)"

echo "== prebuild =="
npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "== bundleRelease (imzalı AAB) =="
cd android
./gradlew bundleRelease --no-daemon \
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease

AAB=$(find app/build/outputs/bundle/release -name '*.aab' | head -1)
cd ..
mkdir -p dist
DEST="dist/sup-port-${VERSION}.aab"
cp "android/${AAB}" "$DEST"

echo "== imza doğrulaması =="
JARSIGNER="$JAVA_HOME/bin/jarsigner"
"$JARSIGNER" -verify "$DEST" >/dev/null 2>&1 && echo "AAB imzalı" || echo "UYARI: imza doğrulanamadı"

echo "AAB: $(pwd)/${DEST}"
ls -lh "$DEST"
