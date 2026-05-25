#!/usr/bin/env python3
import sys
import json
from ultralytics import YOLO

def detect_objects(image_path):
    try:
        # Load model quietly
        model = YOLO('yolov8n.pt')
        results = model(image_path, verbose=False)
        
        detected = []
        for result in results:
            for box in result.boxes:
                # get class name based on class id
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                detected.append(class_name)
        
        # Return unique objects as JSON
        return list(set(detected))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return []

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(1)
    
    image_path = sys.argv[1]
    objects = detect_objects(image_path)
    print(json.dumps(objects))
