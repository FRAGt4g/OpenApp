import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  getApplications,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import {
  Application,
  AppPreferences,
  getAppIcon,
  getRunningApps,
  HitHistory,
  RenameItem,
  runTerminalCommand,
  ToggleableAppPreferences,
} from "./imports";

const DEBUG_MODE = true;
const SEARCH_STRICTNESS = 0.35;
const FARTHEST_BACK_HIT_DATE = 1000 * 60 * 60 * 24 * 30; // 30 days

export default function Command() {
  const { fastMode, showSortOptions, lambdaDecayDropdown, fuzzySearchThresholdDropdown, timeScaleDropdown } =
    getPreferenceValues<{
      fastMode: boolean;
      showSortOptions: boolean;
      lambdaDecayDropdown: string;
      fuzzySearchThresholdDropdown: string;
      timeScaleDropdown: string;
    }>();
  const [preferences, setPreferences] = useState<AppPreferences>({
    hidden: [],
    customNames: {},
    pinnedApps: [],
    appImportance: {},
    showHidden: false,
    quickCommands: {},
    prioritizeRunningApps: false,
    sortType: "frecency",
    appsWithoutRunningCheck: [],
  });
  const lambdaDecay = parseFloat(lambdaDecayDropdown);
  const fuzzySearchThreshold = parseFloat(fuzzySearchThresholdDropdown);
  const timeScale = parseFloat(timeScaleDropdown);
  const [applications, setApplications] = useState<Application[]>([]);
  const [hitHistory, setHitHistory] = useState<HitHistory>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortType, setSortType] = useState<"frecency" | "alphabetical" | "custom">("frecency");
  const [searchText, setSearchText] = useState("");
  const { push } = useNavigation();

  useEffect(() => {
    async function initApp() {
      const [unparsedHitHistoryJSON, unparsedPreferencesJSON, apps] = await Promise.all([
        LocalStorage.getItem<string>("hitHistory"),
        LocalStorage.getItem<string>("appPreferences"),
        getApplications(),
      ]);

      if (unparsedHitHistoryJSON) {
        try {
          const parsedHitHistory: HitHistory = JSON.parse(unparsedHitHistoryJSON);
          const cutoff = new Date(new Date().getTime() - FARTHEST_BACK_HIT_DATE);
          console.log("--------------------------");
          console.log("Cleaning hit history", parsedHitHistory);
          console.log("Cutoff", cutoff);

          const purgedHitHistory: HitHistory = {};
          for (const hitHistoryItem of Object.entries(parsedHitHistory)) {
            const [appId, timestamps] = hitHistoryItem;
            const newTimestamps = timestamps.filter((timestamp) => new Date(timestamp) > cutoff);
            if (newTimestamps.length > 0) {
              purgedHitHistory[appId] = newTimestamps;
            }
          }

          console.log("New hit history", purgedHitHistory);
          LocalStorage.setItem("hitHistory", JSON.stringify(purgedHitHistory));
          setHitHistory(purgedHitHistory);
          console.log("--------------------------");
        } catch (error) {
          console.error("Error loading hit history:", error);
        }
      } else {
        setHitHistory({});
      }

      let soonToBePreferences: AppPreferences = {
        hidden: [],
        customNames: {},
        pinnedApps: [],
        appImportance: {},
        showHidden: false,
        quickCommands: {},
        prioritizeRunningApps: true,
        sortType: "frecency",
        appsWithoutRunningCheck: [],
      };
      if (unparsedPreferencesJSON) {
        try {
          const parsedPreferences = JSON.parse(unparsedPreferencesJSON);
          soonToBePreferences = {
            hidden: parsedPreferences.hidden ?? soonToBePreferences.hidden,
            customNames: parsedPreferences.customNames ?? soonToBePreferences.customNames,
            pinnedApps: parsedPreferences.pinnedApps ?? soonToBePreferences.pinnedApps,
            appImportance: parsedPreferences.appImportance ?? soonToBePreferences.appImportance,
            showHidden: parsedPreferences.showHidden ?? soonToBePreferences.showHidden,
            quickCommands: parsedPreferences.quickCommands ?? soonToBePreferences.quickCommands,
            prioritizeRunningApps: parsedPreferences.prioritizeRunningApps ?? soonToBePreferences.prioritizeRunningApps,
            sortType: parsedPreferences.sortType ?? soonToBePreferences.sortType,
            appsWithoutRunningCheck:
              parsedPreferences.appsWithoutRunningCheck ?? soonToBePreferences.appsWithoutRunningCheck,
          };
          setPreferences(soonToBePreferences);
        } catch (error) {
          console.error("Error loading preferences:", error);
        }
      }

      try {
        const runningApps = fastMode ? [] : await getRunningApps();
        setApplications(
          apps
            .filter((app) => app && app.bundleId)
            .map((app) => ({
              bundleId: app.bundleId!,
              name: app.name,
              path: app.path,
              running: runningApps.includes(app.name) && !preferences.appsWithoutRunningCheck.includes(app.bundleId!),
            })),
        );
      } catch (error) {
        console.error("Error fetching applications:", error);
      }

      setIsLoading(false);
    }

    initApp();
  }, []);

  function passesSearchFilter(app: Application): { passes: boolean; score: number } {
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
          customName: (preferences.customNames[app.bundleId] || "").toLowerCase(),
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

  const [pinnedApps, regularApps, hiddenApps] = useMemo(() => {
    return [
      applications
        .filter((app) => preferences.pinnedApps.includes(app.bundleId) && passesSearchFilter(app).passes)
        .sort(sortFunction),
      applications
        .filter((app) => !preferences.pinnedApps.includes(app.bundleId) && passesSearchFilter(app).passes)
        .sort(sortFunction),
      applications
        .filter(
          (app) =>
            preferences.showHidden && preferences.hidden.includes(app.bundleId) && passesSearchFilter(app).passes,
        )
        .sort(sortFunction),
    ];
  }, [applications, preferences, sortType, searchText]);

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

  function sortFunction(a: Application, b: Application) {
    if (preferences.prioritizeRunningApps && a.running !== b.running) {
      return a.running ? -1 : 1;
    }

    switch (sortType) {
      case "frecency":
        return (
          0.8 * (calcFrecencyValue(b.bundleId) - calcFrecencyValue(a.bundleId)) +
          0.2 * (passesSearchFilter(b).score - passesSearchFilter(a).score)
        );
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
          setAppRunningStatus(applications.find((app) => app.bundleId === bundleId)!, true);
        } else {
          newPreferences.appsWithoutRunningCheck.push(bundleId);
          setAppRunningStatus(applications.find((app) => app.bundleId === bundleId)!, false);
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

  function setAppRunningStatus(app: Application, running: boolean) {
    const newApplications: Application[] = applications.map((a) => {
      if (a.bundleId === app.bundleId) {
        return { ...a, running: running };
      }
      return a;
    });
    setApplications(newApplications);
  }

  function incrementFrecency(app: Application) {
    const newHitHistory = { ...hitHistory };
    newHitHistory[app.bundleId] = (newHitHistory[app.bundleId] ?? []).concat([new Date().toISOString()]);
    setHitHistory(newHitHistory);
    LocalStorage.setItem("hitHistory", JSON.stringify(newHitHistory));
  }

  const AppItem = ({ preferences, app }: { preferences: AppPreferences; app: Application }) => {
    return (
      <List.Item
        key={app.bundleId}
        icon={!fastMode ? getAppIcon(app) : undefined}
        title={preferences.customNames[app.bundleId] || app.name}
        subtitle={preferences.customNames[app.bundleId] ? app.name : ""}
        accessories={[
          {
            icon: app.running ? { source: Icon.Bolt, tintColor: Color.Green } : undefined,
            tooltip: app.running ? "Running" : "Not Running",
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Clock, tintColor: Color.Blue } : undefined,
            tooltip: DEBUG_MODE ? `Frecency Score: ${calcFrecencyValue(app.bundleId)}` : undefined,
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Text, tintColor: Color.Orange } : undefined,
            tooltip: DEBUG_MODE ? `Search Score: ${passesSearchFilter(app).score}` : undefined,
          },
          {
            icon: DEBUG_MODE ? { source: Icon.Hashtag, tintColor: Color.Red } : undefined,
            tooltip: DEBUG_MODE
              ? `Total score: ${0.8 * calcFrecencyValue(app.bundleId) + 0.2 * passesSearchFilter(app).score}`
              : undefined,
          },
        ]}
        actions={
          <ActionPanel>
            <Action.Open
              title={app.running ? "Go to Application" : "Open Application"}
              target={app.path}
              icon={Icon.AppWindow}
              onOpen={() => {
                setAppRunningStatus(app, true);
                incrementFrecency(app);
              }}
            />
            {app.running && (
              <Action
                title="Close Application"
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
                      title: "Failed to close application",
                      message: String(error),
                    });
                  }
                }}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
              />
            )}
            <ActionPanel.Section title={"App Specific"}>
              <Action
                title={preferences.pinnedApps.includes(app.bundleId) ? "Unpin App" : "Pin App"}
                icon={Icon.Pin}
                onAction={() => toggle("pinnedApps", app.bundleId)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              />
              {!preferences.pinnedApps.includes(app.bundleId) && (
                <Action
                  title="Hide App"
                  icon={Icon.EyeDisabled}
                  onAction={() => toggle("hidden", app.bundleId)}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
                />
              )}
              <Action
                title="Set Custom Name"
                icon={Icon.Pencil}
                onAction={() =>
                  push(
                    <RenameItem
                      item={{ id: app.bundleId ?? "", name: app.name }}
                      onRename={async (name) => {
                        const newPreferences = { ...preferences };
                        newPreferences.customNames[app.bundleId] = name;
                        setPreferences(newPreferences);
                        await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                      }}
                    />,
                  )
                }
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
              />
              {preferences.customNames[app.bundleId] && (
                <Action
                  title="Remove Custom Name"
                  icon={Icon.XMarkCircle}
                  onAction={async () => {
                    const newPreferences = { ...preferences };
                    delete newPreferences.customNames[app.bundleId];
                    setPreferences(newPreferences);
                    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
                  }}
                />
              )}
              <Action
                title={
                  preferences.appsWithoutRunningCheck.includes(app.bundleId)
                    ? "Check Running Status"
                    : "Don't Check Running Status"
                }
                icon={preferences.appsWithoutRunningCheck.includes(app.bundleId) ? Icon.Bolt : Icon.BoltDisabled}
                onAction={() => toggle("appsWithoutRunningCheck", app.bundleId)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title={"General"}>
              <Action
                title={preferences.showHidden ? "Hide All Hidden Apps" : "Show All Hidden Apps"}
                icon={preferences.showHidden ? Icon.CircleDisabled : Icon.Circle}
                onAction={() => toggle("showHidden", app.bundleId)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
              />
              <Action
                title={
                  preferences.prioritizeRunningApps ? "Ignore Running Status When Sorting" : "Pull Running Apps to Top"
                }
                icon={preferences.prioritizeRunningApps ? Icon.BoltDisabled : Icon.Bolt}
                onAction={() => toggle("prioritizeRunningApps", app.bundleId)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
              />
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
        showSortOptions ? (
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
        {pinnedApps.map((app) => (
          <AppItem key={app.bundleId} preferences={preferences} app={app} />
        ))}
      </List.Section>

      <List.Section title="All Apps">
        {regularApps.map((app) => (
          <AppItem key={app.bundleId} preferences={preferences} app={app} />
        ))}
      </List.Section>

      <List.Section title="Hidden Apps">
        {hiddenApps.map((app) => (
          <AppItem key={app.bundleId} preferences={preferences} app={app} />
        ))}
      </List.Section>
    </List>
  );
}
