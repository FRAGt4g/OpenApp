import { Action, ActionPanel, Form, Keyboard, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { formatKeybind } from "./imports";

const MODIFIERS: { value: Keyboard.KeyModifier; title: string }[] = [
  { value: "cmd", title: "⌘ Command" },
  { value: "ctrl", title: "⌃ Control" },
  { value: "opt", title: "⌥ Option" },
  { value: "shift", title: "⇧ Shift" },
];

const KEYS: Keyboard.KeyEquivalent[] = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
  "return",
  "delete",
  "tab",
  "space",
  "escape",
  "arrowUp",
  "arrowDown",
  "arrowLeft",
  "arrowRight",
  ".",
  ",",
  "/",
  ";",
  "'",
  "[",
  "]",
] as Keyboard.KeyEquivalent[];

export default function SetKeybind(props: {
  appName: string;
  initial?: Keyboard.Shortcut;
  onSave: (shortcut: Keyboard.Shortcut) => Promise<void> | void;
}) {
  const { pop } = useNavigation();
  const [modifiers, setModifiers] = useState<Keyboard.KeyModifier[]>(props.initial?.modifiers ?? ["cmd", "shift"]);
  const [key, setKey] = useState<Keyboard.KeyEquivalent | "">(props.initial?.key ?? "");
  const [error, setError] = useState("");

  const preview = key && modifiers.length > 0 ? formatKeybind({ modifiers, key: key as Keyboard.KeyEquivalent }) : "—";

  async function handleSubmit() {
    if (!key) {
      setError("Pick a key");
      return;
    }
    if (modifiers.length === 0) {
      await showToast({ style: Toast.Style.Failure, title: "Pick at least one modifier" });
      return;
    }
    // Raycast ignores shortcuts whose only modifier is shift, so require a "real" modifier.
    if (modifiers.length === 1 && modifiers[0] === "shift") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Add Command, Control, or Option",
        message: "Shift alone is not a valid keybind",
      });
      return;
    }
    await props.onSave({ modifiers, key: key as Keyboard.KeyEquivalent });
    await showToast({ style: Toast.Style.Success, title: `Keybind set to ${preview}` });
    pop();
  }

  return (
    <Form
      navigationTitle={`Keybind for ${props.appName}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Keybind" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Preview" text={preview} />
      <Form.TagPicker
        id="modifiers"
        title="Modifiers"
        value={modifiers}
        onChange={(values) => setModifiers(values as Keyboard.KeyModifier[])}
      >
        {MODIFIERS.map((modifier) => (
          <Form.TagPicker.Item key={modifier.value} value={modifier.value} title={modifier.title} />
        ))}
      </Form.TagPicker>
      <Form.Dropdown
        id="key"
        title="Key"
        value={key}
        error={error || undefined}
        onChange={(value) => {
          setError("");
          setKey(value as Keyboard.KeyEquivalent);
        }}
      >
        <Form.Dropdown.Item value="" title="Select a key…" />
        {KEYS.map((k) => (
          <Form.Dropdown.Item key={k} value={k} title={formatKeybind({ modifiers: [], key: k })} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
