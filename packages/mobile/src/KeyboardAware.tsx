import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  findNodeHandle, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  TextInput, type ScrollViewProps, type StyleProp, type TextInputProps, type ViewStyle
} from 'react-native';

/** Both iOS and Android (including edge-to-edge Android) need keyboard avoidance.
 * Android must use windowSoftInputMode=adjustResize, not adjustPan, to avoid
 * the native OS and the keyboard-avoiding view moving the screen twice.
 */
export function KeyboardAwareView({ children, style }: {
  children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
    {children}
  </KeyboardAvoidingView>;
}

type NativeTextInput = ComponentRef<typeof TextInput>;
type NativeScrollView = ComponentRef<typeof ScrollView>;
type KeyboardScrollResponder = {
  scrollResponderScrollNativeHandleToKeyboard?: (
    node: number, additionalOffset: number, preventNegativeScrollOffset: boolean
  ) => void;
  getScrollResponder?: () => KeyboardScrollResponder | null;
};
const ScrollFocusedInput = createContext<(input: NativeTextInput | null) => void>(() => {});

/**
 * Scroll the focused field into the visible region once the keyboard finishes
 * opening, and again when focus moves to a lower field with keyboard already up.
 * KeyboardAvoidingView alone makes room but does not ensure that deeply nested
 * inputs in long rescue/care forms are scrolled into view.
 */
export function KeyboardAwareScrollView({ children, style, ...props }: ScrollViewProps) {
  const scroll = useRef<NativeScrollView>(null);
  const focused = useRef<NativeTextInput | null>(null);
  const reveal = useCallback((input: NativeTextInput | null) => {
    if (input) focused.current = input;
    const current = focused.current;
    if (!current) return;
    // Two frames lets native keyboard insets and the scroll viewport settle.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const handle = findNodeHandle(current);
      if (handle) {
        const responder = scroll.current as unknown as KeyboardScrollResponder | null;
        const implementation = responder?.getScrollResponder?.() ?? responder;
        implementation?.scrollResponderScrollNativeHandleToKeyboard?.(handle, 28, true);
      }
    }));
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => reveal(null));
    const hidden = Keyboard.addListener('keyboardDidHide', () => { focused.current = null; });
    return () => { shown.remove(); hidden.remove(); };
  }, [reveal]);
  return <ScrollFocusedInput.Provider value={reveal}>
    <KeyboardAwareView>
      <ScrollView {...props} ref={scroll} style={[{ flex: 1 }, style]}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
        keyboardDismissMode={props.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}>
        {children}
      </ScrollView>
    </KeyboardAwareView>
  </ScrollFocusedInput.Provider>;
}

/** Drop-in TextInput: parent keyboard-aware scroll view knows which field to reveal. */
export function KeyboardAwareTextInput({ onFocus, ...props }: TextInputProps) {
  const input = useRef<NativeTextInput>(null);
  const reveal = useContext(ScrollFocusedInput);
  return <TextInput {...props} ref={input} onFocus={event => {
    onFocus?.(event);
    reveal(input.current);
  }} />;
}

/** Hide floating navigation and oversized map previews while editing a form. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const willOpen = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true));
    const willClose = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false));
    return () => { willOpen.remove(); willClose.remove(); };
  }, []);
  return visible;
}
