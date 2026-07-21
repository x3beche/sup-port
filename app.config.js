// Expo yapılandırmasını build-config.yaml'dan üretir; böylece sürüm, paket adı,
// API adresi gibi ayarların hepsi tek dosyadan yönetilir. app.json temel alınır,
// build-config.yaml'daki değerler onun üzerine yazılır.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const base = require('./app.json').expo;

function loadBuildConfig() {
  const file = path.join(__dirname, 'build-config.yaml');
  try {
    return yaml.load(fs.readFileSync(file, 'utf8')) || {};
  } catch (err) {
    // Dosya yoksa/bozuksa app.json değerleriyle devam et; derleme durmasın.
    console.warn(`build-config.yaml okunamadı, app.json kullanılıyor: ${err.message}`);
    return {};
  }
}

// Aktif ortam: APP_ENV her şeyi geçersiz kılar (build-aab.sh production'a zorlar),
// yoksa build-config.yaml'daki environment.
function resolveEnvironment(cfg) {
  return process.env.APP_ENV || cfg.environment || 'lan';
}

function resolveApiUrl(cfg) {
  // Adresi doğrudan veren override (tek seferlik derlemeler için).
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const env = resolveEnvironment(cfg);
  const url = cfg.api && cfg.api[env];
  if (!url) {
    console.warn(`build-config.yaml: '${env}' ortamı için api adresi yok.`);
  }
  return url || null;
}

module.exports = () => {
  const cfg = loadBuildConfig();
  const app = cfg.app || {};
  const sdk = cfg.sdk || {};
  const release = cfg.release || {};
  const background = (cfg.theme && cfg.theme.background) || base.backgroundColor;
  const apiUrl = resolveApiUrl(cfg);

  // Cleartext (düz metin http) trafiği tam olarak API http olduğunda gerekir.
  // build-config açıkça belirtmişse ona uy; yoksa adres şemasından türet:
  // lan/localhost (http) -> açık, production (https) -> kapalı.
  const cleartext =
    cfg.android?.uses_cleartext_traffic ?? Boolean(apiUrl && apiUrl.startsWith('http://'));

  return {
    ...base,
    name: app.name || base.name,
    slug: app.slug || base.slug,
    version: app.version || base.version,
    backgroundColor: background,
    android: {
      ...base.android,
      package: app.android_package || base.android?.package,
      versionCode: app.version_code ?? base.android?.versionCode,
      adaptiveIcon: {
        ...base.android?.adaptiveIcon,
        backgroundColor: background,
      },
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            // Play 2025 benchmark: target >= 34 zorunlu, min 24.
            minSdkVersion: sdk.min ?? 24,
            targetSdkVersion: sdk.target ?? 36,
            compileSdkVersion: sdk.compile ?? 36,
            usesCleartextTraffic: cleartext,
            // R8/Proguard: build-config.yaml release bloğundan.
            enableProguardInReleaseBuilds: release.minify ?? false,
            enableShrinkResourcesInReleaseBuilds: release.shrink_resources ?? false,
          },
        },
      ],
      // Oturum token'ları AsyncStorage yerine cihaz keystore/keychain'inde
      // (şifreli) saklansın diye — bkz. src/lib/secureStore.ts.
      'expo-secure-store',
      // Debug key yerine gerçek release keystore ile imzalama.
      './plugins/withReleaseSigning',
    ],
    // Uygulama API adresini buradan okur (bkz. src/lib/api.ts). extra derleme
    // anında pakete gömülür, standalone APK'da da erişilebilir.
    extra: {
      ...base.extra,
      apiUrl,
    },
  };
};
