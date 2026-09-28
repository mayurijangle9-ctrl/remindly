import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';

export interface ResponsiveContainerProps extends ViewProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ensures clean centering and maximum reading width on tablets and desktop web,
 * while expanding to 100% width on mobile screens.
 */
export function ResponsiveContainer({
  children,
  maxWidth = 680,
  style,
  ...props
}: ResponsiveContainerProps) {
  const { width } = useWindowDimensions();
  const isConstrained = width > maxWidth;

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth,
          alignSelf: 'center',
          width: '100%',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
