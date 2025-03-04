import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";

export default function AddWebsite(props: { onSave: (newName: string, url: string) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const { pop } = useNavigation();
  function handleSubmit() {
    props.onSave(name, url);
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
      <Form.Description text="Add a website to the list of things you can open" />
      <Form.TextField
        id="name"
        title="Default Name of Website (add custom name later)"
        value={name}
        onChange={setName}
        placeholder="Youtube"
        autoFocus
      />
      <Form.TextField id="url" title="URL" value={url} onChange={setUrl} placeholder="https://youtube.com" />
    </Form>
  );
}
