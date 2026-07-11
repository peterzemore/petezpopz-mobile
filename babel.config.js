module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
    ],
    // Force Babel to compile these node_modules through the private-field transforms.
    // @egjs/hammerjs and react-native-worklets ship with # private class syntax
    // that Hermes (React Native's JS engine) cannot parse unless Babel converts it first.
    overrides: [
      {
        test: /[\/\\]node_modules[\/\\](@egjs|react-native-worklets|react-native-reanimated)[\/\\]/,
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
        ],
      },
    ],
  };
};