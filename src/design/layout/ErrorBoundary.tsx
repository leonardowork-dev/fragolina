import React from "react";
import { View } from "react-native";

import { S } from "@/lib/strings.it";

import { Button } from "../primitives/Button";
import { Sticker } from "../primitives/Sticker";
import { Text } from "../primitives/Text";
import { useTheme } from "../ThemeProvider";

/**
 * Nessuna schermata bianca: se qualcosa si rompe mentre si disegna una schermata, al suo posto c'è un adesivo gentile
 * con "Riprova". Uno alla radice dell'app e uno per ogni schermata principale (così una tab rotta non porta giù le altre).
 * Il fallback usa solo Sticker/Text/Button (niente mascotte né dati dello store: ciò che si è rotto non deve romperlo ancora).
 * Il dettaglio dell'errore si scrive solo in sviluppo (`__DEV__`), mai nei log di produzione.
 */
export function ErrorFallback({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.ground,
      }}
    >
      <Sticker id="errore" fill={colors.butter} radius={28} offset={6} padding={20} tiltMax={1.2}>
        <View style={{ gap: 12 }}>
          <Text variant="display" accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {S.error.title}
          </Text>
          <Text variant="body" maxFontSizeMultiplier={1.4}>
            {compact ? S.error.bodyScreen : S.error.body}
          </Text>
          <Button label={S.error.retry} onPress={onRetry} haptic="light" />
        </View>
      </Sticker>
    </View>
  );
}

type Props = {
  /** Nome della schermata (solo per il log di sviluppo). */
  name?: string;
  compact?: boolean;
  children: React.ReactNode;
};
type State = { error: Error | null; attempt: number };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.warn(`[ErrorBoundary:${this.props.name ?? "app"}]`, error);
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (this.state.error) return <ErrorFallback onRetry={this.retry} compact={this.props.compact} />;
    // `attempt` come key: "Riprova" rimonta tutto da zero.
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

/** Avvolge una schermata in un ErrorBoundary di schermata (HOC). */
export function withErrorBoundary<P extends object>(Component: React.ComponentType<P>, name: string) {
  const Wrapped = (props: P) => (
    <ErrorBoundary name={name} compact>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Boundary(${name})`;
  return Wrapped;
}
