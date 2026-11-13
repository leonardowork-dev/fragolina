import React, { useState } from "react";
import { View } from "react-native";

import { Button, Sheet, Text, TextField } from "@/design";
import { NAME_MAX, cleanPetName } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

/** Nome del pet: lo sceglie chi lo fa nascere, l'altra persona può cambiarlo. Massimo 16 lettere. */
export function NameSheet({
  visible,
  onClose,
  current,
  partnerName,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  current: string | null;
  partnerName: string;
  onSave: (name: string) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={current ? S.pet.nameRename : S.pet.nameTitle}>
      <NameForm current={current} partnerName={partnerName} onSave={onSave} onClose={onClose} />
    </Sheet>
  );
}

// Il pannello smonta il contenuto a ogni chiusura: il campo riparte dal nome di adesso senza effetti.
function NameForm({
  current,
  partnerName,
  onSave,
  onClose,
}: {
  current: string | null;
  partnerName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(current ?? "");
  const nm = cleanPetName(v);
  return (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <TextField label={S.pet.nameField} value={v} onChange={setV} maxLength={NAME_MAX} placeholder={S.pet.namePlaceholder} />
      <Text variant="caption">{S.pet.nameHint(partnerName)}</Text>
      <Button
        label={S.pet.nameSave}
        haptic="success"
        disabled={!nm}
        onPress={() => {
          onSave(nm);
          onClose();
        }}
      />
    </View>
  );
}
