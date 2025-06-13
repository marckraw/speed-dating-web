import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { stream } from "hono/streaming";
import { serviceRegistry } from "../../registry/service-registry";

const elevenlabs = new Hono();

const elevenLabsTTSchema = z.object({
  text: z.string(),
  voiceId: z.string().optional(),
});

elevenlabs.post(
  "/text-to-speech",
  zValidator("json", elevenLabsTTSchema),
  async (c) => {
    const elevenLabsService = serviceRegistry.get("elevenlabs");
    if (!elevenLabsService.isAvailable) {
      return c.json({ error: "ElevenLabs service is not configured." }, 503);
    }

    const { text, voiceId } = c.req.valid("json");

    try {
      const audioStream = await elevenLabsService.textToSpeechStream(
        text,
        voiceId
      );

      c.header("Content-Type", "audio/mpeg");
      return stream(c, async (stream) => {
        for await (const chunk of audioStream) {
          await stream.write(chunk);
        }
      });
    } catch (error) {
      console.error("Error in ElevenLabs text-to-speech route:", error);
      return c.json({ error: "Failed to generate speech." }, 500);
    }
  }
);

export default elevenlabs;
