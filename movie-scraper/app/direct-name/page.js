import { redirect } from "next/navigation";

// Old direct-name link maps to the supported movie picker.
export default function LegacyDirectName() {
  redirect("/multi-source");
}
