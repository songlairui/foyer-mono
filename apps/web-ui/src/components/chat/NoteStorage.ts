export interface ChatNote {
  id: string;
  content: string;
  context: string;
  createdAt: number;
}

const STORAGE_KEY = "foyer.chat.notes";

function loadNotes(): ChatNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatNote[]) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: ChatNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function addNote(content: string, context: string): ChatNote {
  const notes = loadNotes();
  const note: ChatNote = {
    id: crypto.randomUUID(),
    content,
    context,
    createdAt: Date.now(),
  };
  notes.push(note);
  saveNotes(notes);
  return note;
}

export function getNotes(): ChatNote[] {
  return loadNotes();
}
