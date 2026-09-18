const shared = require("@texawave-erp/config/eslint.config.js");

module.exports = [
  ...shared,
  {
    ignores: [".next/**"],
  },
];
