module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable source-map-loader for bytecave-browser package
      webpackConfig.module.rules.forEach((rule) => {
        if (rule.enforce === 'pre' && rule.use) {
          const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
          uses.forEach((use) => {
            if (use.loader && use.loader.includes('source-map-loader')) {
              rule.exclude = rule.exclude || [];
              if (!Array.isArray(rule.exclude)) {
                rule.exclude = [rule.exclude];
              }
              rule.exclude.push(/@hashd\/bytecave-browser/);
            }
          });
        }
      });
      
      // Add crypto polyfill for @libp2p/peer-id
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser')
      };
      
      // Add process global
      const webpack = require('webpack');
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer']
        })
      );
      
      return webpackConfig;
    },
  },
};
