import { Icon, Keyboard } from "@raycast/api";
import { exec } from "child_process";
import { readdirSync } from "fs";
import { promisify } from "util";
import RenameItem from "./RenameItem";

export async function runTerminalCommand(command: string) {
  const { stdout, stderr } = await promisify(exec)(command);
  return { stdout, stderr };
}

export function getAppIcon(app: Application): string | Icon {
  if (!app?.path) return "";

  const resourcesPath = `${app.path}/Contents/Resources`;
  try {
    const iconFile = readdirSync(resourcesPath).find((file) => file.endsWith(".icns"));
    return iconFile ? `${resourcesPath}/${iconFile}` : Icon.AppWindow;
  } catch {
    return Icon.AppWindow;
  }
}

type ToggleableAppPreferences =
  | "pinnedApps"
  | "hidden"
  | "appsWithoutRunningCheck"
  | "prioritizeRunningApps"
  | "showHidden";

interface AppPreferences {
  hidden: string[];
  customNames: Record<string, string>;
  pinnedApps: string[];
  appImportance: Record<string, number>;
  showHidden: boolean;
  quickCommands: Record<string, { modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent }>;
  prioritizeRunningApps: boolean;
  sortType: "frecency" | "alphabetical" | "custom";
  appsWithoutRunningCheck: string[];
}

interface HitHistory {
  [key: string]: string[];
}

interface Application {
  bundleId: string;
  name: string;
  path: string;
  running: boolean;
}

async function getRunningApps(): Promise<string[]> {
  try {
    const { stdout } = await runTerminalCommand("ps aux | grep -i '.app'");
    const runningApps = stdout
      .split("\n")
      .filter((line) => line.includes(".app") && line.includes("Contents/MacOS/"))
      .map((line) =>
        line.substring(line.indexOf("Applications/") + 13, line.indexOf("/", line.indexOf("Applications/") + 13) - 4),
      )
      .filter((app) => !app.includes("??"))
      .filter((app, index, self) => self.indexOf(app) === index);

    return runningApps;
  } catch (error) {
    console.error("Error fetching running applications:", error);
    return [];
  }
}

export { getRunningApps, RenameItem };
export type { Application, AppPreferences, HitHistory, ToggleableAppPreferences };
