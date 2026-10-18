// Adopt the UIKit scene-based life cycle, which apps built with the iOS 27 SDK (Xcode 27)
// must use or they abort at launch ("UIScene life cycle is required for apps built with this SDK").
//
// Expo SDK 58's native template does this out of the box. We stay on SDK 57 so the App Store
// Expo Go (SDK 57) keeps working for development, and back-port the same three changes here.
// `expo` 57.0.30+ already ships `ExpoAppSceneDelegate`.
// Remove this plugin after upgrading to SDK 58 (then run `npx expo prebuild --clean`).
const { IOSConfig, withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return cfg; // already applied

    if (!src.includes('class AppDelegate: ExpoAppDelegate {') || !WINDOW_BLOCK.test(src)) {
      throw new Error('withSceneLifecycle: AppDelegate.swift does not match the SDK 57 template; update the plugin.');
    }
    src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(
      WINDOW_BLOCK,
      '    // The window is created and React Native is started by `SceneDelegate` under the\n' +
        '    // scene-based life cycle (required by the iOS 27 SDK).\n',
    );
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  config = IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'SceneDelegate.swift',
    contents: SCENE_DELEGATE,
    overwrite: true,
  });
  config = withSceneManifest(config);
  return withSceneAppDelegate(config);
};
