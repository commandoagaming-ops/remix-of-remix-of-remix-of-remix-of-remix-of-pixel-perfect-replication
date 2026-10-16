import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Empty, PageTitle } from "@/components/common";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Unto Together" }, { name: "description", content: "Admin" }, { property: "og:title", content: "Admin — Unto Together" }, { property: "og:description", content: "Admin" }] }),
  component: () => (
    <div className="p-4">
      <PageTitle title="Admin" />
      <Empty icon={<Construction />} title="Coming soon" text="This page is not finished yet." />
    </div>
  ),
});
