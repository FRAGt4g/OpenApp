import { Action, ActionPanel, Form, Icon, Keyboard, popToRoot, showHUD } from "@raycast/api";
import { useState } from "react";

export default function SetQuickCommand(props: {
  item: { id: string; name: string };
  onSetQuickCommand: (command: { modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent }) => void;
}) {
  const [command, setCommand] = useState<{ modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent } | null>(
    null,
  );

  function handleSubmit() {
    console.log("value", command);
    if (command) {
      props.onSetQuickCommand(command);
      showHUD("Quick command set!");
      popToRoot(); // Closes the form
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TagPicker id="command" title="Quick Command" autoFocus>
        <Form.TagPicker.Item title="command" value="cmd" icon={Icon.CommandSymbol} />
        <Form.TagPicker.Item title="option" value="opt" icon={Icon.Bolt} />
        <Form.TagPicker.Item title="shift" value="shift" icon={Icon.ArrowUp} />
        <Form.TagPicker.Item title="control" value="control" icon={Icon.ChevronUp} />
        <Form.TagPicker.Item title="hyper-key" value="hyper" icon={Icon.Star} />
      </Form.TagPicker>
    </Form>
  );
}
