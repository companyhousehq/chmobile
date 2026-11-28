import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  captureCameraPage,
  pickFilePage,
  pickPhotoPages,
  type MediaFailure,
} from "./evidenceMedia";
import {
  MAX_EVIDENCE_ITEMS,
  formatBytes,
  type EvidencePage,
  type EvidenceType,
} from "@/lib/company";
import { deletePageFile } from "@/lib/companyDrafts";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { Notice } from "@/ui/Notice";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.claim;

const FAILURE: Record<MediaFailure, string | null> = {
  cancelled: null,
  "camera-denied": t.permissionCamera,
  empty: t.fileEmpty,
  large: t.fileLarge,
  type: t.fileType,
  prepare: t.cantPrepare,
};

/**
 * Evidence input: kind of document, multi-page camera capture with preview,
 * retake and remove, photos, a picked PDF, or a typed reference (M17).
 */
export function EvidenceEditor({
  types,
  typeKey,
  onTypeKey,
  pages,
  onPages,
  reference,
  onReference,
}: {
  types: EvidenceType[];
  typeKey: string;
  onTypeKey: (k: string) => void;
  pages: EvidencePage[];
  onPages: (p: EvidencePage[]) => void;
  reference: string;
  onReference: (r: string) => void;
}) {
  const { c } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<EvidencePage | null>(null);
  const room = MAX_EVIDENCE_ITEMS - pages.length - (reference.trim() ? 1 : 0);

  const run = async (fn: () => ReturnType<typeof captureCameraPage>, replaceId?: string) => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) return setMessage(FAILURE[res.reason]);
      if (replaceId) {
        const old = pages.find((p) => p.id === replaceId);
        if (old) deletePageFile(old);
        onPages(pages.flatMap((p) => (p.id === replaceId ? res.pages.slice(0, 1) : [p])));
      } else {
        onPages([...pages, ...res.pages.slice(0, Math.max(0, room))]);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: EvidencePage) => {
    deletePageFile(p);
    onPages(pages.filter((x) => x.id !== p.id));
  };

  return (
    <>
      <Text variant="footnote" tone="text2" bold>
        {t.type}
      </Text>
      <Chips
        label={t.type}
        value={typeKey}
        onChange={onTypeKey}
        options={types.map((x) => ({ value: x.key, label: x.label }))}
      />
      {types.find((x) => x.key === typeKey)?.description ? (
        <Text variant="footnote" tone="textMuted">
          {types.find((x) => x.key === typeKey)?.description}
        </Text>
      ) : null}
      {message ? <Notice tone="warning">{message}</Notice> : null}
      <Button
        label={pages.length > 0 ? t.addPage : t.takePhoto}
        busy={busy}
        disabled={room <= 0}
        onPress={() => void run(captureCameraPage)}
      />
      <Button
        label={t.pickPhotos}
        variant="secondary"
        disabled={busy || room <= 0}
        onPress={() => void run(pickPhotoPages)}
      />
      <Button
        label={t.pickFile}
        variant="secondary"
        disabled={busy || room <= 0}
        onPress={() => void run(pickFilePage)}
      />
      {room <= 0 ? <Notice>{t.tooMany}</Notice> : null}
      {pages.length > 0 ? (
        <Text variant="footnote" tone="text2" bold>
          {t.pages(pages.length)}
        </Text>
      ) : null}
      {pages.map((p, i) => (
        <Card key={p.id}>
          <View style={styles.pageRow}>
            {p.mime.startsWith("image/") ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`${t.preview}: ${t.page(i + 1)}`}
                onPress={() => setPreview(p)}
              >
                <Image
                  source={{ uri: p.uri }}
                  accessibilityIgnoresInvertColors
                  style={[styles.thumb, { backgroundColor: c.surface2 }]}
                />
              </Pressable>
            ) : (
              <View style={[styles.thumb, styles.pdf, { backgroundColor: c.surface2 }]}>
                <Text bold>PDF</Text>
              </View>
            )}
            <View style={styles.pageText}>
              <Text bold>{t.page(i + 1)}</Text>
              <Text variant="footnote" tone="textMuted">
                {formatBytes(p.size)}
              </Text>
            </View>
          </View>
          {p.mime.startsWith("image/") ? (
            <Button
              label={t.retake}
              variant="secondary"
              disabled={busy}
              onPress={() => void run(captureCameraPage, p.id)}
            />
          ) : null}
          <Button
            label={`${t.remove}: ${t.page(i + 1)}`}
            variant="link"
            destructive
            onPress={() => remove(p)}
          />
        </Card>
      ))}
      <TextField
        label={t.reference}
        hint={t.referenceHint}
        value={reference}
        onChangeText={onReference}
        maxLength={200}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Modal visible={!!preview} animationType="fade" onRequestClose={() => setPreview(null)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: c.forestDeep }]}>
          {preview ? (
            <Image
              source={{ uri: preview.uri }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              style={styles.full}
            />
          ) : null}
          <Button label={t.closePreview} onPress={() => setPreview(null)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pageRow: { flexDirection: "row", gap: space[3], alignItems: "center" },
  thumb: { width: 72, height: 96, borderRadius: radius.sm },
  pdf: { alignItems: "center", justifyContent: "center" },
  pageText: { flex: 1, gap: space[1] },
  modal: { flex: 1, padding: space[4], gap: space[3] },
  full: { flex: 1 },
});
