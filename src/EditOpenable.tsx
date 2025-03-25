import { Action, ActionPanel, Application, Form, Icon, Image, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { Openable } from "./imports";

const pathTypes = ["Emoji", "File Path", "Url", "Raycast Icon"] as const;

function isEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}

async function isValidUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });

    if (!res.ok) return false;

    return res.headers.get("Content-Type")?.startsWith("image") ?? false;
  } catch (error) {
    return false;
  }
}

function isValidFileType(file: string) {
  const validFileTypes = [".png", "Icon?", ".icns"];
  return validFileTypes.some((value) => file.endsWith(value));
}

function getIconType(icon: Image.ImageLike): (typeof pathTypes)[number] {
  const iconString = icon as string;
  if (iconString.startsWith("https://")) {
    return "Url";
  }
  if (isEmoji(iconString)) {
    return "Emoji";
  }
  if (Object.keys(Icon).includes(iconString)) {
    return "Raycast Icon";
  }
  return "File Path";
}

type ChangedValues = {
  name?: string;
  icon?: Image.ImageLike;
  opener?: string;
};

export default function EditOpenable(props: {
  startCondition: Openable;
  onSave: (updatedOpenable: ChangedValues) => void;
  gatherOpeners: () => Promise<Application[]>;
  defaultOpener: string;
}) {
  const { startCondition, onSave, gatherOpeners, defaultOpener } = props;
  const [changedValues, setChangedValues] = useState<ChangedValues>({});
  const { pop } = useNavigation();
  const [iconType, setIconType] = useState<(typeof pathTypes)[number]>();
  const [error, setError] = useState("");
  const [openers, setOpeners] = useState<Application[]>([]);

  useEffect(() => {
    gatherOpeners().then((openers) => {
      setOpeners(openers);
    });
  }, []);

  function getIcon(type: (typeof pathTypes)[number]) {
    switch (type) {
      case "Emoji":
        return Icon.Emoji;
      case "File Path":
        return Icon.Document;
      case "Url":
        return Icon.Globe;
      case "Raycast Icon":
        return Icon.RaycastLogoNeg;
    }
  }

  function handleSubmit() {
    onSave(changedValues);
    showToast({
      style: Toast.Style.Success,
      title: `${startCondition.name} updated!`,
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
      <Form.TextField
        id="name"
        title="New Name"
        defaultValue={startCondition.name}
        onChange={(value) => setChangedValues({ ...changedValues, name: value })}
        autoFocus
      />

      <Form.Separator />

      <Form.Dropdown
        id="iconType"
        title="Icon Type"
        onChange={(newValue) => {
          setError("");
          setIconType(newValue as (typeof pathTypes)[number]);
        }}
        defaultValue={getIconType(startCondition.icon)}
      >
        {Object.values(pathTypes).map((type) => (
          <Form.Dropdown.Item key={type} value={type} title={type} icon={getIcon(type)} />
        ))}
      </Form.Dropdown>

      {iconType === "Emoji" && (
        <Form.TextField
          id="emoji"
          title="Emoji"
          onChange={(input) => {
            for (const char of input) {
              console.log("char:", char);
            }
            console.log("input & is emoji:", input, isEmoji(input), input.length);
            if (input.length !== 2 || !isEmoji(input)) {
              setError("Can only be one emoji!");
              return;
            }
            setError("");
            setChangedValues({ ...changedValues, icon: input });
          }}
          placeholder="One Emoji"
          autoFocus
          error={error}
          defaultValue={startCondition.icon as string}
        />
      )}
      {iconType === "File Path" && (
        <Form.FilePicker
          id="filePath"
          title="File Path"
          error={error}
          showHiddenFiles={true}
          allowMultipleSelection={false}
          canChooseDirectories={false}
          onChange={(files: string[]) => {
            if (files.length == 0) {
              setError("");
              return;
            }
            const file = files[0];
            if (!isValidFileType(file)) {
              setError(`Must be a valid file type (.icns, Icon?, .png) ${file}`);
              return;
            }
            setError("");
            setChangedValues({ ...changedValues, icon: file });
          }}
          autoFocus
          defaultValue={[startCondition.icon as string]}
        />
      )}
      {iconType === "Url" && (
        <Form.TextField
          id="url"
          title="URL"
          error={error}
          onChange={async (newUrl) => {
            if (newUrl == "") return;
            if (!(await isValidUrl(newUrl))) {
              setError("Must be a valid url that returns a picture!");
              return;
            }
            setError("");
            setChangedValues({ ...changedValues, icon: newUrl });
          }}
          placeholder="https://example.com/icon.png"
          defaultValue={startCondition.icon as string}
        />
      )}
      {iconType === "Raycast Icon" && (
        <Form.Dropdown
          id="raycastIcon"
          title="Raycast Icon"
          onChange={(icon: string) => {
            setError("");
            setChangedValues({ ...changedValues, icon: Icon[icon as keyof typeof Icon] });
          }}
          defaultValue={startCondition.icon as string}
          error={error}
        >
          {Object.keys(Icon).map((icon) => (
            <Form.Dropdown.Item key={icon} value={icon} title={icon} icon={Icon[icon as keyof typeof Icon]} />
          ))}
        </Form.Dropdown>
      )}

      <Form.Separator />

      {startCondition.type === "directory" && (
        <Form.Dropdown
          id="opener"
          title="Opener"
          onChange={(newValue) => setChangedValues({ ...changedValues, opener: newValue })}
          defaultValue={defaultOpener}
        >
          {openers.map((opener) => (
            <Form.Dropdown.Item key={opener.path} value={opener.path} title={opener.name} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}
