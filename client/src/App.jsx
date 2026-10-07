import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
const API = "http://localhost:4000";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function parseDate(value) {
  return new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
}

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

const iconButton = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0 4px",
  color: "inherit",
};

function TreeItem({ node, depth, selectedId, onSelect, onRename, onDelete }) {
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const cancelled = useRef(false);
  const isFolder = node.type === "folder";

  function startEdit() {
    setDraft(node.name);
    setEditing(true);
  }

  function finishEdit() {
    setEditing(false);
    const name = draft.trim();
    if (!cancelled.current && name && name !== node.name) {
      onRename(node.id, name);
    }
    cancelled.current = false;
  }

  const icon = isFolder ? (open ? "▾ 📁" : "▸ 📁") : "📄";

  return (
    <div>
      <div
        onClick={() => {
          onSelect(node.id);
          if (isFolder) setOpen(!open);
        }}
        onDoubleClick={startEdit}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `4px 8px 4px ${8 + depth * 16}px`,
          cursor: "pointer",
          background:
            node.id === selectedId ? "rgba(128,128,128,0.25)" : "transparent",
        }}
      >
        {editing ? (
          <span style={{ display: "flex", gap: 4, flex: 1 }}>
            {icon}
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  cancelled.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={finishEdit}
              style={{ flex: 1, minWidth: 0 }}
            />
          </span>
        ) : (
          <span>
            {icon} {node.name}
          </span>
        )}

        {hover && !editing && (
          <span>
            <button
              title="Rename"
              style={iconButton}
              onClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
            >
              ✎
            </button>
            <button
              title="Delete"
              style={iconButton}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
            >
              ✕
            </button>
          </span>
        )}
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
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// Old notes saved as { text } get converted; new ones are stored as TipTap JSON
function toDoc(content) {
  if (content?.type === "doc") return content;
  if (content?.text) {
    return {
      type: "doc",
      content: content.text.split("\n").map((line) =>
        line
          ? { type: "paragraph", content: [{ type: "text", text: line }] }
          : { type: "paragraph" }
      ),
    };
  }
  return { type: "doc", content: [{ type: "paragraph" }] };
}

const STATUS_LABEL = {
  saved: "Saved",
  unsaved: "Unsaved changes...",
  saving: "Saving...",
  error: "Could not save, will retry on your next edit",
};

function NoteEditor({ note, onSave }) {
  const [status, setStatus] = useState("saved");
  const timer = useRef(null);
  const pending = useRef(null); // latest unsaved document, or null
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const doc = pending.current;
    if (!doc) return;
    pending.current = null;
    setStatus("saving");
    try {
      await onSaveRef.current(note.id, doc);
      setStatus(pending.current ? "unsaved" : "saved");
    } catch {
      pending.current = pending.current ?? doc; // keep it so the next edit retries
      setStatus("error");
    }
  }, [note.id]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: toDoc(note.content),
    shouldRerenderOnTransaction: true, // keeps toolbar buttons in sync
    onUpdate: ({ editor }) => {
      pending.current = editor.getJSON();
      setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 800); // save 0.8s after you stop typing
    },
  });

  // Save anything still pending when you switch notes or leave the page
  useEffect(() => () => flush(), [flush]);
  useEffect(() => {
    const warn = (e) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (!editor) return null;

  const btn = (label, active, run) => (
    <button
      key={label}
      onClick={run}
      style={{ fontWeight: active ? "bold" : "normal", marginRight: 4 }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0 }}>{note.name}</h2>
      <small>
        Created {parseDate(note.createdAt).toLocaleDateString()} ·{" "}
        {STATUS_LABEL[status]}
      </small>

      <div style={{ margin: "16px 0 8px" }}>
        {btn("B", editor.isActive("bold"), () =>
          editor.chain().focus().toggleBold().run()
        )}
        {btn("I", editor.isActive("italic"), () =>
          editor.chain().focus().toggleItalic().run()
        )}
        {btn("H2", editor.isActive("heading", { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        )}
        {btn("List", editor.isActive("bulletList"), () =>
          editor.chain().focus().toggleBulletList().run()
        )}
        {btn("Code block", editor.isActive("codeBlock"), () =>
          editor.chain().focus().toggleCodeBlock().run()
        )}
      </div>

      <EditorContent editor={editor} />
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

  async function renameNode(id, name) {
    await api(`/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    await load();
  }

  async function deleteNode(id) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const what =
      node.type === "folder"
        ? `the folder "${node.name}" and everything inside it`
        : `"${node.name}"`;
    if (!window.confirm(`Delete ${what}?`)) return;

    await api(`/nodes/${id}`, { method: "DELETE" });
    if (id === selectedId) setSelectedId(null);
    await load();
  }

  /*
  async function saveContent(id, text) {
    await api(`/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: { text } }),
    });
    await load();
  } */
  
  async function saveContent(id, doc) {
    const updated = await api(`/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: doc }),
    });
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updated } : n)));
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
            onRename={renameNode}
            onDelete={deleteNode}
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