const presets = [
    [
      "@babel/preset-env",
      {
        targets: {
          node: 'current',
        },
        useBuiltIns: "usage",
        corejs: 3,
      },
    ],
  ];
  
  module.exports = { presets };
  