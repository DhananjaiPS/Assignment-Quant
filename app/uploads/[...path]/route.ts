import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "uploads", ...pathSegments);

    // Security check: prevent directory traversal outside public/uploads
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const absoluteFilePath = path.resolve(filePath);

    if (!absoluteFilePath.startsWith(uploadsDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(absoluteFilePath)) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    const stat = fs.statSync(absoluteFilePath);
    if (!stat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absoluteFilePath);

    // Determine standard content-type
    let contentType = "application/octet-stream";
    const ext = path.extname(absoluteFilePath).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    } else if (ext === ".png") {
      contentType = "image/png";
    } else if (ext === ".gif") {
      contentType = "image/gif";
    } else if (ext === ".mp4") {
      contentType = "video/mp4";
    } else if (ext === ".mov") {
      contentType = "video/quicktime";
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving uploaded file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
