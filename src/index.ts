#!/usr/bin/env node
import { GoogleWorkspaceMCPServer } from "./server.js";

const server = new GoogleWorkspaceMCPServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

