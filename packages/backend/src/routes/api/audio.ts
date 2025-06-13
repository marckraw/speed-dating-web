import { Hono } from "hono";
import { serviceRegistry } from "../../registry/service-registry";
import fs from "fs/promises";
import os from "os";
import path from "path";

const audio = new Hono();

audio.post("/transcribe", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Create a temporary file to store the upload
  const tempDir = os.tmpdir();
  const tempFileName = `${Date.now()}-${file.name}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer);

    const audioService = serviceRegistry.get("audio");
    const transcription = await audioService.transcribe(tempFilePath);

    return c.json({ transcription });
  } catch (error) {
    console.error("Error during transcription:", error);
    return c.json({ error: "Failed to transcribe audio" }, 500);
  } finally {
    // Clean up the temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temporary file:", cleanupError);
    }
  }
});

audio.post("/transcribe-video", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Create a temporary file to store the upload
  const tempDir = os.tmpdir();
  const tempFileName = `${Date.now()}-${file.name}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer);

    const audioService = serviceRegistry.get("audio");
    const transcription = await audioService.transcribeVideo(tempFilePath);

    return c.json({ transcription });
  } catch (error: any) {
    console.error("Error during video transcription:", error);
    return c.json(
      { error: error.message || "Failed to transcribe video" },
      500
    );
  } finally {
    // Clean up the temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temporary file:", cleanupError);
    }
  }
});

export default audio;
