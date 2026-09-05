import { Redirect } from 'expo-router';

/**
 * `lunara://tonight` — the home-screen widget's tap target.
 *
 * The widget has always opened this URL (`targets/widget/index.swift`), but no
 * route answered to it, so every tap landed on the not-found screen. It is a
 * pure alias for the Tonight tab rather than a screen of its own; a redirect
 * keeps a single implementation of the ritual and means the tab bar is there
 * when the user arrives.
 */
export default function TonightDeepLink() {
  return <Redirect href={'/(app)/' as never} />;
}
