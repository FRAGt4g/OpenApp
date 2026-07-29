import { Color, Image, Keyboard } from "@raycast/api";
import { exec } from "child_process";
import fs, { readdirSync } from "fs";
import { promisify } from "util";
import { PathType } from "./types";

const MODIFIER_SYMBOLS: Record<Keyboard.KeyModifier, string> = {
  cmd: "⌘",
  ctrl: "⌃",
  opt: "⌥",
  shift: "⇧",
};

const KEY_SYMBOLS: Partial<Record<Keyboard.KeyEquivalent, string>> = {
  return: "↵",
  enter: "↵",
  delete: "⌫",
  deleteForward: "⌦",
  tab: "⇥",
  space: "␣",
  escape: "⎋",
  arrowUp: "↑",
  arrowDown: "↓",
  arrowLeft: "←",
  arrowRight: "→",
  pageUp: "⇞",
  pageDown: "⇟",
  home: "↖",
  end: "↘",
};

/** Render a keyboard shortcut as a compact, mac-style symbol string (e.g. "⌘⇧A"). */
export function formatKeybind(shortcut: Keyboard.Shortcut): string {
  const mods = shortcut.modifiers.map((modifier) => MODIFIER_SYMBOLS[modifier] ?? modifier).join("");
  const key = KEY_SYMBOLS[shortcut.key] ?? shortcut.key.toUpperCase();
  return `${mods}${key}`;
}

const ROOT_PATH = "/Users/miles/Code_Projects/Personal/Raycast Commands/Extensions/app-search";

export async function runTerminalCommand(command: string) {
  const { stdout, stderr } = await promisify(exec)(command);
  return { stdout, stderr };
}

export async function getRunningApps(): Promise<Set<string>> {
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

    return new Set(runningApps);
  } catch (error) {
    console.error("Error fetching running applications:", error);
    return new Set();
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
  const specialPrint = (input: string) => {
    const condition = appName.includes("Band");
    if (condition) console.log(input);
  };
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
    specialPrint(`${appName} has a cached icon file, using ${destinationPath + ".png"}`);
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
      specialPrint(`${appName} has a custom Icon? file, using ${destinationPath + ".icns"}`);
      return destinationPath + ".icns";
    }
    // If the app has no Icon? file, use the first .icns file in the Resources folder
    else {
      const iconFiles = readdirSync(resourcesPath).filter((file) => file.endsWith(".icns"));
      specialPrint(`${appName} has ${iconFiles.length} icns files in ${resourcesPath}`);
      if (iconFiles.length > 1) {
        //search plist.info for CFBundleIconFile
        const plistInfo = fs.readFileSync(`${appPath}/Contents/Info.plist`, "utf-8");
        const iconFile =
          plistInfo
            .match(/<key>CFBundleIconFile<\/key>\s*<string>(.*?)<\/string>/)?.[1]
            ?.trim()
            .replace(/\.icns$/, "") + ".icns"; // Ensure that the name always ends with .icns exactly once
        specialPrint(
          `${appName} ${iconFile !== "undefined.icns" ? "has" : "does not have"} a plist file at ${appPath}/Contents/Info.plist (${iconFile})`,
        );
        if (iconFile !== "undefined.icns") {
          specialPrint(`${appName} has a custom icon file at ${resourcesPath}/${iconFile}`);
          return `${resourcesPath}/${iconFile}`;
        }
      } else if (iconFiles.length == 1) {
        const iconFile = iconFiles[0];
        specialPrint(`${appName} has a default icns file at ${resourcesPath}/${iconFile}`);
        return `${resourcesPath}/${iconFile}`;
      }
    }
  } catch (error) {
    // Do nothing. If there is an error, use next method to get icon
  }

  specialPrint(`${appName} has no custom icon file, making icon from swift file`);
  return await runSwiftCommand();
}

export function isEmoji(text: string): boolean {
  return /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/.test(text);
}

export async function isValidUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });

    if (!res.ok) return false;

    return res.headers.get("Content-Type")?.startsWith("image") ?? false;
  } catch (error) {
    return false;
  }
}

export function isValidFileType(file: string) {
  const validFileTypes = [".png", "Icon?", ".icns"];
  return validFileTypes.some((value) => file.endsWith(value));
}

export function looksLikeFilePath(text: string): boolean {
  return /^(\/|~\/|[a-zA-Z]:\\|\.\/|\.\.\/)/.test(text);
}

export function getIconType(icon: Image.ImageLike): PathType {
  if (typeof icon !== "string") {
    return "Raycast Icon";
  }
  const iconString = icon as string;
  if (iconString?.startsWith("https://")) {
    return "Url";
  }
  if (isEmoji(iconString)) {
    return "Emoji";
  }
  if (looksLikeFilePath(iconString)) {
    return "File Path";
  }
  return "Raycast Icon";
}

export function getNumberOfMilliseconds(
  count: number,
  timeScale: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years",
) {
  switch (timeScale) {
    case "seconds":
      return count * 1000;
    case "minutes":
      return count * 60 * 1000;
    case "hours":
      return count * 60 * 60 * 1000;
    case "days":
      return count * 24 * 60 * 60 * 1000;
    case "weeks":
      return count * 7 * 24 * 60 * 60 * 1000;
    case "months":
      return count * 30 * 24 * 60 * 60 * 1000;
    case "years":
      return count * 365 * 24 * 60 * 60 * 1000;
  }
}

export function justIcon(icon: Image.ImageLike | undefined | null): string | undefined | null {
  if (!icon) return undefined;

  if (typeof icon === "object") {
    return (icon as { source: string }).source;
  }
  return icon;
}

export function validColor(color: string | Color.ColorLike): boolean {
  // HEX: #RRGGBB or #RGB
  const hexRegex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

  // RGB: rgb(255, 0, 0)
  const rgbRegex = /^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i;

  // RGBA: rgba(255,0,0,1) or rgb(255,0,0,1.0)
  const rgbaRegex = /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

  // HSL/HSLA: hsl(120,60%,50%) or hsla(120,60%,50%,0.5)
  const hslRegex = /^hsla?\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

  // Keywords: CSS color names (subset of 140 named colors)
  const cssKeywords = [
    "black",
    "silver",
    "gray",
    "white",
    "maroon",
    "red",
    "purple",
    "fuchsia",
    "green",
    "lime",
    "olive",
    "yellow",
    "navy",
    "blue",
    "teal",
    "aqua",
    "orange",
    "aliceblue",
    "antiquewhite",
    "aquamarine",
    "azure",
    "beige",
    "bisque",
    "blanchedalmond",
    "blueviolet",
    "brown",
    "burlywood",
    "cadetblue",
    "chartreuse",
    "chocolate",
    "coral",
    "cornflowerblue",
    "cornsilk",
    "crimson",
    "cyan",
    "darkblue",
    "darkcyan",
    "darkgoldenrod",
    "darkgray",
    "darkgreen",
    "darkgrey",
    "darkkhaki",
    "darkmagenta",
    "darkolivegreen",
    "darkorange",
    "darkorchid",
    "darkred",
    "darksalmon",
    "darkseagreen",
    "darkslateblue",
    "darkslategray",
    "darkslategrey",
    "darkturquoise",
    "darkviolet",
    "deeppink",
    "deepskyblue",
    "dimgray",
    "dimgrey",
    "dodgerblue",
    "firebrick",
    "floralwhite",
    "forestgreen",
    "gainsboro",
    "ghostwhite",
    "gold",
    "goldenrod",
    "greenyellow",
    "grey",
    "honeydew",
    "hotpink",
    "indianred",
    "indigo",
    "ivory",
    "khaki",
    "lavender",
    "lavenderblush",
    "lawngreen",
    "lemonchiffon",
    "lightblue",
    "lightcoral",
    "lightcyan",
    "lightgoldenrodyellow",
    "lightgray",
    "lightgreen",
    "lightgrey",
    "lightpink",
    "lightsalmon",
    "lightseagreen",
    "lightskyblue",
    "lightslategray",
    "lightslategrey",
    "lightsteelblue",
    "lightyellow",
    "limegreen",
    "linen",
    "magenta",
    "mediumaquamarine",
    "mediumblue",
    "mediumorchid",
    "mediumpurple",
    "mediumseagreen",
    "mediumslateblue",
    "mediumspringgreen",
    "mediumturquoise",
    "mediumvioletred",
    "midnightblue",
    "mintcream",
    "mistyrose",
    "moccasin",
    "navajowhite",
    "oldlace",
    "olivedrab",
    "orangered",
    "orchid",
    "palegoldenrod",
    "palegreen",
    "paleturquoise",
    "palevioletred",
    "papayawhip",
    "peachpuff",
    "peru",
    "pink",
    "plum",
    "powderblue",
    "rosybrown",
    "royalblue",
    "saddlebrown",
    "salmon",
    "sandybrown",
    "seagreen",
    "seashell",
    "sienna",
    "skyblue",
    "slateblue",
    "slategray",
    "slategrey",
    "snow",
    "springgreen",
    "steelblue",
    "tan",
    "thistle",
    "tomato",
    "turquoise",
    "violet",
    "wheat",
    "whitesmoke",
    "yellowgreen",
    "rebeccapurple",
  ];

  if (
    typeof color === "string" &&
    (hexRegex.test(color) ||
      rgbRegex.test(color) ||
      rgbaRegex.test(color) ||
      hslRegex.test(color) ||
      cssKeywords.includes(color.toLowerCase()) ||
      Object.entries(Color).some((c) => c[0] === color))
  ) {
    return true;
  }
  return false;
}
