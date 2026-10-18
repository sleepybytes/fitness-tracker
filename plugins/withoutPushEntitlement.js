// The app only uses *local* scheduled notifications, which need no push entitlement.
// expo-notifications always adds `aps-environment`, and a free Apple ID (Personal Team)
// cannot sign an app that carries it. Strip it so the app can be installed with Xcode
// and a free account. Remove this plugin if remote push is ever added.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
