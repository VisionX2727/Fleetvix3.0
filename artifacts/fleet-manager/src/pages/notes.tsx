import { Layout } from "@/components/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FleetNote, useStore } from "@/lib/store";
import { Edit3, FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRole } from "@/lib/role";

const today = () => new Date().toISOString().split("T")[0];

export default function Notes() {
  const { state, dispatch } = useStore();
  const { role } = useRole();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<FleetNote | null>(null);
  const [text, setText] = useState("");

  const openNew = () => {
    setEditing(null);
    setText("");
    setIsOpen(true);
  };

  const openEdit = (note: FleetNote) => {
    setEditing(note);
    setText(note.text);
    setIsOpen(true);
  };

  const saveNote = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (editing) {
      dispatch({ type: "UPDATE_NOTE", payload: { id: editing.id, text: value, updatedAt: today() } });
    } else {
      dispatch({ type: "ADD_NOTE", payload: { date: today(), text: value, ...(role === "driver" ? { driverId: state.drivers[0]?.id } : {}) } });
    }
    setIsOpen(false);
    setEditing(null);
    setText("");
  };

  return (
    <Layout>
      <header className="fm-page-header">
        <div><h1>Notes</h1><p>Keep quick reminders for your fleet work.</p></div>
        <button type="button" onClick={openNew} className="fm-icon-button fm-primary-icon" aria-label="Add note"><Plus size={24} strokeWidth={3} /></button>
      </header>
      <main className="fm-page-content space-y-4 pb-24">
        {state.notes.length === 0 ? (
          <div className="fm-empty-state min-h-56 rounded-2xl border border-border bg-card">
            <FileText size={48} />
            <p>No notes yet</p>
            <button type="button" onClick={openNew} className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Add Note</button>
          </div>
        ) : (
          state.notes.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map((note) => (
            <article key={note.id} className="rounded-2xl border border-[#244a7a] bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-base leading-6 text-foreground">{note.text}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEdit(note)} className="rounded-lg p-2 text-primary" aria-label="Edit note"><Edit3 size={17} /></button>
                  <button type="button" onClick={() => { if (window.confirm("Delete this note?")) dispatch({ type: "DELETE_NOTE", payload: note.id }); }} className="rounded-lg p-2 text-rose-300" aria-label="Delete note"><Trash2 size={17} /></button>
                </div>
              </div>
              <div className="mt-3 text-xs font-semibold text-muted-foreground">
                Added: {note.date}{note.updatedAt ? ` • Edited: ${note.updatedAt}` : ""}
              </div>
            </article>
          ))
        )}
      </main>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black">{editing ? "Edit Note" : "Add Note"}</DialogTitle></DialogHeader>
          <form onSubmit={saveNote} className="space-y-4 pt-2">
            <textarea autoFocus required value={text} onChange={(event) => setText(event.target.value)} placeholder="Type anything you want to remember..." className="min-h-36 w-full resize-y rounded-xl bg-muted p-4 font-semibold outline-none focus:ring-2 focus:ring-primary" />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-border p-3 font-bold">Cancel</button>
              <button type="submit" className="rounded-xl bg-primary p-3 font-bold text-primary-foreground">{editing ? "Save Changes" : "Add Note"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}