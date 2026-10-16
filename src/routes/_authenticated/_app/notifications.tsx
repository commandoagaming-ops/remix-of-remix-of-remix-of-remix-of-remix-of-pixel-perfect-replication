import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Empty, PageTitle } from "@/components/common";

export const Route = createFileRoute("/_authenticated/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Unto Together" }, { name: "description", content: "Notifications" }, { property: "og:title", content: "Notifications — Unto Together" }, { property: "og:description", content: "Notifications" }] }),
  component: () => (
    <div className="p-4">
      <PageTitle title="Notifications" />
      <Empty icon={<Construction />} title="Coming soon" text="This page is not finished yet." />
    </div>
  ),
});
