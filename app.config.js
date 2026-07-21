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

function resolveApiUrl(cfg) {
  // Ortam değişkeni her şeyi geçersiz kılar (tek seferlik derlemeler için).
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const env = cfg.environment || 'lan';
  const url = cfg.api && cfg.api[env];
  if (!url) {
    console.warn(`build-config.yaml: '${env}' ortamı için api adresi yok.`);
  }
  return url || null;
}

module.exports = () => {
  const cfg = loadBuildConfig();
  const app = cfg.app || {};
  const background = (cfg.theme && cfg.theme.background) || base.backgroundColor;
  const apiUrl = resolveApiUrl(cfg);

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
            usesCleartextTraffic: cfg.android?.uses_cleartext_traffic ?? true,
          },
        },
      ],
    ],
    // Uygulama API adresini buradan okur (bkz. src/lib/api.ts). extra derleme
    // anında pakete gömülür, standalone APK'da da erişilebilir.
    extra: {
      ...base.extra,
      apiUrl,
    },
  };
};
