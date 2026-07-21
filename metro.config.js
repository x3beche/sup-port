const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Playwright her koşuda tests/.artifacts altına geçici klasörler açıyor. Metro
// bunları da izlemeye çalışınca sistemin inotify izleyici limiti doluyor ve
// geliştirme sunucusu ENOSPC ile düşüyor. Test çıktıları kaynak değil, izleme.
config.resolver.blockList = [
  /\/tests\/\.artifacts\/.*/,
  /\/tests\/\.report\/.*/,
  /\/android\/.*/,
  /\/ios\/.*/,
  /\/backend\/\.venv\/.*/,
  // expo-camera vb. iOS/macOS Swift prebuild framework'leri (binlerce dosya) web/
  // android geliştirme sunucusunda gereksiz; izlenince inotify limiti dolup
  // Metro ENOSPC ile düşüyordu.
  /\/node_modules\/[^/]+\/prebuilds\/.*/,
  /\.xcframework\/.*/,
  /\/dist-[^/]+\/.*/,
];

module.exports = config;
