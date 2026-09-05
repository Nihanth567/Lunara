/**
 * Static config lives in app.json; this file only fills in the values that come
 * from the environment.
 *
 * Right now that is Google Sign-In. app.json used to carry
 * `iosUrlScheme: "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"` — a literal
 * placeholder that got compiled into the native project, registering a URL
 * scheme no Google client would ever call back on. Rather than ship a fake
 * value, the plugin is only included when a real client id is present, and the
 * Google button hides itself when it isn't (see `isGoogleSignInConfigured`).
 */

/**
 * Google's iOS URL scheme is the client id with its components reversed:
 * `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`.
 * Accepts a value that is already reversed, so either form works in .env.
 */
function iosUrlSchemeFor(clientId) {
  if (!clientId) return null;
  const id = clientId.trim();
  if (!id) return null;
  if (id.startsWith('com.googleusercontent.apps.')) return id;
  const suffix = '.apps.googleusercontent.com';
  if (!id.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${id.slice(0, -suffix.length)}`;
}

module.exports = ({ config }) => {
  const scheme = iosUrlSchemeFor(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== '@react-native-google-signin/google-signin';
  });

  if (scheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]);
  }

  return { ...config, plugins };
};
