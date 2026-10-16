import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Empty, PageTitle } from "@/components/common";

export const Route = createFileRoute("/_authenticated/_app/withdraw")({
  head: () => ({ meta: [{ title: "Withdrawal — Unto Together" }, { name: "description", content: "Withdrawal" }, { property: "og:title", content: "Withdrawal — Unto Together" }, { property: "og:description", content: "Withdrawal" }] }),
  component: () => (
    <div className="p-4">
      <PageTitle title="Withdrawal" />
      <Empty icon={<Construction />} title="Coming soon" text="This page is not finished yet." />
    </div>
  ),
});
