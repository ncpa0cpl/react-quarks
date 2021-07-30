module.exports = {
  roots: ["<rootDir>"],
  testRegex: ".*__tests__/.+(\\.test\\.(ts|js|tsx|jsx))",
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testEnvironment: "jsdom",
};
