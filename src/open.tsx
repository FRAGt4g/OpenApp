import {
  Action,
  ActionPanel,
  Color,
  getApplications,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  Application as RayCastApplication,
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
  HitHistory,
  RenameItem,
  runTerminalCommand,
  ToggleableAppPreferences,
} from "./imports";

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
    async function loadPreferences(): Promise<AppPreferences> {
      try {
        const stored = await LocalStorage.getItem<string>("appPreferences");
        if (stored) {
          const parsedPreferences = JSON.parse(stored);
          const soonToBePreferences = {
            hidden: parsedPreferences.hidden ?? [],
            customNames: parsedPreferences.customNames ?? {},
            pinnedApps: parsedPreferences.pinnedApps ?? [],
            appImportance: parsedPreferences.appImportance ?? {},
            showHidden: parsedPreferences.showHidden ?? false,
            quickCommands: parsedPreferences.quickCommands ?? {},
            prioritizeRunningApps: parsedPreferences.prioritizeRunningApps ?? true,
            sortType: parsedPreferences.sortType ?? "frecency",
            appsWithoutRunningCheck: parsedPreferences.appsWithoutRunningCheck ?? [],
          };
          setPreferences(soonToBePreferences);
          return soonToBePreferences;
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      }
      return {
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
    }

    function cleanApplications(
      apps: RayCastApplication[],
      runningApps: string[],
      preferences: AppPreferences,
    ): Application[] {
      const runningCheck = (app: RayCastApplication) => {
        return runningApps.includes(app.name) && !preferences.appsWithoutRunningCheck.includes(app.bundleId!);
      };

      return apps
        .filter((app) => app && app.bundleId)
        .map((app) => ({
          bundleId: app.bundleId!,
          name: app.name,
          path: app.path,
          running: runningCheck(app),
        }));
    }

    async function fetchApplications() {
      try {
        const soonToBePreferences = await loadPreferences();
        const apps: RayCastApplication[] = await getApplications();
        if (!fastMode) {
          const runningApps = await getRunningApps();
          const cleanedApps = cleanApplications(apps, runningApps, soonToBePreferences);
          setApplications(cleanedApps);
        } else {
          setApplications(
            apps.map((app) => ({
              bundleId: app.bundleId!,
              name: app.name,
              path: app.path,
              running: false,
            })),
          );
        }
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setIsLoading(false);
      }
    }

    async function getRunningApps(): Promise<string[]> {
      try {
        const { stdout } = await runTerminalCommand("ps aux | grep -i '.app'");
        const runningApps = stdout
          .split("\n")
          .filter((line) => line.includes(".app") && line.includes("Contents/MacOS/"))
          .map((line) =>
            line.substring(
              line.indexOf("Applications/") + 13,
              line.indexOf("/", line.indexOf("Applications/") + 13) - 4,
            ),
          )
          .filter((app) => !app.includes("??"))
          .filter((app, index, self) => self.indexOf(app) === index);
        for (const app of runningApps) {
          console.log(app);
        }

        return runningApps;
      } catch (error) {
        console.error("Error fetching running applications:", error);
        return [];
      }
    }

    async function fetchHitHistory() {
      try {
        const stored = await LocalStorage.getItem<string>("hitHistory");
        if (stored) {
          const parsedHitHistory = JSON.parse(stored);
          setHitHistory(parsedHitHistory);
        }
      } catch (error) {
        console.error("Error loading hit history:", error);
      }
    }

    fetchHitHistory();
    fetchApplications();
  }, []);

  function passesSearchFilter(app: Application): boolean {
    if (!searchText) return true;

    const options = {
      includeScore: true,
      threshold: fuzzySearchThreshold,
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
    return result.length > 0;
  }

  const [pinnedApps, regularApps, hiddenApps] = useMemo(() => {
    return [
      applications
        .filter((app) => preferences.pinnedApps.includes(app.bundleId) && passesSearchFilter(app))
        .sort(sortFunction),
      applications
        .filter((app) => !preferences.pinnedApps.includes(app.bundleId) && passesSearchFilter(app))
        .sort(sortFunction),
      applications
        .filter((app) => preferences.showHidden && preferences.hidden.includes(app.bundleId) && passesSearchFilter(app))
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
        return calcFrecencyValue(b.bundleId) - calcFrecencyValue(a.bundleId);
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
            <ActionPanel.Section title={"General View"}>
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
