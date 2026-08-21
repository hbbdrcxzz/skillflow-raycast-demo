import { compileWorkflow } from "@/lib/workflow-compiler";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      goal?: string;
      sources?: string[];
      audience?: string;
      frequency?: string;
      targetUser?: string;
    };
    const plan = compileWorkflow({
      goal: body.goal || "",
      sources: body.sources,
      audience: body.audience,
      frequency: body.frequency,
      targetUser: body.targetUser,
    });
    return Response.json({ plan }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法生成工作流计划";
    return Response.json({ error: message }, { status: 400 });
  }
}

