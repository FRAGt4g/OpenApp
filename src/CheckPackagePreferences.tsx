import { AppPreferences } from "./imports";

export default function CheckPackagePreferences(props: {
  item: { id: string; name: string };
}): { preferences: AppPreferences } | { errorView: JSX.Element } {}
