import { createHash } from "node:crypto";

export function normalizeInstantGameCommand(input) {
  const command = {
    game: input?.game,
    bet: input?.bet,
  };
  if (input?.choice !== undefined) command.choice = input.choice;
  return command;
}

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashInstantGameCommand(input) {
  return createHash("sha256")
    .update(stableSerialize(normalizeInstantGameCommand(input)))
    .digest("hex");
}

export function commandScope(session) {
  return session.userId ? `user:${session.userId}` : `session:${session.id}`;
}
