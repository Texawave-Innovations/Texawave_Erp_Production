const shared = require("@texawave-erp/config/eslint.config.js");

module.exports = [
  ...shared,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
