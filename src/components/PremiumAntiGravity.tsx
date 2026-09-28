import React, { useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AntiGravityTheme, resolveTheme } from '@/constants/mediaResolver';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Strict Particle Configuration adhering to the specification.
 */
export type ParticleConfig = {
  id: number;
  size: number;
  depth: number;
  startX: number;
  startY: number;
  drift: number;
  swayAmplitude: number;
  swayFrequency: number;
  riseDistance: number;
  duration: number;
  delay: number;
  rotation: number;
  opacity: number;
};

/**
 * Complete Particle Item with optical depth styling
 */
export interface ParticleItem {
  config: ParticleConfig;
  symbol: string;
  phase: number;
  initialRotation: number;
  glowRadius: number;
  zIndex: number;
}

export interface PremiumAntiGravityProps {
  /**
   * Theme identifier from mediaResolver (e.g. 'water', 'birthday', 'medicine', 'workout', 'default')
   */
  theme?: AntiGravityTheme | string;
  /**
   * Triggers the anti-gravity burst lifecycle when true
   */
  active: boolean;
  /**
   * Display mode:
   * - 'fullscreen': expansive ascension across modal/screen bounds (e.g. ReminderPopup)
   * - 'localized': focused upward fountain centered over a specific card (e.g. ReminderCard)
   */
  variant?: 'fullscreen' | 'localized';
  /**
   * Total animation duration in ms (default 1000ms for crisp, responsive completion)
   */
  durationMs?: number;
  /**
   * Optional horizontal origin offset
   */
  originX?: number;
  /**
   * Optional vertical origin offset
   */
  originY?: number;
  /**
   * Trigger native tactile feedback alongside the visual burst (default false to prevent duplicates)
   */
  haptic?: boolean;
  /**
   * Callback invoked on UI-thread completion when all particles have faded out
   */
  onAnimationComplete?: () => void;
  /**
   * Container style overrides
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * Single Particle View running 100% on the native UI thread worklet.
 * Derives its visual state purely from: progress + particle configuration + depth.
 */
const SingleParticleView = React.memo(function SingleParticleView({
  config,
  symbol,
  phase,
  initialRotation,
  glowColor,
  glowRadius,
  zIndex,
  originX = 0,
  originY = 0,
  progress,
}: {
  config: ParticleConfig;
  symbol: string;
  phase: number;
  initialRotation: number;
  glowColor: string;
  glowRadius: number;
  zIndex: number;
  originX?: number;
  originY?: number;
  progress: Animated.SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const masterP = progress.value;

    if (masterP <= 0 || masterP >= 1) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0 }, { rotate: '0deg' }],
      };
    }

    // 1. Calculate local normalized progress considering particle delay & duration
    const localProgress = interpolate(
      masterP,
      [config.delay, Math.min(1, config.delay + config.duration)],
      [0, 1],
      Extrapolation.CLAMP
    );

    if (localProgress <= 0.001 || localProgress >= 0.999) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0 }, { rotate: '0deg' }],
      };
    }

    // 2. Soft Fade Lifecycle:
    // 0% -> 0, 10% -> maxOpacity, 70% -> maxOpacity, 90% -> 0, 100% -> 0
    const maxOpacity = config.opacity;
    const opacity = interpolate(
      localProgress,
      [0, 0.1, 0.7, 0.9, 1],
      [0, maxOpacity, maxOpacity, 0, 0],
      Extrapolation.CLAMP
    );

    // 3. Anti-Gravity Vertical Lift (scaled by riseDistance and depth)
    const translateY = originY - localProgress * config.riseDistance;

    // 4. Organic Lateral Sway:
    // x(t) = baseX + drift * progress + sin(progress * frequency + phase) * amplitude
    const sway =
      Math.sin(localProgress * config.swayFrequency + phase) *
      config.swayAmplitude;
    const translateX = config.startX + originX + config.drift * localProgress + sway;

    // 5. Glassmorphic Breathing Scale:
    const scalePulse = interpolate(
      localProgress,
      [0, 0.2, 0.65, 0.95, 1],
      [0.72, 1.06, 1.0, 0.92, 0.8],
      Extrapolation.CLAMP
    );
    const scale = (config.size / 24) * scalePulse;

    // 6. Subtle Micro-Gravity Tumbling Rotation:
    const rotation = initialRotation + localProgress * config.rotation;

    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particleContainer,
        {
          zIndex,
          pointerEvents: 'none' as const,
        },
        animatedStyle,
      ]}
    >
      <Animated.Text
        style={[
          styles.particleText,
          {
            fontSize: config.size,
            textShadowColor: glowColor,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: glowRadius,
          },
        ]}
      >
        {symbol}
      </Animated.Text>
    </Animated.View>
  );
});

function createStaticParticlePool(isLocalized: boolean): Array<{
  config: ParticleConfig;
  phase: number;
  initialRotation: number;
  glowRadius: number;
  zIndex: number;
}> {
  const totalCount = 18;
  return Array.from({ length: totalCount }, (_, i) => {
    // 3 Depth planes: 0 = Background, 1 = Midground, 2 = Foreground
    const depthTier = i % 3;
    const depth = depthTier === 0 ? 0.35 : depthTier === 1 ? 0.65 : 1.0;

    // Pseudo-random deterministic offsets based on index
    const seed1 = ((i * 37 + 13) % 100) / 100;
    const seed2 = ((i * 59 + 29) % 100) / 100;
    const seed3 = ((i * 83 + 47) % 100) / 100;

    // 1. Size derived from depth
    const size = Math.round(14 + depth * 14 + seed1 * 4);

    // 2. Opacity derived from depth
    const opacity = depthTier === 0 ? 0.48 : depthTier === 1 ? 0.80 : 0.98;

    // 3. Start position
    const startX = isLocalized
      ? -60 + seed1 * 120
      : -SCREEN_WIDTH * 0.42 + ((i * (SCREEN_WIDTH * 0.84)) / totalCount);
    const startY = 0;

    // 4. Drift and sway parameters
    const drift = (-24 + seed2 * 48) * (0.6 + depth * 0.4);
    const swayAmplitude = Math.round((12 + depth * 22) + seed3 * 6);
    const swayFrequency = Math.PI * (2.2 + (1 - depth) * 1.5);
    const phase = seed1 * Math.PI * 2;

    // 5. Vertical rise distance
    const riseDistance = isLocalized
      ? Math.round(150 + depth * 140 + seed2 * 30)
      : Math.round(340 + depth * 280 + seed2 * 60);

    // 6. Timing (delay & duration)
    // Foreground particles move faster (shorter duration), background linger longer
    const delay = seed1 * 0.12;
    const duration = depthTier === 2 ? 0.76 : depthTier === 1 ? 0.82 : 0.86;

    // 7. Rotation
    const initialRotation = -18 + seed2 * 36;
    const rotation = (-45 + seed3 * 90) * (0.7 + depth * 0.3);

    const config: ParticleConfig = {
      id: i,
      size,
      depth,
      startX,
      startY,
      drift,
      swayAmplitude,
      swayFrequency,
      riseDistance,
      duration,
      delay,
      rotation,
      opacity,
    };

    return {
      config,
      phase,
      initialRotation,
      glowRadius: depthTier === 2 ? 14 : depthTier === 1 ? 8 : 4,
      zIndex: depthTier === 2 ? 30 : depthTier === 1 ? 20 : 10,
    };
  });
}

// Exactly 18 deterministic particles pre-created at module load time; reused across every burst
const FULLSCREEN_PARTICLE_POOL = createStaticParticlePool(false);
const LOCALIZED_PARTICLE_POOL = createStaticParticlePool(true);

export const PremiumAntiGravity = React.memo(function PremiumAntiGravity({
  theme,
  active,
  variant = 'fullscreen',
  durationMs = 1000,
  originX = 0,
  originY = 0,
  haptic = false,
  onAnimationComplete,
  style,
}: PremiumAntiGravityProps) {
  const visualConfig = useMemo(() => resolveTheme(theme), [theme]);

  // Master shared progress value driving all particle worklets
  const progress = useSharedValue(0);

  const onAnimationCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  // Master UI-Thread animation loop using custom cubic Bezier
  useEffect(() => {
    let isMounted = true;
    if (active) {
      if (haptic) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      progress.value = 0;
      progress.value = withTiming(
        1,
        {
          duration: durationMs,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        },
        (finished) => {
          'worklet';
          if (finished) {
            runOnJS(() => {
              if (isMounted) {
                onAnimationCompleteRef.current?.();
              }
            })();
          }
        }
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }

    return () => {
      isMounted = false;
      cancelAnimation(progress);
    };
  }, [active, haptic, durationMs, progress]);

  const pool = variant === 'localized' ? LOCALIZED_PARTICLE_POOL : FULLSCREEN_PARTICLE_POOL;

  if (!active) {
    return null;
  }

  const symbols = visualConfig.symbols;

  return (
    <View
      style={[
        variant === 'fullscreen' ? styles.fullscreenOverlay : styles.localizedContainer,
        { pointerEvents: 'none' as const },
        style,
      ]}
    >
      {pool.map((item) => (
        <SingleParticleView
          key={item.config.id}
          config={item.config}
          symbol={symbols[item.config.id % symbols.length]}
          phase={item.phase}
          initialRotation={item.initialRotation}
          glowColor={visualConfig.glowColor}
          glowRadius={item.glowRadius}
          zIndex={item.zIndex}
          originX={originX}
          originY={originY}
          progress={progress}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  localizedContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    overflow: 'visible',
  },
  particleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
