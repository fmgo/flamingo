module.exports = {
  "extends": "airbnb",
  "installedESLint": true,
  "env": {
    "node": true,
    "es6": true,
    "mocha": true,
  },
  "rules": {
    "no-underscore-dangle": 0,
    "new-cap": 0,
    "max-len": [2, 130, 2, {
      "ignoreUrls": true,
      "ignoreComments": false
    }],
  },
};