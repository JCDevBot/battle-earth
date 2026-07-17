import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("functional prototype flow contract", () => {
  it("keeps the globe-to-tactical entry path wired", () => {
    const app = source("src/App.jsx");
    const globe = source("src/components/GlobePicker.jsx");

    expect(app).toContain("<GlobePicker");
    expect(app).toContain("setStage(getStageForLocation(loc))");
    expect(app).toContain("<TacticalStage");
    expect(globe).toContain("onSelect");
    expect(globe).toContain("battleRequest");
  });

  it("keeps manual deployment and unit command controls available", () => {
    const tactical = source("src/components/TacticalStage.jsx");

    expect(tactical).toContain("Deploy Friendly");
    expect(tactical).toContain("Deploy Enemy");
    expect(tactical).toContain("setDeployModeOnEngine");
    expect(tactical).toContain("selectNextSquad");
    expect(tactical).toContain("startSelectedSquadMapCommand");
    expect(tactical).toContain("holdSelectedSquad");
    expect(tactical).toContain("retreatSelectedSquad");
  });

  it("keeps the battle loop connected to map-engine capabilities", () => {
    const tactical = source("src/components/TacticalStage.jsx");
    const engine = source("src/map/engine/MapEngine.js");

    for (const capability of [
      "setDeployMode",
      "selectNextSquad",
      "startSelectedSquadMapCommand",
      "holdSelectedSquad",
      "retreatSelectedSquad",
      "resetInfantry",
    ]) {
      expect(tactical).toContain(capability);
      expect(engine).toContain(capability);
    }
  });
});
