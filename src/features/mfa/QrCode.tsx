import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { encodeQr } from "@/lib/qr";
import { color, space } from "@/theme/tokens";

/**
 * QR code drawn locally from the otpauth URI (spec 0012 M12): no image URL,
 * no network, no third party. Always dark on light, whatever the app theme,
 * so scanners can read it. Rows are run-length merged to keep the view count low.
 */
export function QrCode({
  value,
  size = 220,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const rows = useMemo(() => {
    const qr = encodeQr(value);
    const out: { start: number; len: number }[][] = [];
    for (let y = 0; y < qr.size; y++) {
      const runs: { start: number; len: number }[] = [];
      let x = 0;
      while (x < qr.size) {
        if (qr.modules[y * qr.size + x]) {
          const start = x;
          while (x < qr.size && qr.modules[y * qr.size + x]) x++;
          runs.push({ start, len: x - start });
        } else x++;
      }
      out.push(runs);
    }
    return { size: qr.size, rows: out };
  }, [value]);

  const quiet = 4;
  const cell = size / (rows.size + quiet * 2);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width: size, height: size, backgroundColor: color.light.surface }]}
    >
      {rows.rows.map((runs, y) =>
        runs.map((r) => (
          <View
            key={`${y}:${r.start}`}
            style={{
              position: "absolute",
              left: (r.start + quiet) * cell,
              top: (y + quiet) * cell,
              width: r.len * cell,
              height: cell + 0.5,
              backgroundColor: color.light.text,
            }}
          />
        )),
      )}
    </View>
  );
}

const styles = StyleSheet.create({ frame: { alignSelf: "center", marginVertical: space[2] } });
