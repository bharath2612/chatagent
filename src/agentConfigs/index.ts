import { AllAgentConfigsType } from "@/types/types"; // Adjusted import path
// import frontDeskAuthentication from "./frontDeskAuthentication";
// import customerServiceRetail from "./customerServiceRetail";
// import simpleExample from "./simpleExample";
import realEstate from "./realEstate"; // Assuming ./realEstate/index.ts will exist

export const allAgentSets: AllAgentConfigsType = {
  // frontDeskAuthentication,
  // customerServiceRetail,
  // simpleExample,
  realEstate,
};

export const defaultAgentSetKey = "realEstate"; 