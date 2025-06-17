import { Action, ActionPanel, Icon } from "@raycast/api";

export const ResetFrecencyValues = () => {
  return (
    <ActionPanel.Section title="Destructive">
      <Action title="Reset Frecency Values" icon={Icon.Clock} onAction={() => {}} />
    </ActionPanel.Section>
  );
};

export const ClearIconCache = () => {
  return (
    <ActionPanel.Section title="Destructive">
      <Action title="Reset Frecency Values" icon={Icon.Clock} onAction={() => {}} />
    </ActionPanel.Section>
  );
};
