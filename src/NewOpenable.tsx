import {
  Action,
  ActionPanel,
  Application,
  Form,
  getApplications,
  Icon,
  Image,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { isEmoji, isValidFileType, isValidUrl, pathTypes } from "./imports";

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

// function fixRaycastIconName(input: string) {
//   const a = input.slice(0, input.lastIndexOf("-")).split("-");
//   return a.map((b) => b.charAt(0).toUpperCase() + b.slice(1)).join("");
// }

export default function NewOpenable(props: {
  onSave: (
    newName: string,
    path: string,
    type: "website" | "directory",
    opener: string | null,
    icon: Image.ImageLike,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"website" | "directory">("website");
  const [iconType, setIconType] = useState<"Emoji" | "File Path" | "Url" | "Raycast Icon">("Raycast Icon");
  const [emojiIcon, setEmojiIcon] = useState<string | null>(null);
  const [filePathIcon, setFilePathIcon] = useState<string | null>(null);
  const [urlIcon, setUrlIcon] = useState<string | null>(null);
  const [raycastIcon, setRaycastIcon] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [path, setPath] = useState("");
  const [opener, setOpener] = useState<string | null>(null);
  const [openers, setOpeners] = useState<Application[]>([]);
  const { pop } = useNavigation();

  const icon =
    iconType === "Emoji"
      ? emojiIcon
      : iconType === "File Path"
        ? filePathIcon
        : iconType === "Url"
          ? urlIcon
          : raycastIcon;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save"
            onSubmit={() => {
              if (!icon) {
                setError("Icon is required!");
                return;
              }
              if (!path) {
                setError("Path is required!");
                return;
              }
              if (!name) {
                setError("Name is required!");
                return;
              }

              props.onSave(name, path, type, opener, icon as Image.ImageLike);
              showToast({
                style: Toast.Style.Success,
                title: `Added ${name} to list of ${type}s!`,
              });
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="type" title="Type" onChange={(value) => setType(value as "website" | "directory")}>
        <Form.Dropdown.Item value="website" title="Website" />
        <Form.Dropdown.Item value="directory" title="Directory" />
      </Form.Dropdown>

      <Form.Separator />

      {type === "website" && (
        <>
          <Form.Description text="Add a website to the list of things you can open" />
          <Form.TextField
            id="name"
            title="Default Name of Website"
            value={name}
            onChange={setName}
            placeholder="Youtube"
            autoFocus
          />
          <Form.TextField id="path" title="Path" value={path} onChange={setPath} placeholder="https://youtube.com" />
        </>
      )}

      {type === "directory" && (
        <>
          <Form.Description text="Add a system directory to the list of things you can open" />
          <Form.TextField
            id="name"
            title="Default Name of Directory"
            value={name}
            onChange={setName}
            placeholder="Youtube"
            autoFocus
          />
          <Form.FilePicker
            id="path"
            title="Path to Directory"
            canChooseDirectories
            onChange={async (newValue) => {
              setPath(newValue[0]);
              setOpeners(await getApplications(newValue[0]));
            }}
            allowMultipleSelection={false}
          />
          {path !== "" && (
            <Form.Dropdown id="opener" title="Opener" onChange={(newValue) => setOpener(newValue)} defaultValue={""}>
              {openers.map((opener) => (
                <Form.Dropdown.Item key={opener.path} value={opener.name} title={opener.name} />
              ))}
            </Form.Dropdown>
          )}
        </>
      )}

      <Form.Separator />

      <Form.Dropdown
        id="iconType"
        title="Icon Type"
        onChange={(newValue) => {
          setError("");
          setIconType(newValue as (typeof pathTypes)[number]);
        }}
        defaultValue={"raycastIcon"}
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
            if (input.length !== 2 || !isEmoji(input)) {
              setError("Can only be one emoji!");
              return;
            }
            setError("");
            setEmojiIcon(input);
          }}
          placeholder="One Emoji"
          autoFocus
          error={error}
          defaultValue={emojiIcon as string}
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
            setFilePathIcon(file);
          }}
          autoFocus
          defaultValue={[filePathIcon as string]}
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
            setUrlIcon(newUrl);
          }}
          placeholder="https://example.com/icon.png"
          defaultValue={urlIcon as string}
        />
      )}
      {iconType === "Raycast Icon" && (
        <Form.Dropdown
          id="raycastIcon"
          title="Raycast Icon"
          onChange={(icon: string) => {
            setError("");
            setRaycastIcon(icon);
          }}
          defaultValue={raycastIcon as string}
          error={error}
        >
          {Object.keys(Icon).map((icon) => (
            <Form.Dropdown.Item key={icon} value={icon} title={icon} icon={Icon[icon as keyof typeof Icon]} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}
