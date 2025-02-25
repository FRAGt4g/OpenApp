import {
  Action,
  ActionPanel,
  Color,
  getApplications,
  Icon,
  Keyboard,
  List,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { exec } from "child_process";
import { readdirSync } from "fs";
import { useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import RenameItem from "./RenameItem";

interface AppPreferences {
  hidden: string[];
  customNames: Record<string, string>;
  pinnedApps: string[];
  appImportance: Record<string, number>;
  showHidden: boolean;
  quickCommands: Record<string, { modifiers: Keyboard.KeyModifier[]; key: Keyboard.KeyEquivalent }>;
  prioritizeRunningApps: boolean;
}

interface Application {
  bundleId: string;
  name: string;
  path: string;
  running: boolean;
}

const execPromise = promisify(exec);

function getAppIcon(app: Application): string | Icon {
  if (!app?.path) return "";

  const resourcesPath = `${app.path}/Contents/Resources`;
  try {
    const iconFile = readdirSync(resourcesPath).find((file) => file.endsWith(".icns"));
    return iconFile ? `${resourcesPath}/${iconFile}` : Icon.AppWindow;
  } catch {
    return Icon.AppWindow;
  }
}

export default function Command() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>({
    hidden: [],
    customNames: {},
    pinnedApps: [],
    appImportance: {},
    showHidden: false,
    quickCommands: {},
    prioritizeRunningApps: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  useEffect(() => {
    async function loadPreferences() {
      try {
        const stored = await LocalStorage.getItem<string>("appPreferences");
        if (stored) {
          const parsedPreferences = JSON.parse(stored);
          setPreferences({
            hidden: parsedPreferences.hidden ?? [],
            customNames: parsedPreferences.customNames ?? {},
            pinnedApps: parsedPreferences.pinnedApps ?? [],
            appImportance: parsedPreferences.appImportance ?? {},
            showHidden: parsedPreferences.showHidden ?? false,
            quickCommands: parsedPreferences.quickCommands ?? {},
            prioritizeRunningApps: parsedPreferences.prioritizeRunningApps ?? true,
          });
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      }
    }

    async function fetchApplications() {
      try {
        const apps = await getApplications();
        const runningApps = await getRunningApps();
        const cleanedApps = apps
          .filter((app) => app && app.bundleId)
          .map((app) => ({
            bundleId: app.bundleId!,
            name: app.name,
            path: app.path,
            running: runningApps.includes(app.name),
          }));
        setApplications(cleanedApps);
        await loadPreferences();
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setIsLoading(false);
      }
    }

    async function getRunningApps() {
      try {
        const { stdout } = await execPromise("ps aux | grep -i '.app'");
        const runningApps = stdout
          .split("\n")
          .filter((line) => line.includes(".app") && line.includes("Applications/"))
          .map((line) => line.split(/\s+/).pop()?.split("/").pop());

        return runningApps;
      } catch (error) {
        console.error("Error fetching running applications:", error);
        return [];
      }
    }

    getRunningApps();
    fetchApplications();
  }, []);

  const [pinnedApps, regularApps, hiddenApps] = useMemo(() => {
    return [
      applications.filter((app) => preferences.pinnedApps.includes(app.bundleId)).sort(sortFunction),
      applications
        .filter((app) => !preferences.pinnedApps.includes(app.bundleId) && !preferences.hidden.includes(app.bundleId))
        .sort(sortFunction),
      applications
        .filter((app) => preferences.showHidden && preferences.hidden.includes(app.bundleId))
        .sort(sortFunction),
    ];
  }, [applications, preferences]);

  function sortFunction(a: Application, b: Application) {
    if (preferences.prioritizeRunningApps) {
      if (a.running && !b.running) return -1;
      if (!a.running && b.running) return 1;
    }
    const aImportance = preferences.appImportance[a.bundleId ?? ""] ?? 0;
    const bImportance = preferences.appImportance[b.bundleId ?? ""] ?? 0;
    return bImportance - aImportance;
  }

  async function toggle(type: "pinnedApps" | "hidden", bundleId: string) {
    const newPreferences = { ...preferences };
    if (newPreferences[type].includes(bundleId)) {
      newPreferences[type] = newPreferences[type].filter((id) => id !== bundleId);
    } else {
      newPreferences[type].push(bundleId);
    }
    setPreferences(newPreferences);
    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  async function setCustomName(bundleId: string, name: string) {
    const newPreferences = { ...preferences };
    newPreferences.customNames[bundleId] = name.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );
    setPreferences(newPreferences);
    await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  function updateRunningStatus(app: Application, running: boolean) {
    const newApplications: Application[] = applications.map((a) => {
      if (a.bundleId === app.bundleId) {
        return { ...a, running: running };
      }
      return a;
    });
    setApplications(newApplications);
  }

  function onAppOpen(app: Application) {
    updateRunningStatus(app, true);
    incrementImportance(app);
  }

  async function onAppClose(app: Application) {
    updateRunningStatus(app, false);
    try {
      setIsLoading(true);
      await execPromise(`osascript -e 'tell application "${app.name}" to quit'`);
      setIsLoading(false);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to close application",
        message: String(error),
      });
    }
  }

  function incrementImportance(app: Application) {
    const newPreferences = { ...preferences };
    newPreferences.appImportance[app.bundleId ?? ""] = (newPreferences.appImportance[app.bundleId ?? ""] ?? 0) + 1;
    setPreferences(newPreferences);
    LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
  }

  const AppItem = ({ preferences, app }: { preferences: AppPreferences; app: Application }) => {
    return (
      <List.Item
        key={app.bundleId}
        icon={getAppIcon(app)}
        title={preferences.customNames[app.bundleId] || app.name}
        subtitle={preferences.customNames[app.bundleId] ? app.name : ""}
        accessories={[
          {
            icon: app.running ? { source: Icon.Bolt, tintColor: Color.Green } : undefined,
            tooltip: app.running ? "Running" : "Not Running",
          },
          {
            icon: preferences.pinnedApps.includes(app.bundleId) ? Icon.Tack : undefined,
            tooltip: "Pinned",
          },
        ]}
        actions={
          <ActionPanel>
            <Action.Open
              title={app.running ? "Go to Application" : "Open Application"}
              target={app.path}
              icon={Icon.AppWindow}
              onOpen={() => onAppOpen(app)}
            />
            {app.running && (
              <Action
                title="Close Application"
                icon={Icon.XMarkCircle}
                onAction={() => onAppClose(app)}
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
                      onRename={(name) => setCustomName(app.bundleId ?? "", name)}
                    />,
                  )
                }
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title={"General View"}>
              <Action
                title={preferences.showHidden ? "Hide All Hidden Apps" : "Show All Hidden Apps"}
                icon={preferences.showHidden ? Icon.CircleDisabled : Icon.Circle}
                onAction={() => setPreferences({ ...preferences, showHidden: !preferences.showHidden })}
              />
              <Action
                title={
                  preferences.prioritizeRunningApps ? "Ignore Running Status When Sorting" : "Pull Running Apps to Top"
                }
                icon={preferences.prioritizeRunningApps ? Icon.BoltDisabled : Icon.Bolt}
                onAction={() =>
                  setPreferences({ ...preferences, prioritizeRunningApps: !preferences.prioritizeRunningApps })
                }
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
      filtering={{
        keepSectionOrder: true,
      }}
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
