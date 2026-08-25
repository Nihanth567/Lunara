const APP_GROUP = "group.com.lunara.app.widget";

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LunaraWidget",
  displayName: "Lunara",
  colors: {
    $accent: "#FF9A8B",
    $widgetBackground: "#0F0C29",
  },
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [APP_GROUP],
  },
});

module.exports.APP_GROUP = APP_GROUP;
