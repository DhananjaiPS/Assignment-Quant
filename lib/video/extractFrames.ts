import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export async function extractFrames(fileName: string): Promise<{
  frames: string[];
  logMessages: string[];
}> {
  const logMessages: string[] = [];

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads"
  );

  const targetVideo = path.join(uploadDir, fileName);

  if (!fs.existsSync(targetVideo)) {
    throw new Error(`Video not found: ${targetVideo}`);
  }

  logMessages.push(
    `[FFmpeg] Located video: ${targetVideo}`
  );

  const framesDir = path.join(uploadDir, "frames");

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  const uniqueId = Date.now();

  const outputPattern = path.join(
    framesDir,
    `frame-${uniqueId}-%03d.jpg`
  );

  const ffmpegCmd = `
ffmpeg -y \
-ss 00:00:02 \
-i "${targetVideo}" \
-vframes 3 \
-q:v 2 \
"${outputPattern}"
`;

  logMessages.push(
    `[FFmpeg] Running command: ${ffmpegCmd}`
  );

  console.log("RUNNING FFMPEG...");
  console.log(ffmpegCmd);

  try {
    await execAsync(ffmpegCmd);

    const extractedFiles = fs
      .readdirSync(framesDir)
      .filter((f) =>
        f.startsWith(`frame-${uniqueId}-`)
      );

    console.log(
      "EXTRACTED FILES:",
      extractedFiles
    );

    if (extractedFiles.length === 0) {
      throw new Error("No frames extracted");
    }

    const frameUrls = extractedFiles.map(
      (f) => `/uploads/frames/${f}`
    );

    console.log("FRAME URLS:", frameUrls);

    return {
      frames: frameUrls,
      logMessages,
    };
  } catch (error: any) {
    console.error("FFMPEG ERROR:", error);

    throw new Error(
      `FFmpeg failed: ${error.message}`
    );
  }
}