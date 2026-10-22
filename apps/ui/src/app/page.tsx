import { redirect } from "next/navigation";

// The app opens straight on the sign-in screen; the login page sends
// already-authenticated users on to their landing page.
export default function Home() {
  redirect("/login");
}
