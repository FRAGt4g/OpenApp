import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import fetch from "node-fetch";
import { useAppData } from "./AppDataProvider";
import EditOpenable, { ChangedValues } from "./EditOpenable";
import { asyncGetAppIcon, getIconType, runTerminalCommand } from "./imports";
import { useListState } from "./ListStateProvider";
import NewOpenable from "./NewOpenable";
import SetKeybind from "./SetKeybind";
import { AppPreferences, Openable } from "./types";

/**
 *     + –––––––––––––––––––––––––––––––––––––––––––– +
 *     |     All General and App Specific Actions     |
 *     + –––––––––––––––––––––––––––––––––––––––––––– +
 */
async function debug(
  websites: Openable[],
  directories: Openable[],
  updateStoredWebsites: (websites: Openable[]) => Promise<void>,
  updateStoredDirectories: (directories: Openable[]) => Promise<void>,
) {
  const newWebsites = websites;
  const newDirectories = directories;
  for (const website of websites) {
    if (getIconType(website.icon) === "Raycast Icon") {
      website.icon = JSON.stringify({
        source: website.icon,
        tintColor: "PrimaryText",
      });
    }
  }
  for (const directory of directories) {
    if (getIconType(directory.icon) === "Raycast Icon") {
      directory.icon = JSON.stringify({
        source: directory.icon,
        tintColor: "PrimaryText",
      });
    }
  }
  await updateStoredWebsites(newWebsites);
  await updateStoredDirectories(newDirectories);
}

export const DebugAction = () => {
  const { websites, directories, updateStoredWebsites, updateStoredDirectories } = useAppData();

  return (
    <Action
      title="Debug"
      icon={Icon.Bug}
      onAction={() => {
        debug(websites, directories, updateStoredWebsites, updateStoredDirectories);
      }}
    />
  );
};

export const AddWebsiteOrDirectoryAction = () => {
  const { push } = useNavigation();
  const { preferences, setPreferences, websites, setWebsites, directories, setDirectories } = useAppData();

  return (
    <Action
      title="Add Website / File Directory"
      icon={Icon.Plus}
      onAction={() =>
        push(
          <NewOpenable
            onSave={async (name, path, type, opener, icon) => {
              if (!icon) {
                if (type === "website") {
                  const result = await fetch(path + "/favicon.ico").catch(() => ({ ok: false }));
                  icon = result.ok ? path + "/favicon.ico" : Icon.Globe;
                } else {
                  icon = Icon.Folder;
                }
              }
              const soonToBeOpenables: Openable[] = [
                ...(type === "website" ? websites : directories),
                {
                  id: path,
                  name: name,
                  path: path,
                  running: false,
                  icon: icon,
                  type: type,
                },
              ];
              if (opener) {
                const newPreferences = { ...preferences };
                newPreferences.customDirectoryOpeners[path] = opener;
                setPreferences(newPreferences);
                await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
              }
              if (type === "website") {
                setWebsites(soonToBeOpenables);
                await LocalStorage.setItem("websites", JSON.stringify(soonToBeOpenables));
              } else {
                setDirectories(soonToBeOpenables);
                await LocalStorage.setItem("directories", JSON.stringify(soonToBeOpenables));
              }
            }}
          />,
        )
      }
      shortcut={{ modifiers: ["cmd"], key: "n" }}
    />
  );
};

const ToggleHiddenAppsAction = () => {
  const { preferences, toggleShowingHiddenOpenables } = useAppData();
  return (
    <Action
      title={preferences.showHidden ? "Don't Show Hidden Apps" : "Show All Hidden Apps"}
      icon={preferences.showHidden ? Icon.EyeDisabled : Icon.Eye}
      onAction={() => void toggleShowingHiddenOpenables()}
      shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
    />
  );
};

const ResetFrecencyValuesAction = () => {
  const { setHitHistory } = useAppData();
  return (
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
          await LocalStorage.setItem("hitHistory", JSON.stringify({}));
          showToast({
            style: Toast.Style.Success,
            title: "Frecency values reset",
          });
        }
      }}
    />
  );
};

const ClearIconCacheAction = () => {
  const { preferences, setPreferences } = useAppData();
  return (
    <Action
      title="Clear Icon Cache"
      icon={Icon.Trash}
      onAction={() => {
        void LocalStorage.setItem("appPreferences", JSON.stringify({ ...preferences, cachedIconDirectories: {} }));
        setPreferences({ ...preferences, cachedIconDirectories: {} });
      }}
    />
  );
};

const TogglePrioritizeRunningAppsAction = () => {
  const { preferences, togglePrioritizeRunningApps } = useAppData();
  const { settings } = useAppData();
  return (
    !settings.fastMode && (
      <Action
        title={preferences.prioritizeRunningApps ? "Don't Prioritize Running Apps" : "Prioritize Running Apps"}
        icon={Icon.ChevronUpDown}
        onAction={() => void togglePrioritizeRunningApps()}
      />
    )
  );
};

export function SearchInBrowserAction({ searchText }: { searchText: string }) {
  return (
    <Action.Open
      title={`Search "${searchText}" in Browser`}
      target={`https://www.google.com/search?q=${searchText}`}
      application="default"
      icon={Icon.Globe}
    />
  );
}

function CloseAppAction({ app }: { app: Openable }) {
  const { setIsLoading, setAppRunningStatus } = useAppData();

  return (
    app.running && (
      <Action
        title={`Close ${app.type}`}
        icon={Icon.XMarkCircle}
        onAction={async () => {
          setAppRunningStatus(app, false);
          setIsLoading(true);
          try {
            await runTerminalCommand(`osascript -e 'tell application "${app.name}" to quit'`);
          } catch (error) {
            await showToast({
              style: Toast.Style.Failure,
              title: `Failed to close ${app.type}`,
              message: String(error),
            });
          } finally {
            setIsLoading(false);
          }
        }}
        shortcut={{ modifiers: ["ctrl"], key: "x" }}
      />
    )
  );
}

function PinAppAction({ app }: { app: Openable }) {
  const { preferences, toggle } = useAppData();
  return (
    <Action
      title={preferences.pinnedApps.includes(app.id) ? "Unpin" : "Pin"}
      icon={preferences.pinnedApps.includes(app.id) ? Icon.PinDisabled : Icon.Pin}
      onAction={() => void toggle("pinnedApps", app.id)}
      shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
    />
  );
}

function HideAppAction({ app }: { app: Openable }) {
  const { preferences, toggle } = useAppData();
  return (
    <Action
      title={preferences.hidden.includes(app.id) ? "Un-hide" : "Hide"}
      icon={preferences.hidden.includes(app.id) ? Icon.Eye : Icon.EyeDisabled}
      onAction={() => void toggle("hidden", app.id)}
      shortcut={{ modifiers: ["cmd"], key: "h" }}
    />
  );
}

function RemoveCustomIconAction({ app }: { app: Openable }) {
  const { preferences, setPreferences } = useAppData();
  return (
    preferences.cachedIconDirectories[app.id]?.custom && (
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
    )
  );
}

function IgnoreRunningStatusAction({ app }: { app: Openable }) {
  const { preferences, settings, toggle } = useAppData();
  return (
    !settings.fastMode &&
    app.type === "app" && (
      <Action
        title={preferences.appsWithoutRunningCheck.includes(app.id) ? "Check Running Status" : "Ignore Running Status"}
        icon={preferences.appsWithoutRunningCheck.includes(app.id) ? Icon.Bolt : Icon.BoltDisabled}
        onAction={() => void toggle("appsWithoutRunningCheck", app.id)}
        shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
      />
    )
  );
}

function RemoveCustomNameAction({ app }: { app: Openable }) {
  const { preferences, setPreferences } = useAppData();
  return (
    preferences.customNames[app.id] && (
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
    )
  );
}

function DeleteWebsiteOrDirectoryAction({ app }: { app: Openable }) {
  const { preferences, setPreferences, websites, setWebsites, directories, setDirectories } = useAppData();
  return (
    app.type !== "app" && (
      <Action
        title="Delete"
        icon={Icon.Trash}
        onAction={async () => {
          if (
            await confirmAlert({
              title: "Are you sure?",
              message: `This will delete the ${app.type} from the list of things you can open and reset the frecency value.`,
              primaryAction: {
                title: "Delete",
                style: Alert.ActionStyle.Destructive,
              },
            })
          ) {
            if (app.type === "website") {
              const newWebsites = websites.filter((website) => website.id !== app.id);
              setWebsites(newWebsites);
              await LocalStorage.setItem("websites", JSON.stringify(newWebsites));
            } else {
              const newDirectories = directories.filter((directory) => directory.id !== app.id);
              setDirectories(newDirectories);
              await LocalStorage.setItem("directories", JSON.stringify(newDirectories));
            }
            for (const option of Object.keys(preferences)) {
              const key = option as keyof AppPreferences;
              if (Array.isArray(preferences[key])) {
                (preferences[key] as string[]) = (preferences[key] as string[]).filter((id) => id !== app.id);
              } else if (typeof preferences[key] === "object" && preferences[key] !== null) {
                delete (preferences[key] as Record<string, unknown>)[app.id];
              }
            }
            setPreferences(preferences);
            await LocalStorage.setItem("appPreferences", JSON.stringify(preferences));
            showToast({
              style: Toast.Style.Success,
              title: `"${app.name}" has been deleted!`,
            });
          }
        }}
        shortcut={{ modifiers: ["ctrl"], key: "x" }}
      />
    )
  );
}

function RefreshAppIconAction({ app }: { app: Openable }) {
  const { preferences, setPreferences, setIsLoading } = useAppData();
  return (
    app.type === "app" && (
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
          app.icon = newIconPath;
          await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
          setIsLoading(false);
        }}
      />
    )
  );
}

function SetKeybindAction({ app }: { app: Openable }) {
  const { preferences, updateStoredPreferences } = useAppData();
  const { push } = useNavigation();
  const existing = preferences.quickCommands[app.id];

  return (
    <Action
      title={existing ? "Change Keybind" : "Set Keybind"}
      icon={Icon.Keyboard}
      shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
      onAction={() =>
        push(
          <SetKeybind
            appName={preferences.customNames[app.id] || app.name}
            initial={existing}
            onSave={async (shortcut) => {
              await updateStoredPreferences({
                quickCommands: { ...preferences.quickCommands, [app.id]: shortcut },
              });
            }}
          />,
        )
      }
    />
  );
}

function RemoveKeybindAction({ app }: { app: Openable }) {
  const { preferences, updateStoredPreferences } = useAppData();
  return (
    !!preferences.quickCommands[app.id] && (
      <Action
        title="Remove Keybind"
        icon={Icon.XMarkCircle}
        onAction={async () => {
          const newQuickCommands = { ...preferences.quickCommands };
          delete newQuickCommands[app.id];
          await updateStoredPreferences({ quickCommands: newQuickCommands });
          showToast({
            style: Toast.Style.Success,
            title: `Keybind for ${preferences.customNames[app.id] || app.name} removed`,
          });
        }}
      />
    )
  );
}

/**
 * Renders an open action for every openable that has a keybind assigned, each bound to its
 * shortcut. Including this in every item's panel makes the keybinds work no matter which item
 * is currently selected, turning them into list-wide quick commands.
 */
function QuickCommandsSection() {
  const { preferences, setAppRunningStatus, incrementFrecency } = useAppData();
  const { allOpenables } = useListState();

  const boundApps = allOpenables.filter((app) => preferences.quickCommands[app.id]);
  if (boundApps.length === 0) return null;

  return (
    <ActionPanel.Section title="Keybinds">
      {boundApps.map((app) => {
        const useCustomOpener = app.type === "directory" && !!preferences.customDirectoryOpeners[app.id];
        const title = preferences.customNames[app.id] || app.name;
        return (
          <Action.Open
            key={app.id}
            title={`Open ${title}`}
            target={app.path}
            application={useCustomOpener ? preferences.customDirectoryOpeners[app.id] : "default"}
            icon={app.icon}
            shortcut={preferences.quickCommands[app.id]}
            onOpen={() => {
              setAppRunningStatus(app, true);
              incrementFrecency(app);
            }}
          />
        );
      })}
    </ActionPanel.Section>
  );
}

function EditOpenableAction({ app }: { app: Openable }) {
  const { preferences, setPreferences, websites, setWebsites, directories, setDirectories, getOpeners } = useAppData();
  const { push } = useNavigation();

  const icon = preferences.cachedIconDirectories[app.id]?.custom || app.icon;
  // const iconString =
  //   typeof icon === "object" ? ("fileIcon" in icon ? icon.fileIcon.toString() : icon.source.toString()) : icon;

  return (
    <Action
      title="Edit"
      icon={Icon.Pencil}
      onAction={() =>
        push(
          <EditOpenable
            startCondition={{
              ...app,
              icon: icon,
              name: preferences.customNames[app.id] ?? "",
              defaultName: app.name,
            }}
            gatherOpeners={() => getOpeners(app)}
            defaultOpener={preferences.customDirectoryOpeners[app.id] ?? "Finder"}
            onSave={async (changedValues: ChangedValues) => {
              if (changedValues.sourcePath) {
                if (app.type === "website") {
                  websites.find((website) => website.id === app.id)!.path = changedValues.sourcePath;
                  setWebsites(websites);
                  await LocalStorage.setItem("websites", JSON.stringify(websites));
                } else {
                  directories.find((directory) => directory.id === app.id)!.path = changedValues.sourcePath;
                  setDirectories(directories);
                  await LocalStorage.setItem("directories", JSON.stringify(directories));
                }
              }
              if (changedValues.defaultName) {
                if (app.type === "website") {
                  websites.find((website) => website.id === app.id)!.name = changedValues.defaultName;
                  setWebsites(websites);
                  await LocalStorage.setItem("websites", JSON.stringify(websites));
                } else {
                  directories.find((directory) => directory.id === app.id)!.name = changedValues.defaultName;
                  setDirectories(directories);
                  await LocalStorage.setItem("directories", JSON.stringify(directories));
                }
              }
              if (changedValues.nickname !== undefined) {
                const newPreferences = { ...preferences };
                if (changedValues.nickname === "") {
                  delete newPreferences.customNames[app.id]; // remove the nickname
                } else {
                  newPreferences.customNames[app.id] = changedValues.nickname;
                }
                setPreferences(newPreferences);
                await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
              }
              if (changedValues.icon) {
                const newPreferences = { ...preferences };
                console.log("[changedValues.icon]", changedValues.icon);
                if (!newPreferences.cachedIconDirectories[app.id]) {
                  newPreferences.cachedIconDirectories[app.id] = {
                    default: app.icon,
                    custom: null,
                  };
                }
                newPreferences.cachedIconDirectories[app.id].custom = changedValues.icon;
                setPreferences(newPreferences);
                app.icon = changedValues.icon;
                await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
              }
              if (changedValues.opener) {
                const newPreferences = { ...preferences };
                newPreferences.customDirectoryOpeners[app.id] = changedValues.opener;
                setPreferences(newPreferences);
                await LocalStorage.setItem("appPreferences", JSON.stringify(newPreferences));
              }
            }}
          />,
        )
      }
      shortcut={{ modifiers: ["cmd"], key: "e" }}
    />
  );
}

const OpenAppAction = ({ app }: { app: Openable }) => {
  const { preferences, setAppRunningStatus, incrementFrecency } = useAppData();
  let actionTitle = "";
  if (app.type === "directory" && preferences.customDirectoryOpeners[app.id]) {
    actionTitle = `Open with ${preferences.customDirectoryOpeners[app.id]}`;
  } else if (app.running) {
    actionTitle = `Switch to tab`;
  } else if (app.type === "app") {
    actionTitle = `Open app`;
  } else {
    actionTitle = `Open in browser`;
  }

  return (
    <Action.Open
      title={actionTitle}
      target={app.path}
      application={
        app.type === "directory" && preferences.customDirectoryOpeners[app.id]
          ? preferences.customDirectoryOpeners[app.id]
          : "default"
      }
      icon={Icon.AppWindow}
      onOpen={() => {
        setAppRunningStatus(app, true);
        incrementFrecency(app);
      }}
    />
  );
};

function QuickLookAction({ app }: { app: Openable }) {
  return app.type === "directory" && <Action.ToggleQuickLook title="Open Directory" icon={Icon.MagnifyingGlass} />;
}

/**
 *     + ––––––––––––––––––––––––––––––––––––––––––––– +
 *     |     All General and App Specific Sections     |
 *     + ––––––––––––––––––––––––––––––––––––––––––––– +
 */

export function AppSpecificActionsSection({ app }: { app: Openable }) {
  const { searchText } = useListState();

  return (
    <ActionPanel>
      <ActionPanel.Section title="Quick Actions">
        <OpenAppAction app={app} />
        {searchText.length > 0 && <SearchInBrowserAction searchText={searchText} />}
      </ActionPanel.Section>

      <ActionPanel.Section title="App Specific">
        <CloseAppAction app={app} />
        <EditOpenableAction app={app} />
        <DeleteWebsiteOrDirectoryAction app={app} />
        <PinAppAction app={app} />
        <HideAppAction app={app} />
        <SetKeybindAction app={app} />
        <RemoveKeybindAction app={app} />
        <QuickLookAction app={app} />
        <IgnoreRunningStatusAction app={app} />
        <RemoveCustomIconAction app={app} />
        <RemoveCustomNameAction app={app} />
        <RefreshAppIconAction app={app} />
      </ActionPanel.Section>
      <QuickCommandsSection />
      <GeneralActionsSection />
    </ActionPanel>
  );
}

const GeneralQuickActionsSection = () => {
  const { searchText } = useListState();

  return (
    <ActionPanel.Section title="Quick Actions">
      <Action title="Do Nothing" icon={Icon.XMarkCircle} onAction={async () => {}} />
      <SearchInBrowserAction searchText={searchText} />
    </ActionPanel.Section>
  );
};

export function RootListActionsSection() {
  return (
    <ActionPanel>
      <GeneralQuickActionsSection />
      <QuickCommandsSection />
      <GeneralActionsSection />
    </ActionPanel>
  );
}

export function GeneralActionsSection() {
  return (
    <ActionPanel.Section title="General">
      <AddWebsiteOrDirectoryAction />
      <ToggleHiddenAppsAction />
      <TogglePrioritizeRunningAppsAction />
      <ResetFrecencyValuesAction />
      <ClearIconCacheAction />
      {/* <DebugAction /> */}
    </ActionPanel.Section>
  );
}
