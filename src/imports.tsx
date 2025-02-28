import { Icon, Keyboard } from "@raycast/api";
import { exec } from "child_process";
import fs, { readdirSync } from "fs";
import { promisify } from "util";
import RenameItem from "./RenameItem";

export async function runTerminalCommand(command: string) {
  const { stdout, stderr } = await promisify(exec)(command);
  return { stdout, stderr };
}

export async function asyncGetAppIcon({ appPath, appName }: { appPath: string; appName: string }): Promise<string> {
  const swiftPath = "/Users/miles/Code Projects/Personal/Raycast Commands/Extensions/app-search/src/GetAppIcons.swift";
  const destinationPath = `/Users/miles/Code Projects/Personal/Raycast Commands/Extensions/app-search/Cached App Icons/${appName}.png`;

  // Check if the destination path already exists
  if (fs.existsSync(destinationPath)) {
    return destinationPath;
  }

  const resourcesPath = `${appPath}/Contents/Resources`;
  try {
    const iconFilePath = `${resourcesPath}/Icons'\r'`;
    if (!fs.existsSync(iconFilePath)) {
      const iconFile = readdirSync(resourcesPath).find((file) => file.endsWith(".icns"));
      return iconFile ? `${resourcesPath}/${iconFile}` : Icon.AppWindow;
    }
  } catch {}

  return new Promise((resolve, reject) => {
    exec(`swift "${swiftPath}" "${appPath}" "${destinationPath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(`Error extracting icon: ${stderr || error.message}`);
      } else {
        const filePath = `${destinationPath}`;
        const exists = fs.existsSync(filePath);
        console.log(`Does "${filePath}" exist?`, exists);
        if (exists) {
          resolve(filePath);
        } else {
          reject("Failed to find the extracted icon.");
        }
      }
    });
  });
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
  iconPath: string;
}

async function getRunningApps(): Promise<string[]> {
  try {
    const { stdout } = await runTerminalCommand("ps aux | grep -i '.app'");
    const runningApps = stdout
      .split("\n")
      .filter((line) => line.includes(".app/") && line.includes("Contents/MacOS/"))
      .map((line) => {
        const appName = line.substring(0, line.indexOf(".app/"));
        return appName.substring(appName.lastIndexOf("/") + 1);
      })
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
