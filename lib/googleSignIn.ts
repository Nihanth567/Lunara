/**
 * Whether this build can actually do Google Sign-In.
 *
 * The native URL scheme is only registered when a real iOS client id is present
 * (see `app.config.js`), so without one the button leads to a callback that can
 * never come back. Offering a sign-in method that cannot work is worse than not
 * offering it — Apple, phone, and email all still do.
 */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() &&
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim(),
  );
}
