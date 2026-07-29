import { Color, Icon, Image, Keyboard } from "@raycast/api";

export interface HitHistory {
  [key: string]: string[];
}

export type Tag = {
  title: string;
  icon: Icon;
  color: Color.ColorLike;
};

export type OpenableOrigin = "app" | "website" | "directory";
export type OpenableFilter = OpenableOrigin | "all";

export interface Openable {
  type: OpenableOrigin;
  icon: Image.ImageLike;
  running: boolean;
  name: string;
  path: string;
  id: string;
}

export interface DeepSettings {
  fuzzySearchThresholdDropdown: string;
  showSortOptions: boolean;
  lambdaDecayDropdown: string;
  timeScaleDropdown: string;
  fastMode: boolean;
  showBoltIconForRunningApps: boolean;
  showPinIconForPinnedApps: boolean;
  showEyeIconForHiddenApps: boolean;
  showIdentifierForWebsitesAndDirectories: boolean;
  showKeybindForApps: boolean;
}

export type ToggleableAppPreferences =
  | "pinnedApps"
  | "hidden"
  | "appsWithoutRunningCheck"
  | "prioritizeRunningApps"
  | "showHidden";

export type SortType = "frecency" | "alphabetical" | "custom";

export interface AppPreferences {
  sortType: SortType;

  quickCommands: Record<string, { modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent }>;
  cachedIconDirectories: Record<string, { default: Image.ImageLike; custom: Image.ImageLike | null }>;
  customNames: Record<string, string>;
  appImportance: Record<string, number>;
  appTags: Record<string, string[]>;

  appsWithoutRunningCheck: string[];
  pinnedApps: string[];
  hidden: string[];

  prioritizeRunningApps: boolean;
  showWebsites: boolean;
  showHidden: boolean;

  customDirectoryOpeners: Record<string, string>;
}

export const defaultPreferences: AppPreferences = {
  sortType: "frecency",

  quickCommands: {},
  cachedIconDirectories: {},
  customNames: {},
  appImportance: {},
  appTags: {},

  appsWithoutRunningCheck: [],
  pinnedApps: [],
  hidden: [],

  prioritizeRunningApps: true,
  showWebsites: true,
  showHidden: false,

  customDirectoryOpeners: {},
};

export const pathTypes = ["Emoji", "File Path", "Url", "Raycast Icon"] as const;
export type PathType = (typeof pathTypes)[number];
