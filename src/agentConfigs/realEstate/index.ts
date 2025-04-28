import realEstateAgent from "./realEstateAgent";
import authentication from "./authentication";
import simulatedHuman from "./simulatedHuman";
import scheduleMeetingAgent from "./scheduleMeetingAgent";
import { injectTransferTools } from "../utils"; // Adjusted path
import { AgentConfig } from '@/types/types'; // Import AgentConfig type

// Define downstream agents before using injectTransferTools
const agentsToConfigure: AgentConfig[] = [realEstateAgent, authentication, simulatedHuman, scheduleMeetingAgent];

agentsToConfigure.forEach(agent => {
  if (agent.name === 'authentication') {
    agent.downstreamAgents = [realEstateAgent, simulatedHuman, scheduleMeetingAgent];
  } else if (agent.name === 'realEstate') {
    agent.downstreamAgents = [authentication, simulatedHuman, scheduleMeetingAgent];
  } else if (agent.name === 'simulatedHuman') {
    agent.downstreamAgents = [authentication, realEstateAgent, scheduleMeetingAgent];
  } else if (agent.name === 'scheduleMeeting') { // Corrected name based on import
    agent.downstreamAgents = [authentication, realEstateAgent, simulatedHuman];
  }
});

// Now inject transfer tools
const agents = injectTransferTools(agentsToConfigure);

export default agents; 