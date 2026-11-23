function shortText(value, limit) {
  const characters = Array.from(value.trim().replace(/\s+/g, " "));
  if (characters.length <= limit) return characters.join("");
  return characters.slice(0, limit - 1).join("").trimEnd() + "…";
}

export function shareDetails(entry) {
  const kind = entry.kind === "diary" ? "Diary" : entry.voice_note ? "Voice note" : "Gist";
  const author = entry.anonymous ? "Anonymous Survivor" : entry.author?.display_name ??
    (entry.system_seed ? "Survive9ja" : "a Survive9ja member");
  const title = `${kind} from ${shortText(author, 60)} on Survive9ja`;
  const detail = shortText(entry.kind === "diary" ? entry.title + " · " + entry.body : entry.body, 170);
  return {
    title,
    description: detail || "Listen to this voice note on Survive9ja.",
  };
}
