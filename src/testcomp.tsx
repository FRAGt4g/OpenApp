import { Action, Application, Icon } from "@raycast/api";
import { useState } from "react";
const TEST_COMP = () => {
  const [availableOpenerApps, setAvailableOpenerApps] = useState<Application[]>([]);
  return {
    setOpenerApps: (apps: Application[]) => setAvailableOpenerApps(apps),
    render: (
      <Action
        title="Test Log"
        icon={Icon.Globe}
        onAction={() => {
          console.log(`Available Opener Apps: ${availableOpenerApps.map((opener) => opener.name).join(", ")}`);
        }}
      />
    ),
  };
};

export default TEST_COMP;
