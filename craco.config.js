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
      return webpackConfig;
    },
  },
};
