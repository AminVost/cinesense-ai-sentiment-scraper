import { redirect } from "next/navigation";

// Legacy URLs must never render the retired URL-based scraper UI.
export default function LegacyDirectUrl() {
  redirect("/multi-source");
}
