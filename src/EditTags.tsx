import { Action, ActionPanel, Color, Form, Icon, Image, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { Tag } from "./imports";

const defaultTag: Tag = { title: "", icon: Icon.Hashtag, color: "#333333" };

const EditTags = (props: { currentTags: Tag[]; onSubmit: (tags: Tag[]) => void }) => {
  const { currentTags, onSubmit } = props;
  const { pop } = useNavigation();
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [selectedTagTitle, setSelectedTagTitle] = useState<string>();
  const [beingEditedTag, setBeingEditedTag] = useState<Tag>(defaultTag);

  function updateSelectedTag(passed: { title?: string; icon?: Image.ImageLike; color?: Color.ColorLike }) {
    setTags(tags.map((t) => (t.title === selectedTagTitle ? { ...t, ...passed } : t)));
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Update Tags"
            onSubmit={() => {
              setTags([...tags, beingEditedTag]);
              setBeingEditedTag(defaultTag);
              showToast({
                title: `Tags Updated!`,
                style: Toast.Style.Success,
              });
              onSubmit(tags);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Choose a tag to edit" />
      <Form.Dropdown id="existingTag" title="Current Tags" onChange={(value) => setSelectedTagTitle(value)}>
        {tags.map((tag) => (
          <Form.Dropdown.Item key={tag.title} title={tag.title ?? ""} value={tag.title ?? ""} icon={tag.icon} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      {selectedTagTitle && (
        <>
          <Form.TextField
            id="selectedTagTitle"
            title="Title"
            value={selectedTag?.title}
            onChange={(value) => updateSelectedTag({ title: value })}
          />
          <Form.Dropdown
            id="selectedTagIcon"
            title="Icon"
            // value={selectedTag?.icon.toString()}
            onChange={(value) => updateSelectedTag({ icon: value as Image.ImageLike })}
          />
          <Form.Dropdown
            id="selectedTagColor"
            title="Color"
            // value={selectedTag?.color.toString()}
            onChange={(value) => updateSelectedTag({ color: value as Color.ColorLike })}
          />
        </>
      )}
    </Form>
  );
};

export default EditTags;
