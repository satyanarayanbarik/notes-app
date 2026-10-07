import { useCallback, useEffect, useMemo, useState } from "react";

const API = "http://localhost:4000";

// Small fetch helper: sends JSON, returns parsed JSON (or null for 204)
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// "2026-10-07 19:31:32.06+00" -> a Date every browser can parse
function parseDate(value) {
  return new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
}

// Turn the flat list from the API into a nested tree
function buildTree(flat) {
  const byId = new Map(flat.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortAll = (list) => {
    list.sort(
      (a, b) =>
        a.position - b.position || a.createdAt.localeCompare(b.createdAt)
    );
    list.forEach((n) => sortAll(n.children));
  };
  sortAll(roots);
  return roots;
}

function TreeItem({ node, depth, selectedId, onSelect }) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === "folder";

  return (
    <div>
      <div
        onClick={() => {
          onSelect(node.id);
          if (isFolder) setOpen(!open);
        }}
        style={{
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          cursor: "pointer",
          background:
            node.id === selectedId ? "rgba(128,128,128,0.25)" : "transparent",
        }}
      >
        {isFolder ? (open ? "▾ 📁" : "▸ 📁") : "📄"} {node.name}
      </div>
      {isFolder &&
        open &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// The main panel. It is given key={note.id} so it resets when you open another note.
function NoteEditor({ note, onSave }) {
  const [text, setText] = useState(note.content?.text ?? "");

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0 }}>{note.name}</h2>
      <small>Created {parseDate(note.createdAt).toLocaleDateString()}</small>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(note.id, text)}
        placeholder="Start writing..."
        style={{ display: "block", width: "100%", height: "60vh", marginTop: 16 }}
      />
    </div>
  );
}

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setNodes(await api("/nodes"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const openNote = selected?.type === "note" ? selected : null;

  async function create(type) {
    const name = window.prompt(type === "folder" ? "Folder name" : "Note name");
    if (!name || !name.trim()) return;

    // Goes inside the selected folder, beside the selected note, or at the top level
    const parentId = selected
      ? selected.type === "folder"
        ? selected.id
        : selected.parentId
      : null;

    await api("/nodes", {
      method: "POST",
      body: JSON.stringify({ type, name: name.trim(), parentId }),
    });
    await load();
  }

  async function saveContent(id, text) {
    await api(`/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: { text } }),
    });
    await load();
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{ width: 260, borderRight: "1px solid #888", overflow: "auto" }}
      >
        <div style={{ display: "flex", gap: 8, padding: 8 }}>
          <button onClick={() => create("folder")}>New folder</button>
          <button onClick={() => create("note")}>New file</button>
        </div>
        {tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </aside>

      <main style={{ flex: 1, overflow: "auto" }}>
        {openNote ? (
          <NoteEditor key={openNote.id} note={openNote} onSave={saveContent} />
        ) : (
          <p style={{ padding: 24 }}>Select a note to start writing.</p>
        )}
      </main>
    </div>
  );
}