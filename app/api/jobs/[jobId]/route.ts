import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  // 1. Type ko Promise define karo
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // 2. PARAMS KO AWAIT KARNA ZAROORI HAI (Ye hai magic line!)
    const resolvedParams = await params;
    const jobId = resolvedParams.jobId;

    console.log("✅ Resolved Job ID:", jobId); // Ab yahan sahi ID aayegi!

    const job = await prisma.processingJob.findUnique({
      where: {
        id: jobId, // Ab Prisma khush ho jayega
      },
      include: {
        products: true,
        logs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("❌ API Error:", error);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}