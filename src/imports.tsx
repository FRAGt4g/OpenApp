import { Image, Keyboard } from "@raycast/api";
import { exec } from "child_process";
import fs, { readdirSync } from "fs";
import { promisify } from "util";
import RenameItem from "./RenameItem";

const ROOT_PATH = "/Users/miles/Code Projects/Personal/Raycast Commands/Extensions/app-search";

export async function runTerminalCommand(command: string) {
  const { stdout, stderr } = await promisify(exec)(command);
  return { stdout, stderr };
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

export async function asyncGetAppIcon({
  appName,
  appPath,
  checkCache = false,
}: {
  appName: string;
  appPath: string;
  checkCache?: boolean;
}): Promise<string> {
  const brokenIconNames: Record<string, string> = {
    Arc: "Arc Browser",
  };
  appName = brokenIconNames[appName] ?? appName;

  const destinationPath = `${ROOT_PATH}/Cached App Icons/${appName}`;
  const specialCases = ["Books"];

  function runSwiftCommand(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Otherwise, extract the icon from the app
      const swiftPath = `${ROOT_PATH}/src/Scripts/GetAppIcons.swift`;
      exec(`swift "${swiftPath}" "${appPath}" "${destinationPath + ".png"}"`, (error, stdout, stderr) => {
        if (error) {
          reject(`Error extracting icon: ${stderr || error.message}`);
        } else {
          const exists = fs.existsSync(destinationPath + ".png");
          if (exists) {
            resolve(destinationPath + ".png");
          } else {
            reject("Failed to find the extracted icon.");
          }
        }
      });
    });
  }

  if (specialCases.includes(appName)) {
    return await runSwiftCommand();
  }

  // Load from cached icons if available
  if (checkCache && fs.existsSync(destinationPath + ".png")) {
    // specialPrint(`${appName} has a cached icon file, using ${destinationPath + ".png"}`);
    return destinationPath + ".png";
  }

  const resourcesPath = `${appPath}/Contents/Resources`;
  try {
    // If the app has an Icon? file, use that
    const customIconFileExists = fs.existsSync(`${appPath}/Icon\r`);
    if (customIconFileExists) {
      const { stdout: binaryData, stderr } = await runTerminalCommand(`cp ${appPath}/Icon?/..namedfork/rsrc`);
      if (stderr) {
        console.error("Error copying icon:", stderr);
      }

      const iconBuffer = Buffer.from(binaryData, "utf-8").subarray(260); // Convert to Buffer and use subarray
      fs.writeFileSync(destinationPath + ".icns", iconBuffer.toString("base64")); // Ensure it's a Buffer
      // specialPrint(`${appName} has a custom Icon? file, using ${destinationPath + ".icns"}`);
      return destinationPath + ".icns";
    }
    // If the app has no Icon? file, use the first .icns file in the Resources folder
    else {
      const iconFiles = readdirSync(resourcesPath).filter((file) => file.endsWith(".icns"));
      // specialPrint(`${appName} has ${iconFiles.length} icns files in ${resourcesPath}`);
      if (iconFiles.length > 1) {
        //search plist.info for CFBundleIconFile
        const plistInfo = fs.readFileSync(`${appPath}/Contents/Info.plist`, "utf-8");
        const iconFile =
          plistInfo
            .match(/<key>CFBundleIconFile<\/key>\s*<string>(.*?)<\/string>/)?.[1]
            ?.trim()
            .replace(/\.icns$/, "") + ".icns"; // Ensure that the name always ends with .icns exactly once
        // specialPrint(`${appName} ${iconFile ? "has" : "does not have"} a plist file at ${appPath}/Contents/Info.plist`);
        if (iconFile) {
          // specialPrint(`${appName} has a custom icon file at ${resourcesPath}/${iconFile}`);
          return `${resourcesPath}/${iconFile}`;
        }
      } else if (iconFiles.length == 1) {
        const iconFile = iconFiles[0];
        // specialPrint(`${appName} has a default icns file at ${resourcesPath}/${iconFile}`);
        return `${resourcesPath}/${iconFile}`;
      }
    }
  } catch (error) {
    // Do nothing. If there is an error, use next method to get icon
  }

  // specialPrint(`${appName} has no custom icon file, making icon from swift file`);
  return await runSwiftCommand();
}

type ToggleableAppPreferences =
  | "pinnedApps"
  | "hidden"
  | "appsWithoutRunningCheck"
  | "prioritizeRunningApps"
  | "showHidden";

type SortType = "frecency" | "alphabetical" | "custom";

interface AppPreferences {
  sortType: SortType;
  websites: Openable[];

  quickCommands: Record<string, { modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent }>;
  cachedIconDirectories: Record<string, { default: Image.ImageLike; custom: Image.ImageLike | null }>;
  customNames: Record<string, string>;
  appImportance: Record<string, number>;

  appsWithoutRunningCheck: string[];
  pinnedApps: string[];
  hidden: string[];

  prioritizeRunningApps: boolean;
  showWebsites: boolean;
  showHidden: boolean;
}

const defaultPreferences: AppPreferences = {
  sortType: "frecency",
  websites: [],

  quickCommands: {},
  cachedIconDirectories: {},
  customNames: {},
  appImportance: {},

  appsWithoutRunningCheck: [],
  pinnedApps: [],
  hidden: [],

  prioritizeRunningApps: true,
  showWebsites: true,
  showHidden: false,
};

interface HitHistory {
  [key: string]: string[];
}

interface Openable {
  type: "app" | "website";
  icon: Image.ImageLike;
  running: boolean;
  name: string;
  path: string;
  id: string;
}

interface DeepSettings {
  fuzzySearchThresholdDropdown: string;
  showSortOptions: boolean;
  lambdaDecayDropdown: string;
  timeScaleDropdown: string;
  fastMode: boolean;
}

export { defaultPreferences, getRunningApps, RenameItem };
export type { AppPreferences, DeepSettings, HitHistory, Openable, SortType, ToggleableAppPreferences };
