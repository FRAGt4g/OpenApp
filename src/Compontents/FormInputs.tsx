import { Form, Icon } from "@raycast/api";
import { isValidFileType, isValidUrl } from "../imports";

export function RaycastIconDropDown(props: {
  id: string;
  title: string;
  onChange: (icon: string) => void;
  defaultValue: string;
  error: string;
}) {
  return (
    <Form.Dropdown
      id={props.id}
      title={props.title}
      onChange={(icon: string) => {
        props.onChange(icon);
      }}
      defaultValue={props.defaultValue}
      error={props.error}
    >
      {Object.keys(Icon).map((icon) => (
        <Form.Dropdown.Item key={icon} value={icon} title={icon} icon={Icon[icon as keyof typeof Icon]} />
      ))}
    </Form.Dropdown>
  );
}

export function UrlToImageValidationInput(props: {
  id: string;
  title: string;
  onChange: (url: string) => void;
  defaultValue: string;
  error: string;
  setError: (error: string) => void;
}) {
  return (
    <Form.TextField
      id={props.id}
      title={props.title}
      error={props.error}
      onChange={async (newUrl) => {
        if (newUrl == "") return;
        if (!(await isValidUrl(newUrl))) {
          props.setError("Must be a valid url that returns a picture!");
          return;
        }
        props.setError("");
        props.onChange(newUrl);
      }}
      placeholder="https://example.com/icon.png"
      defaultValue={props.defaultValue}
    />
  );
}

export function FileInput(props: {
  id: string;
  title: string;
  onChange: (file: string) => void;
  defaultValue: string;
  error: string;
  setError: (error: string) => void;
}) {
  return (
    <Form.FilePicker
      id={props.id}
      title={props.title}
      error={props.error}
      showHiddenFiles={true}
      allowMultipleSelection={false}
      canChooseDirectories={false}
      onChange={(files: string[]) => {
        if (files.length == 0) {
          props.setError("");
          return;
        }
        const file = files[0];
        if (!isValidFileType(file)) {
          props.setError(`Must be a valid file type (.icns, Icon?, .png) ${file}`);
          return;
        }
        props.setError("");
        props.onChange(file);
      }}
      autoFocus
      defaultValue={[props.defaultValue]}
    />
  );
}
