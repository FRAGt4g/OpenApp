import { Action, ActionPanel, Color, Form, Icon, Image, showToast, Toast, useNavigation } from "@raycast/api";
import crypto from "crypto";
import { useEffect, useMemo, useState } from "react";
import { Tag } from "./imports";

const defaultTag: Tag = { title: "", icon: Icon.Hashtag, color: Color.PrimaryText };

type IdTag = {
  id: string;
  tag: Tag;
};

const EditTags = (props: { currentTags: Tag[]; onSubmit: (tags: Tag[]) => void }) => {
  const { currentTags, onSubmit } = props;
  const { pop } = useNavigation();
  const [tags, setTags] = useState<IdTag[]>(currentTags.map((tag) => ({ id: crypto.randomUUID(), tag })));
  const [newTag, setNewTag] = useState<Tag>(defaultTag);
  const [selectedTagID, setSelectedTagID] = useState<string>();

  const selectedTag = useMemo(() => tags.find((tag) => tag.id === selectedTagID)?.tag, [tags, selectedTagID]);

  // Update tags array when selectedTag changes
  useEffect(() => {
    if (selectedTagID) {
      setTags(tags.map((tag) => (tag.id === selectedTagID ? ({ id: tag.id, tag: selectedTag } as IdTag) : tag)));
    }
  }, [selectedTagID]);

  function updateSelectedTag(passed: { title?: string; icon?: Image.ImageLike; color?: Color.ColorLike }) {
    setTags(tags.map((t) => (t.id === selectedTagID ? ({ id: t.id, tag: { ...t.tag, ...passed } } as IdTag) : t)));
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Update Tags"
            onSubmit={() => {
              setTags([...tags, { id: crypto.randomUUID(), tag: newTag } as IdTag]);
              setNewTag(defaultTag);
              showToast({
                title: `Tags Updated!`,
                style: Toast.Style.Success,
              });
              onSubmit(tags.map((tag) => tag.tag));
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Choose a tag to edit" />
      <Form.Dropdown
        id="existingTag"
        title="Current Tags"
        onChange={(value) => setSelectedTagID(tags.find((tag) => tag.tag.title === value)?.id)}
      >
        {tags.map((tag) => (
          <Form.Dropdown.Item key={tag.id} title={tag.tag.title ?? ""} value={tag.tag.title ?? ""} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      {selectedTagID && (
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
            value={selectedTag?.icon.toString()}
            onChange={(value) => updateSelectedTag({ icon: value as Image.ImageLike })}
          />
          <Form.Dropdown
            id="selectedTagColor"
            title="Color"
            value={selectedTag?.color.toString()}
            onChange={(value) => updateSelectedTag({ color: value as Color.ColorLike })}
          />
        </>
      )}
    </Form>
  );
};

export default EditTags;
