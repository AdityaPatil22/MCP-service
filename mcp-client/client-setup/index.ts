import readline from "readline/promises";
import { MCPService } from "./services/MCPService.js";
import { LLMService } from "./services/LLMService.js";
import { ToolService } from "./services/ToolService.js";
import { ToolSelectorService } from "./services/ToolSelectorService.js";
import { formatToolResult } from "./utils/formatters.js";
import { config } from "./config/config.js";

class MCPClient {
  private mcpService: MCPService;
  private llmService: LLMService;
  private toolService: ToolService;
  private toolSelector: ToolSelectorService; 

  constructor() {
    this.mcpService = new MCPService();
    this.llmService = new LLMService(() => this.mcpService.tools);
    this.toolService = new ToolService();
    this.toolSelector = new ToolSelectorService();
  }

  async initialize(serverScriptPath: string): Promise<void> {
    await this.mcpService.connectToServer(serverScriptPath);
    console.log("Connected to server with tools:", this.mcpService.tools.map(({ name }) => name));
  }

  async processQuery(query: string): Promise<string> {
    try {
      // Step 1: Get all available tool names from MCPService and pass them, along with the user query, to ToolSelectorService to determine which tools to use.
      const availableToolNames = this.mcpService.tools.map(t => t.name);
      const selectedToolNames = await this.toolSelector.selectTool(query, availableToolNames);

      console.log("Tools suggested for this query:", selectedToolNames);

      // Step 2: Pass the selected tool names to LLMService, even if no tools are selected.
      this.llmService.setSelectedTools(selectedToolNames || []);

      // Step 3: Send the original query to the LLM (language model) service and capture the response.
      const ollamaResponse = await this.llmService.callModelAPI(query);
      const responseContent = ollamaResponse.message?.content || "No response";

      // Extract tool call instructions (if any) from the model's response.
      const toolCalls = this.toolService.parseToolCalls(ollamaResponse);

      // If no tool calls were suggested by the model, return the response as-is.
      if (!toolCalls || toolCalls.length === 0) {
        return responseContent;
      }

      // Assume a specific tool is being used
      const toolCall = toolCalls[0];
      const toolName = toolCall.name;

      // Normalize and prepare the tool arguments for execution.
      const toolArgs = this.toolService.normalizeToolArguments(toolCall.arguments);

      // Call the actual tool via MCPService and get the result.
      const result = await this.mcpService.callTool(toolName, toolArgs);
      const formattedResult = formatToolResult(result);

      // Create a new prompt for the model to analyze the tool's output.
      const analysisPrompt = `Analyze the following data and provide insights:\n${formattedResult}`;
      const analysisResponse = await this.llmService.callModelAPI(analysisPrompt);
      const analysisContent = analysisResponse.message?.content || "No analysis provided.";

      // Construct the final response, including tool call results and analysis.
      const finalResponse = `${responseContent}\n\nAnalysis:\n${analysisContent}`;

      return finalResponse;
    } catch (error) {
      // In case of any error during the process, return a generic error message with details.
      return `An error occurred while processing your query: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async chatLoop(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client with Ollama Started!");
      console.log(`Using Ollama model: ${config.ollama.model}`);
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") break;

        const response = await this.processQuery(message);
        console.log("\n" + response);
      }

      console.log("\nAvailable tools:");
      this.mcpService.tools.forEach(tool => {
        console.log(`- ${tool.name}`);
      });

    } finally {
      rl.close();
    }
  }
}

async function main(): Promise<void> {
  const buildPaths = ["../../packages/cve/build/index.js", "../../packages/labs/build/index.js", "../../packages/weather/build/index.js", "../../packages/products/build/index.js"]
  if (buildPaths.length === 0) {
    console.log("Usage: node index.js <path1> <path2> ...");
    return;
  }

  const mcpClient = new MCPClient();

  try {
    for (const path of buildPaths) {
      await mcpClient.initialize(path);
    }

    await mcpClient.chatLoop();
  } finally {
    process.exit(0);
  }
}

main();
