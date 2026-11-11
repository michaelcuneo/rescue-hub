import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ComponentRef, type ReactNode
} from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View,
  type ScrollViewProps, type StyleProp, type TextInputProps, type ViewStyle
} from 'react-native';
import { keyboardOverlap, keyboardScrollDelta } from '../../core/keyboard-geometry';

type NativeTextInput = ComponentRef<typeof TextInput>;
type NativeScrollView = ComponentRef<typeof ScrollView>;
type FocusHandler = (input: NativeTextInput | null) => void;
const FocusedField = createContext<FocusHandler>(() => {});

const REVEAL_RETRIES_MS = [0, 75, 180, 350] as const;
const CLEARANCE = 28;

/**
 * Only iOS gets padding avoidance. Android is configured with
 * softwareKeyboardLayoutMode=resize. Applying "padding" on Android *and*
 * adjustResize double offsets part of the view, hiding bottom controls.
 */
export function KeyboardAwareView({ children, style }: {
  children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const container = useRef<ComponentRef<typeof View>>(null);
  const [androidInset, setAndroidInset] = useState(0);
  const top = useRef<number | null>(null);
  const checkInset = useCallback(() => {
    if (Platform.OS !== 'android') return;
    requestAnimationFrame(() => {
      container.current?.measureInWindow((_x, y, _w, height) => {
        setAndroidInset(keyboardOverlap(y + height, top.current));
      });
    });
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', event => {
      top.current = event.endCoordinates.screenY;
      checkInset();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      top.current = null;
      setAndroidInset(0);
    });
    return () => { shown.remove(); hidden.remove(); };
  }, [checkInset]);
  return <View ref={container} onLayout={checkInset}
    style={[{ flex: 1, minHeight: 0 }, style]}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[{ flex: 1, minHeight: 0 },
        Platform.OS === 'android' && androidInset > 0 ? { paddingBottom: androidInset } : null]}>
      {children}
    </KeyboardAvoidingView>
  </View>;
}

/**
 * A focused input must be checked against the *actual* available screen
 * rectangle. The old scrollResponderScrollNativeHandleToKeyboard invocation
 * used a deprecated responder and never confirmed the focused field cleared
 * the keyboard. This version measures both native views after layout and
 * scrolls only the obscured portion, with retries while keyboard animates.
 */
export function KeyboardAwareScrollView({ children, style, contentContainerStyle, onScroll, ...props }: ScrollViewProps) {
  const scroller = useRef<NativeScrollView>(null);
  const focused = useRef<NativeTextInput | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generation = useRef(0);
  const [bottomSpace, setBottomSpace] = useState(96);

  const stopRetries = useCallback(() => {
    generation.current++;
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const reveal = useCallback((token: number) => {
    if (token !== generation.current || !focused.current || !scroller.current) return;
    const input = focused.current;
    const scroll = scroller.current;
    scroll.measureInWindow((_vx, viewportTop, _vw, viewportHeight) => {
      if (token !== generation.current || !focused.current || !scroller.current) return;
      input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
        if (token !== generation.current || focused.current !== input) return;
        const viewportBottom = viewportTop + viewportHeight;
        const overlap = keyboardOverlap(viewportBottom, keyboardTop.current);
        // When Android overlays the viewport rather than resizing it, content
        // needs additional space so the final input can physically scroll up.
        setBottomSpace(Math.max(96, overlap + 68));
        const delta = keyboardScrollDelta({
          viewportTop, viewportBottom, fieldTop: inputTop,
          fieldBottom: inputTop + inputHeight,
          keyboardTop: keyboardTop.current, clearance: CLEARANCE
        });
        if (Math.abs(delta) > 2) {
          const next = Math.max(0, scrollY.current + delta);
          scrollY.current = next;
          scroll.scrollTo({ y: next, animated: true });
        }
      });
    });
  }, []);

  const queueReveal = useCallback((input: NativeTextInput | null) => {
    if (input) focused.current = input;
    if (!focused.current) return;
    stopRetries();
    const token = generation.current;
    for (const delay of REVEAL_RETRIES_MS) {
      timers.current.push(setTimeout(() => reveal(token), delay));
    }
  }, [reveal, stopRetries]);

  useEffect(() => {
    const updateKeyboard = (event: { endCoordinates: { screenY: number } }) => {
      keyboardTop.current = event.endCoordinates.screenY;
      queueReveal(null);
    };
    const hideKeyboard = () => {
      keyboardTop.current = null;
      focused.current = null;
      stopRetries();
      setBottomSpace(96);
    };
    const subscriptions = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', updateKeyboard),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hideKeyboard),
      ...(Platform.OS === 'ios' ? [Keyboard.addListener('keyboardWillChangeFrame', updateKeyboard)] : [])
    ];
    // Focus can happen while the keyboard is already visible (e.g. switching
    // between the many schedule fields). No extra show event is required.
    return () => { subscriptions.forEach(subscription => subscription.remove()); stopRetries(); };
  }, [queueReveal, stopRetries]);

  return <FocusedField.Provider value={queueReveal}>
    <KeyboardAwareView>
      <ScrollView
        {...props}
        ref={scroller}
        style={[{ flex: 1, minHeight: 0 }, style]}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
        keyboardDismissMode={props.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
        scrollEventThrottle={16}
        onScroll={event => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        onLayout={() => queueReveal(null)}
        onContentSizeChange={() => queueReveal(null)}>
        {children}
      </ScrollView>
    </KeyboardAwareView>
  </FocusedField.Provider>;
}

export function KeyboardAwareTextInput({ onFocus, ...props }: TextInputProps) {
  const input = useRef<NativeTextInput>(null);
  const reveal = useContext(FocusedField);
  return <TextInput {...props} ref={input} onFocus={event => {
    onFocus?.(event);
    reveal(input.current);
  }} />;
}

/** Hide floating map/toolbars and rescuer bottom tabs during text entry. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}
