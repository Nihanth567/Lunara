import type { Ref } from 'react';
import { Platform, ScrollView, ScrollViewProps } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

type Props = KeyboardAwareScrollViewProps &
  ScrollViewProps & {
    /** React 19 passes `ref` as a prop; both branches forward it to a ScrollView. */
    ref?: Ref<ScrollView>;
  };

/**
 * The scroll container for any screen with a text field.
 *
 * `react-native-keyboard-controller` moves the *focused input* above the
 * keyboard (and follows the caret in a growing multiline answer), rather than
 * padding the whole screen by the keyboard's height the way
 * `KeyboardAvoidingView` does. It also animates on the keyboard's own frame,
 * so the content and the keyboard move as one instead of the content jumping
 * after the keyboard has already arrived, and nothing is left offset once the
 * keyboard goes.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
