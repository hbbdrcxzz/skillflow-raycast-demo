import type { WorkflowPlan } from "@/lib/contracts";
import { validateWorkflowPlan } from "@/lib/contracts";

export async function POST(request: Request) {
  try {
    const plan = (await request.json()) as WorkflowPlan;
    const result = validateWorkflowPlan(plan);
    return Response.json(result, { status: result.valid ? 200 : 422 });
  } catch {
    return Response.json({ valid: false, errors: ["工作流数据无法解析"], warnings: [] }, { status: 400 });
  }
}

