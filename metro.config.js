const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdfjs-dist, React Native'i Node.js ortamı sanıp bu modülleri require() ile çeker.
// Tüm çağrılar try/catch içinde; boş modül döndürmek yeterli.
const NODE_MOCKS = ['canvas', 'path2d-polyfill', 'fs', 'http', 'https', 'zlib'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_MOCKS.includes(moduleName)) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
