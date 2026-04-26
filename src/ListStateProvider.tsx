import Fuse from "fuse.js";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useAppData } from "./AppDataProvider";
import { Openable, SortType } from "./types";

type ListStateContextType = {
  searchText: string;
  setSearchText: (t: string) => void;
  sortType: SortType;
  setSortType: (s: SortType) => void;
  lambdaDecay: number;
  fuzzySearchThreshold: number;
  timeScale: number;
  allOpenables: Openable[];
  passesSearchFilter: (app: Openable) => { passes: boolean; score: number };
  calcFrecencyValue: (appId: string) => number;
  sortFunction: (a: Openable, b: Openable) => number;
  pins: Openable[];
  regular: Openable[];
  notHidden: Openable[];
  hidden: Openable[];
  exactMatch: Openable | null;
};

const ListStateContext = createContext<ListStateContextType | undefined>(undefined);

export const ListStateProvider = ({ children }: { children: ReactNode }) => {
  const { settings, preferences, applications, websites, directories, hitHistory } = useAppData();
  const [searchText, setSearchText] = useState("");
  const [sortType, setSortType] = useState<SortType>("frecency");

  const [lambdaDecay, fuzzySearchThreshold, timeScale] = useMemo(
    () => [
      parseFloat(settings.lambdaDecayDropdown),
      parseFloat(settings.fuzzySearchThresholdDropdown),
      parseFloat(settings.timeScaleDropdown),
    ],
    [settings],
  );

  const allOpenables = useMemo(
    () => applications.concat(websites).concat(directories),
    [applications, websites, directories],
  );

  const exactMatch = useMemo(() => {
    return (
      allOpenables.find(
        (openable) =>
          !preferences.hidden.includes(openable.id) &&
          (openable.name.toLowerCase() === searchText.toLowerCase() ||
            (preferences.customNames[openable.id] &&
              preferences.customNames[openable.id].toLowerCase() === searchText.toLowerCase())),
      ) ?? null
    );
  }, [allOpenables, searchText, preferences]);

  const passesSearchFilter = useMemo(() => {
    return function passesSearchFilterImpl(app: Openable): { passes: boolean; score: number } {
      if (!searchText) return { passes: true, score: 1 };

      const options = {
        includeScore: true,
        threshold: fuzzySearchThreshold,
        keys: [
          { name: "name", weight: 0.3 },
          { name: "customName", weight: 0.7 },
        ],
      };

      const searchWords = searchText
        .toLowerCase()
        .split(" ")
        .filter((word) => word !== "");
      const appNameWords = app.name
        .toLowerCase()
        .split(" ")
        .filter((word) => word !== "");
      const customNameWords = (preferences.customNames[app.id] || "")
        .toLowerCase()
        .split(" ")
        .filter((word) => word !== "");

      let totalScore = 0;
      let matchedWords = 0;

      for (const searchWord of searchWords) {
        let bestWordScore = 0;

        for (const targetWord of [...appNameWords, ...customNameWords]) {
          const fuse = new Fuse([{ word: targetWord }], {
            ...options,
            keys: ["word"],
          });

          const result = fuse.search(searchWord);
          if (result.length > 0) {
            const wordScore = 1 - (result[0]!.score ?? 1);
            bestWordScore = Math.max(bestWordScore, wordScore);
          }
        }

        if (bestWordScore > 0) {
          totalScore += bestWordScore;
          matchedWords++;
        }
      }

      const finalScore = matchedWords > 0 ? totalScore / searchWords.length : 0;

      return {
        passes:
          searchText.includes(" ") && !app.name.includes(" ") && !preferences.customNames[app.id]?.includes(" ")
            ? false
            : matchedWords === searchWords.length,
        score: finalScore,
      };
    };
  }, [searchText, fuzzySearchThreshold, preferences]);

  const calcFrecencyValue = useMemo(() => {
    return function calcFrecencyValueImpl(appId: string) {
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
    };
  }, [hitHistory, lambdaDecay, timeScale]);

  const sortFunction = useMemo(() => {
    return (a: Openable, b: Openable) => {
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
    };
  }, [calcFrecencyValue, passesSearchFilter, preferences.prioritizeRunningApps, sortType]);

  const { pins, regular, notHidden, hidden } = useMemo(() => {
    const pins: Openable[] = [];
    const regular: Openable[] = [];
    const notHidden: Openable[] = [];
    const hidden: Openable[] = [];

    for (const app of allOpenables) {
      if (!passesSearchFilter(app).passes) continue;
      const isHidden = preferences.hidden.includes(app.id);
      const isPinned = preferences.pinnedApps.includes(app.id);

      if (isHidden) hidden.push(app);
      else notHidden.push(app);

      if (isPinned) pins.push(app);
      else if (!isHidden) regular.push(app);
    }

    pins.sort(sortFunction);
    regular.sort(sortFunction);
    notHidden.sort(sortFunction);
    hidden.sort(sortFunction);

    return { pins, regular, notHidden, hidden };
  }, [allOpenables, preferences, sortFunction, passesSearchFilter]);

  return (
    <ListStateContext.Provider
      value={{
        searchText,
        setSearchText,
        sortType,
        setSortType,
        lambdaDecay,
        fuzzySearchThreshold,
        timeScale,
        allOpenables,
        passesSearchFilter,
        calcFrecencyValue,
        sortFunction,
        pins,
        regular,
        notHidden,
        hidden,
        exactMatch,
      }}
    >
      {children}
    </ListStateContext.Provider>
  );
};

export const useListState = () => {
  const ctx = useContext(ListStateContext);
  if (!ctx) {
    throw new Error("useListState must be used within ListStateProvider");
  }
  return ctx;
};
