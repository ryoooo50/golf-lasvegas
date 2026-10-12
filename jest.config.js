const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  // server/ の結合テストは実 DB が必要なため npm run test:api で実行する
  testPathIgnorePatterns: ["/node_modules/", "/server/"],
  transform: {
    ...tsJestTransformCfg,
  },
};