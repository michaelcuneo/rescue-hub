import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

type Tab = 'rescues' | 'chats' | 'account';

const TABS = [
  { id: 'rescues', label: 'Rescues', icon: 'map-outline', selectedIcon: 'map', hint: 'View rescue locations and available rescues' },
  { id: 'chats', label: 'Chats', icon: 'chatbubbles-outline', selectedIcon: 'chatbubbles', hint: 'Open organisation chats' },
  { id: 'account', label: 'Account', icon: 'person-circle-outline', selectedIcon: 'person-circle', hint: 'Open your account and availability settings' }
] as const;

const PILL_INSET = 7; // Border + inner padding on each side.

/** Always anchored to the same bottom safe-area position on every screen. */
export default function BottomTabs({ active, onSelect, appearance = 'light' }: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  appearance?: 'light' | 'dark';
}) {
  // Match the app's actual appearance, not the phone's independent system setting.
  const dark = appearance === 'dark';
  const [barWidth, setBarWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const slotWidth = Math.max(0, (barWidth - PILL_INSET * 2) / TABS.length);
  const selectedIndex = TABS.findIndex(tab => tab.id === active);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (mounted) setReduceMotion(value); })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (!slotWidth) return;
    const nextX = Math.max(0, selectedIndex) * slotWidth;
    indicatorX.stopAnimation();
    if (reduceMotion) {
      indicatorX.setValue(nextX);
    } else {
      Animated.spring(indicatorX, {
        toValue: nextX,
        damping: 24,
        stiffness: 280,
        mass: 0.9,
        useNativeDriver: true
      }).start();
    }
    return () => indicatorX.stopAnimation();
  }, [indicatorX, reduceMotion, selectedIndex, slotWidth]);

  const selectedColor = dark ? '#123d2a' : '#ffffff';
  const inactiveColor = dark ? '#e0eae4' : '#52665b';

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={[styles.shadow, dark && styles.shadowDark]}>
        <View
          style={[styles.capsule, dark && styles.capsuleDark]}
          accessibilityRole="tablist"
          onLayout={event => {
            const width = Math.round(event.nativeEvent.layout.width);
            setBarWidth(previous => previous === width ? previous : width);
          }}>
          <BlurView
            pointerEvents="none"
            tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
            intensity={75}
            blurMethod={Platform.OS === 'android' ? 'none' : undefined}
            style={StyleSheet.absoluteFillObject}
          />
          <View pointerEvents="none" style={[styles.glassOverlay, dark && styles.glassOverlayDark]} />
          {slotWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.selectedPill,
                dark && styles.selectedPillDark,
                { width: slotWidth, transform: [{ translateX: indicatorX }] }
              ]}
            />
          ) : null}
          <View style={styles.tabs}>
            {TABS.map(tab => {
              const selected = active === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tab.label}
                  accessibilityHint={tab.hint}
                  onPress={() => onSelect(tab.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    pressed && styles.pressed,
                    selected && !slotWidth && (dark ? styles.initialSelectionDark : styles.initialSelection)
                  ]}>
                  <Ionicons
                    name={selected ? tab.selectedIcon : tab.icon}
                    size={23}
                    color={selected ? selectedColor : inactiveColor}
                  />
                  <Text
                    maxFontSizeMultiplier={1.45}
                    style={[styles.label, { color: selected ? selectedColor : inactiveColor }, selected && styles.activeLabel]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 3,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 10
  },
  shadow: {
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#0b2217',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.19,
    shadowRadius: 18,
    elevation: 12
  },
  shadowDark: {
    backgroundColor: 'rgba(23,38,31,0.6)',
    shadowOpacity: 0.32
  },
  capsule: {
    height: 70,
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    backgroundColor: 'rgba(246,250,247,0.85)',
    padding: 6
  },
  capsuleDark: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(23,38,31,0.88)'
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(241,248,244,0.26)'
  },
  glassOverlayDark: {
    backgroundColor: 'rgba(16,35,26,0.3)'
  },
  selectedPill: {
    position: 'absolute',
    left: PILL_INSET,
    top: PILL_INSET,
    height: 56,
    borderRadius: 29,
    backgroundColor: '#173d2c'
  },
  selectedPillDark: {
    backgroundColor: '#c7e7d2'
  },
  initialSelection: {
    backgroundColor: '#173d2c'
  },
  initialSelectionDark: {
    backgroundColor: '#c7e7d2'
  },
  tabs: {
    flex: 1,
    flexDirection: 'row'
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2
  },
  pressed: {
    opacity: 0.78
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.12,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false
  },
  activeLabel: {
    fontWeight: '800'
  }
});
