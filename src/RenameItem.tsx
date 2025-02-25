import { Action, ActionPanel, Form, popToRoot, showHUD } from "@raycast/api";
import { useState } from "react";

export default function RenameItem(props: { item: { id: string; name: string }; onRename: (newName: string) => void }) {
  const [name, setName] = useState(props.item.name);

  function handleSubmit() {
    props.onRename(name);
    showHUD("Item renamed!");
    popToRoot(); // Closes the form
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
