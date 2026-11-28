import { strings } from "@/strings";
import { Screen } from "./Screen";
import { Text } from "./Text";

/** Stand-in for tab screens that spec 0012 builds. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen edges={["bottom"]}>
      <Text variant="title2" bold accessibilityRole="header">
        {title}
      </Text>
      <Text tone="textMuted">{strings.placeholder.body}</Text>
    </Screen>
  );
}
