import express from "express";
import cors from "cors";
import "dotenv/config";
import { db } from "./src/prisma/db.ts";

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));