import { Suspense } from "react";
import SignupPageClient from "./SignupPageClient";

function SignupPageFallback() {
  return (
    <main className="bg-[#0b1020] text-white px-4 py-12 min-h-screen">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Create your free account</h1>

        <p className="mt-2 text-white/70 text-sm">
          Loading...
        </p>
      </div>
    </main>
  );
} 

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageClient />
    </Suspense>
  );
}