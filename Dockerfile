FROM node:20

# Install dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install ultralytics (YOLO) with CPU-only PyTorch to minimize image size
RUN pip3 install --break-system-packages --no-cache-dir ultralytics --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-download YOLOv8n model to prevent downloading it at runtime
RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm packages
RUN npm install

# Ensure nodemailer is installed (in case the layer above was cached before it was added)
RUN npm install nodemailer @types/nodemailer


# Copy full project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]