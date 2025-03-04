import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  getApplications,
  getPreferenceValues as getSettings,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import Fuse from "fuse.js";
import fetch from "node-fetch";
import { useEffect, useMemo, useState } from "react";
import AddWebsite from "./AddWebsite";
import ChangeIcon from "./ChangeIcon";
import {
  AppPreferences,
  asyncGetAppIcon,
  DeepSettings,
  defaultPreferences,
  getRunningApps,
  HitHistory,
  Openable,
  RenameItem,
  runTerminalCommand,
  SortType,
  ToggleableAppPreferences,
} from "./imports";

const DEBUG_MODE = false;
const SEARCH_STRICTNESS = 0.35;
const FARTHEST_BACK_HIT_DATE = 1000 * 60 * 60 * 24 * 30; // 30 days

export default function Command() {
  const settings = getSettings<DeepSettings>();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [applications, setApplications] = useState<Openable[]>([]);
  const [websites, setWebsites] = useState<Openable[]>([]);
  const [hitHistory, setHitHistory] = useState<HitHistory>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortType, setSortType] = useState<SortType>("frecency");
  const [searchText, setSearchText] = useState("");
  const { push } = useNavigation();

  const allOpenables = useMemo(() => {
    return applications.concat(websites);
  }, [applications, websites]);

  const [lambdaDecay, fuzzySearchThreshold, timeScale] = useMemo(() => {
    return [
      parseFloat(settings.lambdaDecayDropdown),
      parseFloat(settings.fuzzySearchThresholdDropdown),
      parseFloat(settings.timeScaleDropdown),
    ];
  }, [settings]);

  const [pins, regular, hidden] = useMemo(() => {
    return [
      allOpenables
        .filter((app) => preferences.pinnedApps.includes(app.id) && passesSearchFilter(app).passes)
        .sort(sortFunction),
      allOpenables
        .filter(
          (app) =>
            !preferences.pinnedApps.includes(app.id) &&
            passesSearchFilter(app).passes &&
            !preferences.hidden.includes(app.id),
        )
        .sort(sortFunction),
      allOpenables
        .filter((app) => preferences.hidden.includes(app.id) && passesSearchFilter(app).passes)
        .sort(sortFunction),
    ];
  }, [allOpenables, preferences, sortType, searchText]);

  useEffect(() => {
    async function initApp() {
      const [unparsedHitHistoryJSON, unparsedPreferencesJSON, unparsedWebsitesJSON, apps] = await Promise.all([
        LocalStorage.getItem<string>("hitHistory"),
        LocalStorage.getItem<string>("appPreferences"),
        LocalStorage.getItem<string>("websites"),
        getApplications().then((apps) => apps.filter((app) => app && app.bundleId)),
      ]);

      if (unparsedWebsitesJSON) {
        try {
          const a = JSON.parse(unparsedWebsitesJSON) as Openable[];
          setWebsites(a);
        } catch (error) {
          console.error("Error loading websites:", error);
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
        const runningApps = !settings.fastMode ? await getRunningApps() : [];
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
          name: app.path.split("/").pop()!.replace(".app", ""), // Use the custom name of the app based on name of '.app' file
          path: app.path,
          running: runningApps.includes(app.name) && !preferences.appsWithoutRunningCheck.includes(app.bundleId!),
          icon: imagePaths[app.bundleId!].custom ?? imagePaths[app.bundleId!].default,
          type: "app",
        }));
        const cleanedWebsites: Openable[] = soonToBePreferences.websites.map((website) => ({
          ...website,
          icon: imagePaths[website.id].custom ?? imagePaths[website.id].default ?? website.icon,
        }));

        console.log(cleanedApplications.map((app) => app.icon));

        setApplications(cleanedApplications);
        setWebsites(cleanedWebsites);
      } catch (error) {
        console.error("Error fetching applications:", error);
      }

      setIsLoading(false);
    }

    initApp();
  }, []);

  function passesSearchFilter(app: Openable): { passes: boolean; score: number } {
    if (!searchText) return { passes: true, score: 1 };

    const options = {
      includeScore: true,
      //TODO: Remove in production
      threshold: DEBUG_MODE ? SEARCH_STRICTNESS : fuzzySearchThreshold,
      keys: [
        { name: "name", weight: 0.3 },
        { name: "customName", weight: 0.7 },
      ],
    };

    const fuse = new Fuse(
      [
        {
          name: app.name.toLowerCase(),
          customName: (preferences.customNames[app.id] || "").toLowerCase(),
        },
      ],
      options,
    );

    const result = fuse.search(searchText.toLowerCase());
    const score = result.length > 0 ? (result[0]!.score ?? 1) : 1;
    return {
      passes: result.length > 0,
      score: 1 - score,
    };
  }

  function calcFrecencyValue(appId: string) {
    const now = new Date();
    return (
      hitHistory[appId]?.reduce((total, timestamp) => {
        const millisecondsToHours = 3600000;
        return (
          total +
          Math.exp(-lambdaDecay * ((now.getTime() - new Date(timestamp).getTime()) / millisecondsToHours / timeScale))
        );
      }, 0) ?? 0
    );
  }

  function sortFunction(a: Openable, b: Openable) {
    if (preferences.prioritizeRunningApps && a.running !== b.running) {
      return a.running ? -1 : 1;
    }

    switch (sortType) {
      case "frecency": {
        const diff =
          0.8 * (calcFrecencyValue(b.id) - calcFrecencyValue(a.id)) +
          0.2 * (passesSearchFilter(b).score - passesSearchFilter(a).score);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      case "alphabetical":
        return a.name.localeCompare(b.name);
      case "custom":
        return a.name.localeCompare(b.name);
    }
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
          setAppRunningStatus(applications.find((app) => app.id === bundleId)!, true);
        } else {
          newPreferences.appsWithoutRunningCheck.push(bundleId);
          setAppRunningStatus(applications.find((app) => app.id === bundleId)!, false);
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

  function setAppRunningStatus(app: Openable, running: boolean) {
    const newApplications: Openable[] = applications.map((a) => {
      if (a.id === app.id) {
        return { ...a, running: running };
      }
      return a;
    });
    setApplications(newApplications);
  }

  const openAddWebsiteForm = () => {
    push(
      <AddWebsite
        onSave={async (name, url) => {
          const result = await fetch(url + "/favicon.ico").catch(() => ({ ok: false }));
          const soonToBeWebsites: Openable[] = [
            ...websites,
            {
              id: url,
              name: name,
              path: url,
              running: false,
              icon: result.ok ? url + "/favicon.ico" : { source: Icon.Globe },
              type: "website",
            },
          ];
          setWebsites(soonToBeWebsites);
          await LocalStorage.setItem("websites", JSON.stringify(soonToBeWebsites));
        }}
      />,
    );
  };

  function incrementFrecency(app: Openable) {
    const newHitHistory = { ...hitHistory };
    newHitHistory[app.id] = (newHitHistory[app.id] ?? []).concat([new Date().toISOString()]);
    setHitHistory(newHitHistory);
    LocalStorage.setItem("hitHistory", JSON.stringify(newHitHistory));
  }

  const AppItem = ({ app }: { app: Openable }) => {
    return (
      <List.Item
        icon={!settings.fastMode ? (app.icon ?? Icon.Window) : undefined}
        title={preferences.customNames[app.id] || app.name}
        subtitle={preferences.customNames[app.id] ? app.name : ""}
        accessories={[
          {
            icon: app.running && !settings.fastMode ? { source: Icon.Bolt, tintColor: Color.Green } : undefined,
            tooltip: app.running ? "Running" : "Not Running",
          },
          {
            icon: app.type === "website" ? { source: Icon.Globe } : undefined,
            tooltip: app.type === "website" ? "Website" : undefined,
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Clock, tintColor: Color.Blue } : undefined,
            tooltip: DEBUG_MODE ? `Frecency Score: ${calcFrecencyValue(app.id)}` : undefined,
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Text, tintColor: Color.Orange } : undefined,
            tooltip: DEBUG_MODE ? `Search Score: ${passesSearchFilter(app).score}` : undefined,
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Hashtag, tintColor: Color.Red } : undefined,
            tooltip: DEBUG_MODE
              ? `Total score: ${0.8 * calcFrecencyValue(app.id) + 0.2 * passesSearchFilter(app).score}`
              : undefined,
          },
        ]}
        actions={
          <ActionPanel>
            <Action.Open
              title={app.running ? `Go to ${app.type}` : `Open ${app.type}`}
              target={app.path}
              icon={Icon.AppWindow}
              onOpen={() => {
                setAppRunningStatus(app, true);
                incrementFrecency(app);
              }}
            />
            <ActionPanel.Section title={"App Specific"}>
              {app.running && (
                <Action
                  title={`Close ${app.type}`}
                  icon={Icon.XMarkCircle}
                  onAction={async () => {
                    setAppRunningStatus(app, false);
                    try {
                      setIsLoading(true);
                      await runTerminalCommand(`osascript -e 'tell application "${app.name}" to quit'`);
                      setIsLoading(false);
                    } catch (error) {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: `Failed to close ${app.type}`,
                        message: String(error),
                      });
                    }
                  }}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                />
              )}
              <Action
                title={preferences.pinnedApps.includes(app.id) ? "Unpin" : "Pin"}
                icon={preferences.pinnedApps.includes(app.id) ? Icon.PinDisabled : Icon.Pin}
                onAction={() => toggle("pinnedApps", app.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              />
              {!preferences.pinnedApps.includes(app.id) && (
                <Action
                  title={preferences.hidden.includes(app.id) ? "Un-hide" : "Hide"}
                  icon={preferences.hidden.includes(app.id) ? Icon.Eye : Icon.EyeDisabled}
                  onAction={() => toggle("hidden", app.id)}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
                />
              )}
              <Action
                title="Set Custom Name"
                icon={Icon.Pencil}
                onAction={() =>
                  push(
                    <RenameItem
                      item={{ id: app.id ?? "", name: app.name }}
                      onRename={async (name) => {
                        const newPreferences = { ...preferences };
                        newPreferences.customNames[app.id] = name;
                        setPreferences(newPreferences);
                        await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                      }}
                    />,
                  )
                }
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
              />
              <Action
                title="Set Custom Icon"
                icon={Icon.Brush}
                onAction={() =>
                  push(
                    <ChangeIcon
                      appName={app.name}
                      currentIconPath={app.icon}
                      onSave={async (newIconPath) => {
                        const newPreferences = { ...preferences };
                        newPreferences.cachedIconDirectories[app.id].custom = newIconPath;
                        setPreferences(newPreferences);
                        app.icon = newIconPath;
                        await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                      }}
                    />,
                  )
                }
              />
              {preferences.cachedIconDirectories[app.id]?.custom !== null && (
                <Action
                  title="Remove Custom Icon"
                  icon={Icon.Trash}
                  onAction={async () => {
                    const newPreferences = { ...preferences };
                    newPreferences.cachedIconDirectories[app.id] = {
                      default: newPreferences.cachedIconDirectories[app.id].default,
                      custom: null,
                    };
                    app.icon = newPreferences.cachedIconDirectories[app.id].default;
                    setPreferences(newPreferences);
                    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                  }}
                />
              )}
              {!settings.fastMode && (
                <Action
                  title={
                    preferences.appsWithoutRunningCheck.includes(app.id)
                      ? "Check Running Status"
                      : "Ignore Running Status"
                  }
                  icon={preferences.appsWithoutRunningCheck.includes(app.id) ? Icon.Bolt : Icon.BoltDisabled}
                  onAction={() => toggle("appsWithoutRunningCheck", app.id)}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                />
              )}
              {preferences.customNames[app.id] && (
                <Action
                  title="Remove Custom Name"
                  icon={Icon.XMarkCircle}
                  onAction={async () => {
                    const newPreferences = { ...preferences };
                    delete newPreferences.customNames[app.id];
                    setPreferences(newPreferences);
                    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                    showToast({
                      style: Toast.Style.Success,
                      title: "Custom name for " + app.name + " removed",
                    });
                  }}
                />
              )}
              <Action
                title="Refresh App Icon"
                icon={Icon.ArrowCounterClockwise}
                onAction={async () => {
                  setIsLoading(true);
                  const newIconPath = await asyncGetAppIcon({
                    appPath: app.path,
                    appName: app.name,
                    checkCache: false,
                  });
                  const newPreferences = preferences;
                  newPreferences.cachedIconDirectories[app.id] = {
                    default: newIconPath,
                    custom: newPreferences.cachedIconDirectories[app.id].custom,
                  };
                  setPreferences(newPreferences);
                  await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                  setIsLoading(false);
                }}
              />
              {app.type === "website" && (
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  onAction={async () => {
                    if (
                      await confirmAlert({
                        title: "Are you sure?",
                        message:
                          "This will delete the website from the list of things you can open and reset the frecency value.",
                        primaryAction: {
                          title: "Delete",
                          style: Alert.ActionStyle.Destructive,
                        },
                      })
                    ) {
                      setWebsites(websites.filter((website) => website.id !== app.id));
                      LocalStorage.setItem("websites", JSON.stringify(websites));
                      showToast({
                        style: Toast.Style.Success,
                        title: "Website deleted",
                      });
                    }
                  }}
                />
              )}
            </ActionPanel.Section>
            <ActionPanel.Section title={"General"}>
              <Action
                title="Clear Icon Cache"
                icon={Icon.Trash}
                onAction={() => {
                  LocalStorage.setItem("appPreferences", JSON.stringify({ ...preferences, cachedIconDirectories: {} }));
                  setPreferences({ ...preferences, cachedIconDirectories: {} });
                }}
              />
              <Action
                title={preferences.showHidden ? "Don't Show Hidden Apps" : "Show All Hidden Apps"}
                icon={preferences.showHidden ? Icon.CircleDisabled : Icon.Circle}
                onAction={() => toggle("showHidden", app.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
              />
              {!settings.fastMode && (
                <Action
                  title={
                    preferences.prioritizeRunningApps
                      ? "Ignore Running Status When Sorting"
                      : "Pull Running Apps to Top"
                  }
                  icon={Icon.ChevronUpDown}
                  onAction={() => toggle("prioritizeRunningApps", app.id)}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                />
              )}
              <Action title="Add Website" icon={Icon.Globe} onAction={openAddWebsiteForm} />
              <Action
                title="Reset Frecency Values"
                icon={Icon.Clock}
                onAction={async () => {
                  if (
                    await confirmAlert({
                      title: "Are you sure?",
                      message:
                        "This will reset all frecency values which will affect the sorting of apps. This cannot be undone.",
                      primaryAction: {
                        title: "Reset",
                        style: Alert.ActionStyle.Destructive,
                      },
                      dismissAction: {
                        title: "Cancel",
                        style: Alert.ActionStyle.Cancel,
                      },
                    })
                  ) {
                    setHitHistory({});
                    LocalStorage.setItem("hitHistory", JSON.stringify({}));
                    showToast({
                      style: Toast.Style.Success,
                      title: "Frecency values reset",
                    });
                  }
                }}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for the app you want to open"
      searchBarAccessory={
        settings.showSortOptions ? (
          <List.Dropdown
            tooltip="Sort by"
            onChange={(value) => {
              const newSortType = value as "frecency" | "alphabetical" | "custom";
              setSortType(newSortType);
              LocalStorage.setItem("sortType", newSortType);
            }}
          >
            <List.Dropdown.Item title="Frecency" value="frecency" icon={Icon.Clock} />
            <List.Dropdown.Item title="Alphabetical" value="alphabetical" icon={Icon.Text} />
            <List.Dropdown.Item title="Custom" value="custom" icon={Icon.Pencil} />
          </List.Dropdown>
        ) : null
      }
    >
      <List.Section title="Pinned Apps">
        {pins.map((app) => (
          <AppItem key={app.id} app={app} />
        ))}
      </List.Section>

      <List.Section title="All Apps">
        {regular.map((app) => (
          <AppItem key={app.id} app={app} />
        ))}
      </List.Section>

      {preferences.showHidden && (
        <List.Section title="Hidden Apps">
          {hidden.map((app) => (
            <AppItem key={app.id} app={app} />
          ))}
        </List.Section>
      )}
    </List>
  );
}
