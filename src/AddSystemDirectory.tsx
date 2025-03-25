import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";

export default function AddSystemDirectory(props: { onSave: (newName: string, path: string) => void }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const { pop } = useNavigation();
  function handleSubmit() {
    props.onSave(name, path);
    showToast({
      style: Toast.Style.Success,
      title: `Added ${name} to list of opens!`,
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
      <Form.Description text="Add a system directory to the list of things you can open" />
      <Form.TextField
        id="name"
        title="Default Name of System Directory (add custom name later)"
        value={name}
        onChange={setName}
        placeholder="Youtube"
        autoFocus
      />
      <Form.FilePicker
        id="path"
        title="Path to System Directory"
        canChooseDirectories
        onChange={(newValue) => setPath(newValue[0])}
        allowMultipleSelection={false}
      />
    </Form>
  );
}
