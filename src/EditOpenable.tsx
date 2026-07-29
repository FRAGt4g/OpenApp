import {
  Action,
  ActionPanel,
  Application,
  Color,
  Form,
  Icon,
  Image,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { getIconType, isEmoji, isValidFileType, isValidUrl, justIcon, validColor } from "./imports";
import { Openable, PathType, pathTypes } from "./types";

export type ChangedValues = {
  nickname?: string;
  defaultName?: string;
  icon?: Image.ImageLike;
  opener?: string;
  sourcePath?: string;
};

export default function EditOpenable(props: {
  startCondition: Openable & { defaultName: string };
  onSave: (updatedOpenable: ChangedValues) => void;
  gatherOpeners: () => Promise<Application[]>;
  defaultOpener: string;
}) {
  const { startCondition, onSave, gatherOpeners, defaultOpener } = props;
  const [changedValues, setChangedValues] = useState<ChangedValues>({});
  const { pop } = useNavigation();
  const [iconType, setIconType] = useState<PathType>();
  const [error, setError] = useState("");
  const [openers, setOpeners] = useState<Application[]>([]);
  const [iconColor, setIconColor] = useState<Color.ColorLike>(
    typeof startCondition.icon === "object"
      ? (startCondition.icon as { tintColor: Color.ColorLike }).tintColor
      : "PrimaryText",
  );
  const [iconColorError, setIconColorError] = useState("");

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
      title: `${changedValues.nickname} updated!`,
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
      {startCondition.type !== "app" ? (
        <Form.TextField
          id="defaultName"
          title="Base Name"
          defaultValue={startCondition.defaultName}
          onChange={(value) => setChangedValues({ ...changedValues, defaultName: value })}
        />
      ) : (
        <Form.Description text={startCondition.defaultName} />
      )}

      <Form.TextField
        id="name"
        title="Nickname"
        defaultValue={startCondition.name}
        onChange={(value) => setChangedValues({ ...changedValues, nickname: value })}
        autoFocus
      />

      {startCondition.type === "directory" && (
        <Form.FilePicker
          id="newPath"
          title="File path"
          value={[changedValues.sourcePath || startCondition.path]}
          onChange={(value) => setChangedValues({ ...changedValues, sourcePath: value[0] })}
          allowMultipleSelection={false}
          canChooseDirectories
        />
      )}
      {startCondition.type === "website" && (
        <Form.TextField
          id="newWebsite"
          title="Website"
          onChange={(value) => setChangedValues({ ...changedValues, sourcePath: value })}
          value={changedValues.sourcePath || startCondition.path}
        />
      )}
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
        <>
          <Form.Dropdown
            id="raycastIcon"
            title="Raycast Icon"
            onChange={(icon: string) => {
              setError("");
              setChangedValues({
                ...changedValues,
                icon: {
                  source: icon,
                  tintColor: iconColor,
                },
              });
            }}
            defaultValue={(startCondition.icon as { source: string }).source}
            error={error}
          >
            {Object.entries(Icon).map(([name, icon]) => (
              <Form.Dropdown.Item
                key={name}
                value={icon}
                title={name}
                icon={{
                  source: icon,
                  tintColor: iconColor,
                }}
              />
            ))}
          </Form.Dropdown>
          <Form.TextField
            id="iconColor"
            title="Icon Color"
            info="Color can be any kind of valid CSS color (rgb, hex, name, etc.)"
            onChange={(color: string) => {
              console.log("[color]", color);
              setIconColor(color);
              setIconColorError(!validColor(color) ? "Invalid color!" : "");
              setChangedValues({
                ...changedValues,
                icon: {
                  source: justIcon(changedValues.icon) as string,
                  tintColor: color,
                },
              });
            }}
            value={iconColor as string}
            error={iconColorError}
          />
        </>
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
            <Form.Dropdown.Item key={opener.path} value={opener.name} title={opener.name} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}
