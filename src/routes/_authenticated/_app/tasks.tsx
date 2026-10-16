import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Empty, PageTitle } from "@/components/common";

export const Route = createFileRoute("/_authenticated/_app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Unto Together" }, { name: "description", content: "Tasks" }, { property: "og:title", content: "Tasks — Unto Together" }, { property: "og:description", content: "Tasks" }] }),
  component: () => (
    <div className="p-4">
      <PageTitle title="Tasks" />
      <Empty icon={<Construction />} title="Coming soon" text="This page is not finished yet." />
    </div>
  ),
});
