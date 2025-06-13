import { config } from "../../config.env";
import OpenAI from "openai";
import { zodFunction } from "openai/helpers/zod";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import os from "os";
import path from "path";

const createLLMService = () => {
  const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  const runLLM = async ({
    model = "gpt-4.1",
    messages,
    tools,
  }: {
    model?: string;
    messages: any[];
    tools: any[];
  }) => {
    const formattedTools = tools.map((tool) => {
      if (tool.parameters) {
        console.log("🤪 Zod object");
        return zodFunction(tool);
      } else {
        console.log("✅ Normal object");
        return tool;
      }
    });

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      // TODO: fix any
      messages: [...(messages as any)],
      tools: formattedTools,
      tool_choice: "auto",
      //   parallel_tool_calls: false,
    });

    return response.choices[0]?.message;
  };

  /**
   * Transcribes an audio file using GPT-4o Mini Audio Preview (with Whisper fallback).
   * @param filePath - The path to the audio file.
   * @returns The transcription text.
   */
  const transcribeAudio = async (filePath: string): Promise<string> => {
    try {
      // First try GPT-4o Mini Audio Preview
      const audioBuffer = fs.readFileSync(filePath);
      const base64Audio = audioBuffer.toString("base64");

      // Determine audio format from file extension
      const ext = path.extname(filePath).toLowerCase();
      const formatMap: Record<string, string> = {
        ".mp3": "mp3",
        ".wav": "wav",
        ".webm": "webm",
        ".m4a": "m4a",
        ".mp4": "mp4",
      };
      const format = formatMap[ext] || "mp3";

      console.log(`🎵 Attempting GPT-4o Mini transcription for ${format} file`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini-audio-preview",
        modalities: ["text", "audio"] as any,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please transcribe this audio file accurately. Return only the transcribed text without any additional commentary.",
              },
              {
                type: "input_audio" as any,
                input_audio: {
                  data: base64Audio,
                  format: format as any,
                },
              },
            ] as any,
          },
        ],
        temperature: 0.1,
      });

      const transcription = response.choices[0]?.message?.content;
      if (transcription) {
        console.log("✅ GPT-4o Mini transcription successful");
        return transcription;
      }

      throw new Error("No transcription content received from GPT-4o Mini");
    } catch (error) {
      console.warn(
        "⚠️ GPT-4o Mini transcription failed, falling back to Whisper:",
        error
      );

      // Fallback to Whisper
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: "whisper-1",
        });
        console.log("✅ Whisper fallback transcription successful");
        return transcription.text;
      } catch (whisperError) {
        console.error(
          "❌ Both GPT-4o Mini and Whisper transcription failed:",
          whisperError
        );
        throw new Error(
          "Failed to transcribe audio with both GPT-4o Mini and Whisper."
        );
      }
    }
  };

  /**
   * Transcribes an audio file using only OpenAI's Whisper model.
   * @param filePath - The path to the audio file.
   * @returns The transcription text.
   */
  const transcribeAudioWithWhisper = async (
    filePath: string
  ): Promise<string> => {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
      });
      return transcription.text;
    } catch (error) {
      console.error("Error transcribing audio with Whisper:", error);
      throw new Error("Failed to transcribe audio with Whisper.");
    }
  };

  /**
   * Extracts audio from a video file and transcribes it.
   * @param videoPath - The path to the video file.
   * @returns The transcription text.
   */
  const transcribeVideo = async (videoPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const tempFileName = `${Date.now()}-audio.mp3`;
      const audioPath = path.join(tempDir, tempFileName);

      ffmpeg(videoPath)
        .toFormat("mp3")
        .on("error", (err: Error) => {
          console.error("An error occurred: " + err.message);
          reject(
            new Error(
              "Failed to extract audio from video. Make sure ffmpeg is installed."
            )
          );
        })
        .on("end", async () => {
          try {
            const transcription = await transcribeAudio(audioPath);
            resolve(transcription);
          } catch (error) {
            reject(error);
          } finally {
            // Clean up the temporary audio file
            fs.unlink(audioPath, (err) => {
              if (err)
                console.error("Error deleting temporary audio file:", err);
            });
          }
        })
        .save(audioPath);
    });
  };

  // Return public interface
  return {
    openai,
    runLLM,
    transcribeAudio,
    transcribeAudioWithWhisper,
    transcribeVideo,
  };
};

export const llmService = createLLMService();
export { createLLMService };

// Export the type for the service registry
export type LLMService = typeof llmService;
