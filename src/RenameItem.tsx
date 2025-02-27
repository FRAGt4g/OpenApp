import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";

export default function RenameItem(props: { item: { id: string; name: string }; onRename: (newName: string) => void }) {
  const [name, setName] = useState(props.item.name);
  const { pop } = useNavigation();
  function handleSubmit() {
    props.onRename(name);
    showToast({
      style: Toast.Style.Success,
      title: `${props.item.name} renamed to ${name}!`,
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
      <Form.TextField id="name" title="New Name" value={name} onChange={setName} autoFocus />
    </Form>
  );
}
