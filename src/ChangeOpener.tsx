import { Action, ActionPanel, Application, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { Openable } from "./imports";

export default function ChangeOpener(props: {
  directory: Openable;
  gatherOpeners: () => Promise<Application[]>;
  onRename: (newName: string) => void;
}) {
  const { directory, gatherOpeners, onRename } = props;
  const [openers, setOpeners] = useState<Application[]>([]);
  const [opener, setOpener] = useState(openers[0]?.path ?? "Finder");
  const { pop } = useNavigation();

  useEffect(() => {
    gatherOpeners().then((openers) => {
      setOpeners(openers);
    });
  }, []);

  function handleSubmit() {
    onRename(opener);
    showToast({
      style: Toast.Style.Success,
      title: `${directory.name} opener changed to ${opener}!`,
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
      <Form.Dropdown id="opener" title="Opener" value={opener} onChange={setOpener}>
        {openers.map((opener) => (
          <Form.Dropdown.Item key={opener.path} value={opener.path} title={opener.name} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
