import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Empty, PageTitle } from "@/components/common";

export const Route = createFileRoute("/_authenticated/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Unto Together" }, { name: "description", content: "Profile" }, { property: "og:title", content: "Profile — Unto Together" }, { property: "og:description", content: "Profile" }] }),
  component: () => (
    <div className="p-4">
      <PageTitle title="Profile" />
      <Empty icon={<Construction />} title="Coming soon" text="This page is not finished yet." />
    </div>
  ),
});
