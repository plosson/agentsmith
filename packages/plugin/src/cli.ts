const args = process.argv.slice(2);
const command = args[0];

if (command === "hook") {
  const eventIdx = args.indexOf("--event");
  const eventType = eventIdx !== -1 ? args[eventIdx + 1] : undefined;

  if (!eventType) {
    console.error("Missing --event argument");
    process.exit(1);
  }

  // TODO: implement hook handler
  console.log(`[agentsmith] hook: ${eventType}`);
  process.exit(0);
}

if (command === "auth") {
  // TODO: implement auth flow
  console.log("[agentsmith] auth: not yet implemented");
  process.exit(0);
}

if (command === "version") {
  console.log("agentsmith 0.1.0");
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
console.error("Usage: agentsmith <hook|auth|version> [options]");
process.exit(1);
