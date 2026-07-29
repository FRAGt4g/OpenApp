import { Color, Icon, List, LocalStorage } from "@raycast/api";
import { AppSpecificActionsSection, RootListActionsSection } from "./actions";
import { AppDataProvider, useAppData } from "./AppDataProvider";
import { formatKeybind } from "./imports";
import { ListStateProvider, useListState } from "./ListStateProvider";
import { Openable, OpenableFilter } from "./types";

function OpenList() {
  const { preferences, isLoading, settings } = useAppData();
  const { setSearchText, setSortType, pins, regular, hidden, exactMatch, setFilterOpenablesBy } = useListState();

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
              void LocalStorage.setItem("sortType", newSortType);
            }}
          >
            <List.Dropdown.Item title="Frecency" value="frecency" icon={Icon.Clock} />
            <List.Dropdown.Item title="Alphabetical" value="alphabetical" icon={Icon.Text} />
          </List.Dropdown>
        ) : (
          <List.Dropdown
            tooltip="Openable Types To Show"
            onChange={(value) => {
              const newFilterOpenablesBy = value as OpenableFilter;
              setFilterOpenablesBy(newFilterOpenablesBy);
              void LocalStorage.setItem("filterOpenablesBy", newFilterOpenablesBy);
            }}
          >
            <List.Dropdown.Item title="Everything" value="all" icon={Icon.AppWindowGrid2x2} />
            <List.Dropdown.Item title="Apps" value="app" icon={Icon.AppWindow} />
            <List.Dropdown.Item title="Websites" value="website" icon={Icon.Globe} />
            <List.Dropdown.Item title="Directories" value="directory" icon={Icon.Finder} />
          </List.Dropdown>
        )
      }
      actions={<RootListActionsSection />}
    >
      {exactMatch && (
        <List.Section title="Exact Match Found">
          <AppItem key={exactMatch.id} app={exactMatch} />
        </List.Section>
      )}

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

function AppItem({ app }: { app: Openable }) {
  const { preferences, settings } = useAppData();

  const keybind = preferences.quickCommands[app.id];

  const Accessories: List.Item.Accessory[] = [
    ...Object.keys(preferences.appTags[app.id] ?? {}).map((tag) => ({
      tag: tag,
      tooltip: tag,
    })),
    ...(keybind && settings.showKeybindForApps
      ? [
          {
            tag: { value: formatKeybind(keybind), color: Color.SecondaryText },
            tooltip: `Keybind: ${formatKeybind(keybind)}`,
          },
        ]
      : []),
    {
      icon: preferences.hidden.includes(app.id) && settings.showEyeIconForHiddenApps ? Icon.EyeDisabled : undefined,
      tooltip: preferences.hidden.includes(app.id) ? "Hidden" : undefined,
    },
    {
      icon: preferences.pinnedApps.includes(app.id) && settings.showPinIconForPinnedApps ? Icon.Tack : undefined,
      tooltip: preferences.pinnedApps.includes(app.id) ? "Pinned" : undefined,
    },
    {
      icon: {
        source: app.type === "app" ? Icon.AppWindow : app.type === "directory" ? Icon.Finder : Icon.Globe,
        tintColor: app.running && settings.showBoltIconForRunningApps ? Color.Green : undefined,
      },
      tooltip: app.running
        ? `Open ${app.type.charAt(0).toUpperCase() + app.type.slice(1)}`
        : `${app.type.charAt(0).toUpperCase() + app.type.slice(1)}`,
    },
  ];

  const title = preferences.customNames[app.id] || app.name;
  const subtitle = title !== app.name ? app.name : "";

  return (
    <List.Item
      icon={!settings.fastMode ? app.icon : undefined}
      title={title}
      subtitle={subtitle}
      accessories={Accessories}
      quickLook={{ path: app.path, name: title }}
      actions={<AppSpecificActionsSection app={app} />}
    />
  );
}

export default function Command() {
  return (
    <AppDataProvider>
      <ListStateProvider>
        <OpenList />
      </ListStateProvider>
    </AppDataProvider>
  );
}
