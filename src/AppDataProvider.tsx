import { getApplications, getPreferenceValues as getSettings, LocalStorage } from "@raycast/api";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { asyncGetAppIcon, getNumberOfMilliseconds, getRunningApps } from "./imports";
import {
  AppPreferences,
  DeepSettings,
  defaultPreferences,
  HitHistory,
  Openable,
  ToggleableAppPreferences,
} from "./types";

const FARTHEST_BACK_HIT_DATE = getNumberOfMilliseconds(30, "days");

type AppDataContextType = {
  settings: DeepSettings;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  preferences: AppPreferences;
  setPreferences: (preferences: AppPreferences) => void;
  applications: Openable[];
  setApplications: (applications: Openable[]) => void;
  websites: Openable[];
  setWebsites: (websites: Openable[]) => void;
  directories: Openable[];
  setDirectories: (directories: Openable[]) => void;
  hitHistory: HitHistory;
  setHitHistory: (hitHistory: HitHistory) => void;
  setAppRunningStatus: (app: Openable, running: boolean) => void;
  incrementFrecency: (app: Openable) => void;
  toggleShowingHiddenOpenables: () => Promise<void>;
  togglePrioritizeRunningApps: () => Promise<void>;
  toggle: (type: ToggleableAppPreferences, bundleId: string) => Promise<void>;
  getOpeners: (app: Openable) => ReturnType<typeof getApplications>;
};

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const settings = getSettings<DeepSettings>();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [applications, setApplications] = useState<Openable[]>([]);
  const [websites, setWebsites] = useState<Openable[]>([]);
  const [directories, setDirectories] = useState<Openable[]>([]);
  const [hitHistory, setHitHistory] = useState<HitHistory>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initApp() {
      let parsedWebsites: Openable[] = [];
      let parsedDirectories: Openable[] = [];

      const [unparsedHitHistoryJSON, unparsedPreferencesJSON, unparsedWebsitesJSON, unparsedDirectoriesJSON, apps] =
        await Promise.all([
          LocalStorage.getItem<string>("hitHistory"),
          LocalStorage.getItem<string>("appPreferences"),
          LocalStorage.getItem<string>("websites"),
          LocalStorage.getItem<string>("directories"),
          getApplications().then((a) => a.filter((x) => x && x.bundleId)),
        ]);

      if (unparsedWebsitesJSON) {
        try {
          parsedWebsites = JSON.parse(unparsedWebsitesJSON) as Openable[];
          setWebsites(parsedWebsites);
        } catch (error) {
          console.error("Error loading websites:", error);
        }
      }

      if (unparsedDirectoriesJSON) {
        try {
          parsedDirectories = JSON.parse(unparsedDirectoriesJSON);
          setDirectories(parsedDirectories);
        } catch (error) {
          console.error("Error loading directories:", error);
        }
      }

      if (unparsedHitHistoryJSON) {
        try {
          const parsedHitHistory: HitHistory = JSON.parse(unparsedHitHistoryJSON);
          const cutoff = new Date(new Date().getTime() - FARTHEST_BACK_HIT_DATE);

          const purgedHitHistory: HitHistory = {};
          for (const hitHistoryItem of Object.entries(parsedHitHistory)) {
            const [appId, timestamps] = hitHistoryItem;
            const newTimestamps = timestamps.filter((timestamp) => new Date(timestamp) > cutoff);
            if (newTimestamps.length > 0) {
              purgedHitHistory[appId] = newTimestamps;
            }
          }

          LocalStorage.setItem("hitHistory", JSON.stringify(purgedHitHistory));
          setHitHistory(purgedHitHistory);
        } catch (error) {
          console.error("Error loading hit history:", error);
        }
      } else {
        setHitHistory({});
      }

      let soonToBePreferences: AppPreferences = defaultPreferences;
      if (unparsedPreferencesJSON) {
        try {
          const parsedPreferences = JSON.parse(unparsedPreferencesJSON);
          soonToBePreferences = Object.fromEntries(
            Object.keys(defaultPreferences).map((key) => [
              key,
              parsedPreferences[key] ?? defaultPreferences[key as keyof AppPreferences],
            ]),
          ) as AppPreferences;
          setPreferences(soonToBePreferences);
          await LocalStorage.setItem("appPreferences", JSON.stringify(soonToBePreferences));
        } catch (error) {
          console.error("Error loading preferences:", error);
        }
      }

      try {
        const runningApps = !settings.fastMode ? await getRunningApps() : new Set();
        const imagePaths = soonToBePreferences.cachedIconDirectories;
        if (!settings.fastMode) {
          for (const app of apps) {
            if (!imagePaths[app.bundleId!]) {
              const iconPath = await asyncGetAppIcon({
                appName: app.path.split("/").pop()!.replace(".app", ""),
                appPath: app.path,
              });
              imagePaths[app.bundleId!] = { default: iconPath, custom: null };
            }
          }
        }
        setPreferences({ ...soonToBePreferences, cachedIconDirectories: imagePaths });
        await LocalStorage.setItem(
          "appPreferences",
          JSON.stringify({ ...soonToBePreferences, cachedIconDirectories: imagePaths }),
        );
        const cleanedApplications: Openable[] = apps.map((app) => ({
          id: app.bundleId!,
          name: app.path.split("/").pop()!.replace(".app", ""),
          path: app.path,
          running: runningApps.has(app.name) && !soonToBePreferences.appsWithoutRunningCheck.includes(app.bundleId!),
          icon: imagePaths[app.bundleId!].custom ?? imagePaths[app.bundleId!].default,
          type: "app" as const,
        }));
        const cleanedWebsites: Openable[] = parsedWebsites.map((website) => ({
          ...website,
          icon: imagePaths[website.id]?.custom ?? imagePaths[website.id]?.default ?? website.icon,
          type: "website" as const,
        }));
        const cleanedDirectories: Openable[] = parsedDirectories.map((directory) => ({
          ...directory,
          icon: imagePaths[directory.id]?.custom ?? imagePaths[directory.id]?.default ?? directory.icon,
          type: "directory" as const,
        }));

        setApplications(cleanedApplications);
        setWebsites(cleanedWebsites);
        setDirectories(cleanedDirectories);
      } catch (error) {
        console.error("Error fetching applications:", error);
      }

      setIsLoading(false);
    }

    void initApp();
  }, []);

  function setAppRunningStatus(app: Openable, running: boolean) {
    setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, running } : a)));
  }

  function incrementFrecency(app: Openable) {
    setHitHistory((prev) => {
      const newHitHistory = { ...prev };
      newHitHistory[app.id] = (newHitHistory[app.id] ?? []).concat([new Date().toISOString()]);
      void LocalStorage.setItem("hitHistory", JSON.stringify(newHitHistory));
      return newHitHistory;
    });
  }

  async function toggleShowingHiddenOpenables() {
    const newPreferences = { ...preferences };
    newPreferences.showHidden = !newPreferences.showHidden;
    setPreferences(newPreferences);
    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  async function togglePrioritizeRunningApps() {
    const newPreferences = { ...preferences };
    newPreferences.prioritizeRunningApps = !newPreferences.prioritizeRunningApps;
    setPreferences(newPreferences);
    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  async function toggle(type: ToggleableAppPreferences, bundleId: string) {
    const newPreferences = { ...preferences };
    switch (type) {
      case "pinnedApps":
        if (newPreferences.pinnedApps.includes(bundleId)) {
          newPreferences.pinnedApps = newPreferences.pinnedApps.filter((id) => id !== bundleId);
        } else {
          newPreferences.pinnedApps.push(bundleId);
        }
        break;
      case "hidden":
        if (newPreferences.hidden.includes(bundleId)) {
          newPreferences.hidden = newPreferences.hidden.filter((id) => id !== bundleId);
        } else {
          newPreferences.hidden.push(bundleId);
        }
        break;
      case "appsWithoutRunningCheck":
        if (newPreferences.appsWithoutRunningCheck.includes(bundleId)) {
          newPreferences.appsWithoutRunningCheck = newPreferences.appsWithoutRunningCheck.filter(
            (id) => id !== bundleId,
          );
          setAppRunningStatus(applications.find((a) => a.id === bundleId)!, true);
        } else {
          newPreferences.appsWithoutRunningCheck.push(bundleId);
          setAppRunningStatus(applications.find((a) => a.id === bundleId)!, false);
        }
        break;
      case "prioritizeRunningApps":
        newPreferences.prioritizeRunningApps = !newPreferences.prioritizeRunningApps;
        break;
      case "showHidden":
        newPreferences.showHidden = !newPreferences.showHidden;
        break;
    }
    setPreferences(newPreferences);
    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  function getOpeners(app: Openable) {
    return getApplications(app.path);
  }

  return (
    <AppDataContext.Provider
      value={{
        settings,
        isLoading,
        setIsLoading,
        preferences,
        setPreferences,
        applications,
        setApplications,
        websites,
        setWebsites,
        directories,
        setDirectories,
        hitHistory,
        setHitHistory,
        setAppRunningStatus,
        incrementFrecency,
        toggleShowingHiddenOpenables,
        togglePrioritizeRunningApps,
        toggle,
        getOpeners,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
};
