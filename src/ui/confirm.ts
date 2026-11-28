import { Alert } from "react-native";
import { strings } from "@/strings";

/** Native confirmation before a destructive or hard-to-undo action. */
export function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  destructive = true,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: strings.common.cancel, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
