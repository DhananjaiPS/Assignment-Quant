import { execSync } from "child_process";

export async function detectObjects(imagePath: string): Promise<string[]> {
    try {
        // We use python3 -c to run an inline script. This guarantees it works in Docker 
        // without worrying about ~/.local/bin paths.
        const pythonScript = `
from ultralytics import YOLO
import json

# Load model quietly
model = YOLO('yolov8n.pt')
results = model('${imagePath}', verbose=False)

detected = []
for result in results:
    for box in result.boxes:
        # get class name based on class id
        class_id = int(box.cls[0])
        class_name = model.names[class_id]
        detected.append(class_name)

print(json.dumps(list(set(detected))))
        `;

        const output = execSync(`python3 -c "${pythonScript}"`, { encoding: 'utf-8' });

        // Parse the printed JSON array from Python
        const objects = JSON.parse(output.trim());
        return objects;

    } catch (error: any) {
        console.error("YOLO Error:", error.message);
        return [];
    }
}