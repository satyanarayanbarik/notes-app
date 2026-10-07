import express from "express";
import cors from "cors";
import "dotenv/config";
import { db } from "./src/prisma/db.ts";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const TEMP_USER_ID = "demo-user"; // placeholder until we add auth
const nodes = db.orm.public.Node;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// List all of this user's folders and notes
app.get("/nodes", async (req, res) => {
  try {
    const rows = await nodes.where({ userId: TEMP_USER_ID }).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load nodes" });
  }
});

// Create a folder or a note
app.post("/nodes", async (req, res) => {
  const { parentId = null, type, name } = req.body;

  if (!["folder", "note"].includes(type) || !name) {
    return res
      .status(400)
      .json({ error: "type must be 'folder' or 'note', and name is required" });
  }

  try {
    const created = await nodes.create({
      userId: TEMP_USER_ID,
      parentId,
      type,
      name,
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create node" });
  }
});

// Is candidateId the same node as nodeId, or somewhere inside it?
async function isSelfOrDescendant(nodeId, candidateId) {
  let currentId = candidateId;
  while (currentId) {
    if (currentId === nodeId) return true;
    const current = await nodes.where({ id: currentId }).first();
    currentId = current ? current.parentId : null;
  }
  return false;
}

// Rename, edit content, reorder, or move a node
app.patch("/nodes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await nodes.where({ id, userId: TEMP_USER_ID }).first();
    if (!existing) return res.status(404).json({ error: "Node not found" });

    // Only update the fields the client actually sent
    const data = {};
    for (const field of ["name", "content", "position", "parentId"]) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // Validate a move
    if (data.parentId) {
      const newParent = await nodes.where({ id: data.parentId, userId: TEMP_USER_ID }).first();
      if (!newParent || newParent.type !== "folder") {
        return res.status(400).json({ error: "New parent must be an existing folder" });
      }
      if (await isSelfOrDescendant(id, data.parentId)) {
        return res.status(400).json({ error: "Cannot move a folder into itself or its own subfolder" });
      }
    }

    const updated = await nodes.where({ id }).update(data);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update node" });
  }
});

// Delete a node (a folder takes everything inside it along)
app.delete("/nodes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await nodes.where({ id, userId: TEMP_USER_ID }).first();
    if (!existing) return res.status(404).json({ error: "Node not found" });

    await nodes.where({ id }).delete();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete node" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));