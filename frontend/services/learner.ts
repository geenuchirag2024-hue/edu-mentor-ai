const LEARNER_KEY = "edu-mentor-learner-id";
const NOTES_SESSION_KEY = "edu-mentor-notes-session";

export function getLearnerId(): string {
  if (typeof window === "undefined") return "anon";
  let id = window.localStorage.getItem(LEARNER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(LEARNER_KEY, id);
  }
  return id;
}

export function getNotesSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(NOTES_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(NOTES_SESSION_KEY, id);
  }
  return id;
}
