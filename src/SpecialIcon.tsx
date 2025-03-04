import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";

export default function SetSpecialIcon(props: { currentPath: string; onSubmit: (iconPath: string) => void }) {
  const [icon, setIcon] = useState(props.currentPath);
  const { pop } = useNavigation();
  function handleSubmit() {
    props.onSubmit(icon);
    showToast({
      style: Toast.Style.Success,
      title: `Icon set to ${icon}!`,
    });
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker id="icon" title="Icon" onChange={(value) => setIcon(value[0])} />
    </Form>
  );
}
