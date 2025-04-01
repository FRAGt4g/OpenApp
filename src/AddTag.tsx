import { Action, ActionPanel, Color, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import crypto from "crypto";
import { useState } from "react";
import { isEmoji, Tag } from "./imports";

const defaultTag: Tag = { title: "", icon: Icon.Hashtag, color: Color.PrimaryText };

const AddTag = (props: { onSubmit: (tag: Tag) => void }) => {
  const { onSubmit } = props;
  const { pop } = useNavigation();
  const [newTag, setNewTag] = useState<Tag>(defaultTag);
  const [newTagIconType, setNewTagIconType] = useState<"raycast" | "emoji">("raycast");
  const [error, setError] = useState("");
  function prettyName(color: keyof typeof Color): string {
    if (color === "SecondaryText") return "Gray";
    if (color === "PrimaryText") return "White";
    return color;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Add Tag"
            onSubmit={() => {
              setNewTag(defaultTag);
              showToast({
                title: "Tag Added!",
                style: Toast.Style.Success,
              });
              onSubmit(newTag);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Create a new tag!" />
      <Form.TextField
        id="tagTitle"
        title="Title of Tag"
        placeholder="Enter the title for the tag"
        value={newTag.title ?? ""}
        onChange={(value) => setNewTag({ ...newTag, title: value })}
      />
      <Form.Dropdown
        id="newTagIconType"
        title="Raycast Icon or Emoji"
        onChange={(value) => setNewTagIconType(value as "raycast" | "emoji")}
      >
        <Form.Dropdown.Item
          key={crypto.randomUUID()}
          value={"raycast"}
          title="Raycast Icon"
          icon={Icon.RaycastLogoNeg}
        />
        <Form.Dropdown.Item key={crypto.randomUUID()} value={"emoji"} title="Emoji" icon={"📝"} />
      </Form.Dropdown>
      <Form.Separator />
      {newTagIconType === "raycast" ? (
        <>
          <Form.Dropdown
            id="newTagIcon"
            title="Icon"
            onChange={(icon: string) => {
              setNewTag({ ...newTag, icon: icon as Icon });
            }}
            value={newTag.icon?.toString() ?? ""}
          >
            {Object.keys(Icon).map((icon) => (
              <Form.Dropdown.Item
                key={crypto.randomUUID()}
                value={Icon[icon as keyof typeof Icon].toString()}
                title={icon.replace(/([A-Z])/g, " $1").trim()}
                icon={{ source: Icon[icon as keyof typeof Icon], tintColor: newTag?.color ?? Color.Blue }}
              />
            ))}
          </Form.Dropdown>
          <Form.Dropdown
            id="newTagColor"
            title="Color"
            onChange={(color) => setNewTag({ ...newTag, color: color as Color.ColorLike })}
            value={newTag.color?.toString() ?? ""}
          >
            {Object.keys(Color).map((color) => (
              <Form.Dropdown.Item
                key={crypto.randomUUID()}
                value={Color[color as keyof typeof Color].toString()}
                title={prettyName(color as keyof typeof Color)}
                icon={{ source: Icon.CircleFilled, tintColor: Color[color as keyof typeof Color] }}
              />
            ))}
          </Form.Dropdown>
        </>
      ) : (
        <Form.TextField
          id="emoji"
          title="Emoji"
          onChange={(input) => {
            if (input.length !== 2 || !isEmoji(input)) {
              setError("Can only be one emoji!");
              return;
            }
            setError("");
          }}
          placeholder="One Emoji"
          autoFocus
          error={error}
        />
      )}
    </Form>
  );
};

export default AddTag;
