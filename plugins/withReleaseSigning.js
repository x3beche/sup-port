// Expo config plugin: release build'i debug key yerine gerçek release keystore
// ile imzalar. keystore.properties (gitignore'lu) yoksa hiçbir şey yapmaz —
// yani anahtar olmayan makinede prebuild yine çalışır, sadece imza debug kalır.
//
// keystore.properties biçimi (bkz. keystore.properties.example):
//   storeFile=release/sup-port.keystore
//   storePassword=...
//   keyAlias=...
//   keyPassword=...
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// >>> sup-port release signing';

function patchGradle(contents) {
  if (contents.includes(MARKER)) return contents;

  // Proje kökündeki keystore.properties'i okuyan bir signingConfig ekle ve
  // release buildType'ının signingConfig'ini ona çevir. Dosya yoksa debug'a
  // düşer, böylece anahtarsız makine de derleyebilir.
  const signingBlock = `
    ${MARKER}
    signingConfigs {
        release {
            def props = new Properties()
            def f = rootProject.file('../keystore.properties')
            if (f.exists()) {
                f.withInputStream { props.load(it) }
                // storeFile proje köküne göre; rootProject android/ olduğu için
                // '../' bir üste, proje köküne çıkar.
                storeFile rootProject.file('../' + props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }
    }
    // <<< sup-port release signing`;

  // signingConfigs bloğunu android { ... } içine, defaultConfig'ten önce ekle.
  let out = contents.replace(
    /(\n\s*defaultConfig\s*\{)/,
    `${signingBlock}\n$1`,
  );

  // release buildType debug key yerine bizim config'i kullansın — ama yalnızca
  // keystore.properties gerçekten varsa; yoksa debug imza geçerli kalır.
  out = out.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
    `$1rootProject.file('../keystore.properties').exists() ? signingConfigs.release : signingConfigs.debug`,
  );

  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = patchGradle(cfg.modResults.contents);
    }
    return cfg;
  });
};
