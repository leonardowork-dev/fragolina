import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  Avatar,
  Button,
  Mascot,
  Sticker,
  Text,
  TextField,
  useEffectsBus,
  useMascot,
  useTheme,
} from "@/design";
import { motion } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { isCompleteCode, extractCode } from "@/lib/joinCode";
import { S } from "@/lib/strings.it";
import { type ActionResult, selectPairing, useCouple } from "@/state/coupleStore";

import { CodeInput } from "./CodeInput";
import { CodeSticker } from "./CodeSticker";
import { ConfirmSheet } from "./ConfirmSheet";
import { pasteText } from "./clipboard";

/**
 * Collegamento con l'altra persona, in tutti i suoi stati:
 *  scelta (crea / ho un codice) → ricevi il codice e aspetti → siete collegati.
 * Si usa nell'onboarding ("onboarding") e nella scheda Noi ("us"): stessa logica, stesso aspetto.
 * Momento di festa (una volta): due mascotte, coriandoli, aptica Success, quando il collegamento si completa.
 */
const timeLeft = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m >= 90) return `${Math.round(m / 60)} ore`;
  return m <= 1 ? "un minuto" : `${m} minuti`;
};

function ErrorLine({ error }: { error: string | null }) {
  const { colors } = useTheme();
  if (!error) return null;
  return (
    <Animated.View entering={FadeIn.duration(motion.duration.enter).easing(motion.easeOut)}>
      <Text
        variant="bodyStrong"
        color={colors.accentInk}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        {error}
      </Text>
    </Animated.View>
  );
}

export function PairedMoment({ me, partner }: { me: string; partner: string }) {
  const { colors } = useTheme();
  return (
    <Sticker id="eccovi" fill={colors.blush} radius={32} offset={6} padding={20} tiltMax={1.2}>
      <View style={{ gap: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "center",
            height: 130,
          }}
        >
          <View style={{ transform: [{ rotate: "-6deg" }] }}>
            <Mascot size={112} mood="love" bob={false} tappable={false} />
          </View>
          <View style={{ marginLeft: -22, transform: [{ rotate: "6deg" }] }}>
            <Mascot size={112} mood="happy" bob={false} tappable={false} />
          </View>
        </View>
        <Text variant="display" align="center" accessibilityRole="header">
          {S.pairing.successTitle}
        </Text>
        <Text variant="body" align="center">
          {S.pairing.successBody(partner)}
        </Text>
        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}
          accessible
          accessibilityLabel={`${me} e ${partner}`}
        >
          <Avatar name={me} size={44} fill={colors.butter} />
          <Avatar name={partner} size={44} fill={colors.sky} />
        </View>
      </View>
    </Sticker>
  );
}

export function PairingPanel({
  variant,
  onPaired,
}: {
  variant: "onboarding" | "us";
  onPaired?: () => void;
}) {
  const { colors } = useTheme();
  const pairing = useCouple(selectPairing);
  const partner = useCouple((s) => s.partnerName);
  const me = useCouple((s) => s.meName);
  const code = useCouple((s) => s.joinCode);
  const expiresAt = useCouple((s) => s.joinCodeExpiresAt);
  const busy = useCouple((s) => s.busy);
  const kind = useCouple((s) => s.backendKind);
  const create = useCouple((s) => s.createCouple);
  const join = useCouple((s) => s.joinCouple);
  const renew = useCouple((s) => s.renewCode);
  const leave = useCouple((s) => s.leaveCouple);
  const release = useCouple((s) => s.releasePartner);
  const setMyName = useCouple((s) => s.setMyName);
  const [name, setName] = useState(me);

  const [mode, setMode] = useState<"choose" | "join">("choose");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorSeq, setErrorSeq] = useState(0);
  const [confirm, setConfirm] = useState<"leave" | "release" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const celebrated = useRef(pairing === "paired");
  const [moment, setMoment] = useState(false);

  // Festa una sola volta, solo se il collegamento si completa MENTRE questa schermata è aperta.
  // (Si ascolta lo store invece di reagire a un render: niente aggiornamenti di stato dentro un effect.)
  useEffect(() => {
    return useCouple.subscribe((st) => {
      const p = selectPairing(st);
      if (p === "paired" && !celebrated.current) {
        celebrated.current = true;
        setMoment(true);
        haptics.success();
        useMascot.getState().react("love", 2200);
        useEffectsBus.getState().fireConfetti();
        onPaired?.();
      } else if (p !== "paired" && celebrated.current) {
        celebrated.current = false;
        setMoment(false);
      }
    });
  }, [onPaired]);

  // Il conto alla rovescia del codice si aggiorna ogni 30 s.
  useEffect(() => {
    if (pairing !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [pairing]);

  const fail = (r: ActionResult) => {
    if (r.ok) return;
    haptics.light();
    setError(S.pairing.errors[r.error] ?? S.pairing.errors.unknown);
    setErrorSeq((n) => n + 1);
  };
  const doCreate = async () => {
    setError(null);
    setMyName(name);
    fail(await create());
  };
  const doJoin = async () => {
    if (!isCompleteCode(typed)) {
      setError(S.pairing.errors.invalid_code);
      setErrorSeq((n) => n + 1);
      haptics.light();
      return;
    }
    setError(null);
    setMyName(name);
    fail(await join(typed));
  };
  const doPaste = async () => {
    const t = extractCode(await pasteText());
    if (t) {
      setTyped(t);
      setError(null);
      haptics.tick();
    }
  };

  const note =
    kind === "mock" ? (
      <Text variant="caption" style={{ opacity: 0.8 }}>
        {S.pairing.mockNote}
      </Text>
    ) : null;

  // ---- collegati ----
  if (pairing === "paired") {
    return (
      <View style={{ gap: 14 }}>
        {variant === "onboarding" || moment ? (
          <PairedMoment me={me} partner={partner} />
        ) : (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            accessible
            accessibilityLabel={S.pairing.connectedWith(partner)}
          >
            <View style={{ flexDirection: "row" }}>
              <Avatar name={me} size={44} fill={colors.butter} />
              <View style={{ marginLeft: -10, marginTop: 6 }}>
                <Avatar name={partner} size={44} fill={colors.sky} />
              </View>
            </View>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {S.pairing.connectedWith(partner)}
            </Text>
          </View>
        )}
        {variant === "us" ? (
          <>
            <Button
              label={S.pairing.leave}
              variant="secondary"
              onPress={() => setConfirm("leave")}
              fullWidth
            />
            <Button
              label={S.pairing.phoneChanged(partner)}
              variant="ghost"
              onPress={() => setConfirm("release")}
            />
          </>
        ) : null}
        <ConfirmSheet
          visible={confirm === "leave"}
          title={S.pairing.leaveTitle}
          body={S.pairing.leaveBody(partner)}
          confirmLabel={S.pairing.leaveConfirm}
          cancelLabel={S.pairing.keep}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const r = await leave();
            setConfirm(null);
            fail(r);
          }}
        />
        <ConfirmSheet
          visible={confirm === "release"}
          title={S.pairing.phoneChanged(partner)}
          body={S.pairing.phoneChangedBody(partner)}
          confirmLabel={S.pairing.phoneChangedAction}
          cancelLabel={S.pairing.keep}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const r = await release();
            setConfirm(null);
            fail(r);
          }}
        />
        <ErrorLine error={error} />
      </View>
    );
  }

  // ---- aspetto l'altra persona ----
  if (pairing === "waiting" && code) {
    const left = expiresAt ? expiresAt - now : null;
    const expired = left !== null && left <= 0;
    return (
      <View style={{ gap: 14 }}>
        <Text variant="title" accessibilityRole="header">
          {S.pairing.waitingTitle}
        </Text>
        <Text variant="body">{S.pairing.waitingBody}</Text>
        <CodeSticker code={code} dim={expired} />
        {expired ? (
          <View style={{ gap: 10 }}>
            <Text variant="bodyStrong" color={colors.accentInk}>
              {S.pairing.expired}
            </Text>
            <Button label={S.pairing.renew} onPress={async () => fail(await renew())} />
          </View>
        ) : left !== null ? (
          <Text variant="caption">{S.pairing.expiresIn(timeLeft(left))}</Text>
        ) : null}
        <Button label={S.pairing.cancel} variant="ghost" onPress={() => setConfirm("leave")} />
        <ConfirmSheet
          visible={confirm === "leave"}
          title={S.pairing.leaveTitle}
          body={S.pairing.leaveBodyWaiting}
          confirmLabel={S.pairing.leaveConfirm}
          cancelLabel={S.pairing.keep}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const r = await leave();
            setConfirm(null);
            setMode("choose");
            fail(r);
          }}
        />
        <ErrorLine error={error} />
        {note}
      </View>
    );
  }

  // ---- ho un codice ----
  if (mode === "join") {
    return (
      <View style={{ gap: 14 }}>
        <TextField label={S.pairing.yourName} value={name} onChange={setName} />
        <Text variant="bodyStrong">{S.pairing.haveCodeHint}</Text>
        <CodeInput
          value={typed}
          onChange={(c) => {
            setTyped(c);
            if (error) setError(null);
          }}
          onSubmit={doJoin}
          error={!!error}
          errorSeq={errorSeq}
          autoFocus={variant === "us"}
          disabled={busy}
        />
        <ErrorLine error={error} />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Button
            label={busy ? S.pairing.joining : S.pairing.join}
            onPress={doJoin}
            disabled={busy || typed.length < 6}
            haptic="light"
          />
          <Button
            label={S.pairing.paste}
            variant="secondary"
            onPress={doPaste}
            disabled={busy}
            haptic="tick"
          />
        </View>
        <Button
          label={S.pairing.back}
          variant="ghost"
          onPress={() => {
            setMode("choose");
            setError(null);
            setTyped("");
          }}
        />
        {note}
      </View>
    );
  }

  // ---- scelta ----
  return (
    <View style={{ gap: 16 }}>
      <Sticker
        id="crea-posto"
        fill={colors.accent}
        radius={28}
        offset={5}
        padding={18}
        tiltMax={1.2}
        onPress={busy ? undefined : doCreate}
        haptic="light"
        accessibilityLabel={S.pairing.create}
      >
        <View style={{ gap: 4 }}>
          <Text variant="title">{busy ? S.pairing.creating : S.pairing.create}</Text>
          <Text variant="bodyStrong">{S.pairing.createHint}</Text>
        </View>
      </Sticker>
      <Sticker
        id="ho-codice"
        fill={colors.surface}
        radius={28}
        offset={4}
        padding={18}
        tiltMax={1.2}
        onPress={() => (setMode("join"), setError(null))}
        haptic="tick"
        accessibilityLabel={S.pairing.haveCode}
      >
        <View style={{ gap: 4 }}>
          <Text variant="title">{S.pairing.haveCode}</Text>
          <Text variant="body">{S.pairing.haveCodeHint}</Text>
        </View>
      </Sticker>
      <ErrorLine error={error} />
      {note}
    </View>
  );
}
