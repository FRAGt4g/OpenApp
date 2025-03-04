import { Action, ActionPanel, Form, Icon, Image, showToast, Toast, useNavigation } from "@raycast/api";
import fetch from "node-fetch";
import { useState } from "react";

const pathTypes = ["Emoji", "File Path", "Url", "Raycast Icon"] as const;
type IconPathTypes = (typeof pathTypes)[number];

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

export default function ChangeIcon(props: {
  appName: string;
  currentIconPath: Image.ImageLike;
  onSave: (newIconPath: Image.ImageLike) => void;
}) {
  const [iconType, setIconType] = useState<IconPathTypes>();
  const [iconPath, setIconPath] = useState<Image.ImageLike>("");
  const [error, setError] = useState("");
  const { pop } = useNavigation();
  function handleSubmit() {
    props.onSave(iconPath);
    showToast({
      style: Toast.Style.Success,
      title: `Updated ${props.appName}'s icon!`,
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
      <Form.Description text="Fill in one of the below options" />
      <Form.Dropdown
        id="iconType"
        title="Icon Type"
        onChange={(newValue) => {
          setError("");
          setIconType(newValue as IconPathTypes);
        }}
      >
        {Object.values(pathTypes).map((type) => (
          <Form.Dropdown.Item key={type} value={type} title={type} icon={iconPath} />
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
            setIconPath(input);
          }}
          placeholder="One Emoji"
          autoFocus
          error={error}
        />
      )}
      {iconType === "Raycast Icon" && (
        <Form.Dropdown
          id="raycastIcon"
          title="Raycast Icon"
          onChange={(icon: string) => {
            setIconPath(Icon[icon as keyof typeof Icon]);
          }}
          defaultValue={"Globe"}
          error={error}
        >
          {Object.keys(Icon).map((icon) => (
            <Form.Dropdown.Item key={icon} value={icon} title={icon} icon={Icon[icon as keyof typeof Icon]} />
          ))}
        </Form.Dropdown>
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
            setIconPath(file);
          }}
          autoFocus
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
            setIconPath(newUrl);
          }}
          placeholder="https://example.com/icon.png"
        />
      )}
    </Form>
  );
}
