import { installContextualMapEngineGeneration } from "../app/contextualMapEngineIntegration.js";
import { MapEngine } from "../map/engine/MapEngine";

installContextualMapEngineGeneration(MapEngine);

export { TacticalStage } from "./TacticalStage";
