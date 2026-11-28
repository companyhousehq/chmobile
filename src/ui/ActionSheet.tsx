import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

export interface SheetOption {
  key: string;
  label: string;
  hint?: string;
  destructive?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

/** Bottom sheet of actions for a card (spec 0012 OQ-8). Closes before running the chosen action. */
export function ActionSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={strings.common.cancel}
        accessibilityRole="button"
        style={[styles.backdrop, { backgroundColor: c.overlay }]}
        onPress={onClose}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}
        accessibilityViewIsModal
      >
        <Text bold accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <ScrollView style={styles.list}>
          {options.map((o) => (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
              accessibilityState={{ selected: !!o.selected }}
              onPress={() => {
                onClose();
                o.onSelect();
              }}
              style={[styles.option, { borderTopColor: c.divider }]}
            >
              <View style={styles.optionText}>
                <Text tone={o.destructive ? "dangerFg" : "text"} bold={!!o.selected}>
                  {o.selected ? `${o.label} (current)` : o.label}
                </Text>
                {o.hint ? (
                  <Text variant="footnote" tone="textMuted">
                    {o.hint}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.common.cancel}
          onPress={onClose}
          style={[styles.option, { borderTopColor: c.divider }]}
        >
          <Text tone="accent" bold>
            {strings.common.cancel}
          </Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    maxHeight: "75%",
  },
  title: { padding: space[4] },
  list: { flexGrow: 0 },
  option: {
    minHeight: control.minTarget,
    justifyContent: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: { gap: space[1] },
});
