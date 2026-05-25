import { execSync } from "child_process";
import path from "path";

export async function detectObjects(imagePath: string): Promise<string[]> {
    try {
        // Use the Python script file instead of inline script
        const scriptPath = path.join(process.cwd(), "lib/vision/detect.py");
        const output = execSync(`python3 "${scriptPath}" "${imagePath}"`, { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
        });

        // Parse the printed JSON array from Python
        const objects = JSON.parse(output.trim());
        return objects;

    } catch (error: any) {
        console.error("YOLO Error:", error.message);
        return [];
    }
}