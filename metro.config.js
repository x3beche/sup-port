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
];

module.exports = config;
