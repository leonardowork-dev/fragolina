import React from "react";
import { View } from "react-native";

import { Button, Sheet, Text } from "@/design";

/** Conferma di un'azione distruttiva: pulsante rosso per confermare, pulsante normale per restare. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  busy,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 18, marginTop: 4 }}>
        <Text variant="body">{body}</Text>
        <View style={{ gap: 12 }}>
          <Button label={cancelLabel} variant="secondary" onPress={onClose} fullWidth />
          <Button
            label={confirmLabel}
            variant="danger"
            onPress={onConfirm}
            disabled={busy}
            haptic="medium"
            fullWidth
          />
        </View>
      </View>
    </Sheet>
  );
}
