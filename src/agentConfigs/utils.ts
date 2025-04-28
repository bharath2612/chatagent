import { AgentConfig, Tool } from "@/types/types"; // Adjusted path

/**
 * Dynamically defines and adds a "transferAgents" tool to each agent
 * based on the `downstreamAgents` specified in their configuration.
 * This allows agents to know which other agents they can transfer the conversation to.
 */
export function injectTransferTools(agentDefs: AgentConfig[]): AgentConfig[] {
  // Iterate over each agent definition
  agentDefs.forEach((agentDef) => {
    // Ensure downstreamAgents is an array of AgentConfig or simple objects with name/description
    const downstreamAgents = (agentDef.downstreamAgents || []).map(dAgent => {
        // If it's already a full AgentConfig, use it
        if ('tools' in dAgent) return dAgent;
        // Otherwise, map the simple structure
        return { name: dAgent.name, publicDescription: dAgent.publicDescription };
    });

    // Only proceed if there are downstream agents
    if (downstreamAgents.length > 0) {
      // Build a list of downstream agents and their descriptions for the tool's description
      const availableAgentsList = downstreamAgents
        .map(
          (dAgent) =>
            `- ${dAgent.name}: ${dAgent.publicDescription ?? "No description"}`
        )
        .join("\n");

      // Create the transferAgents tool specific to this agent
      const transferAgentTool: Tool = {
        type: "function",
        name: "transferAgents", // Consistent tool name
        description: `Triggers a transfer of the user to a more specialized agent. 
  Only call this function if one of the available agents is appropriate for the user's request.
  Do not transfer to your own agent type (${agentDef.name}).
  Inform the user before initiating the transfer.

  Available Agents:
${availableAgentsList}
        `,
        parameters: {
          type: "object",
          properties: {
            destination_agent: {
              type: "string",
              description: "The exact name of the agent to transfer to.",
              enum: downstreamAgents.map((dAgent) => dAgent.name), // List valid destinations
            },
          },
          required: ["destination_agent"],
          additionalProperties: false,
        },
      };

      // Add the transfer tool to the agent's tools array if not already present
      if (!agentDef.tools.some(tool => tool.name === transferAgentTool.name)) {
           agentDef.tools = [...(agentDef.tools || []), transferAgentTool];
      }

      // Add placeholder toolLogic if it doesn't exist
      // The actual transfer is handled by useHandleServerEvent based on destination_agent return value
      if (!agentDef.toolLogic) {
          agentDef.toolLogic = {};
      }
      if (!agentDef.toolLogic[transferAgentTool.name]) {
          agentDef.toolLogic[transferAgentTool.name] = async (args: { destination_agent: string }) => {
               console.log(`[${agentDef.name}.transferAgents] Tool called. Transfer to ${args.destination_agent} initiated.`);
               // Signal transfer intent; actual transfer handled by hook
               return { destination_agent: args.destination_agent, success: true, message: "Transfer initiated." };
           };
      }
    }
  });

  return agentDefs;
} 