import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ScmFlowNode } from "./scmFlowNodes";

export default function ScmSupplyChainList({
  nodes,
}: {
  nodes: ScmFlowNode[];
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div key={node.id}>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate(node.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigate(node.path);
            }}
            className="flex-1 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-brand-300"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{node.label}</p>
                <p className="text-sm text-muted-foreground">{node.metric}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
