"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { api, errorMessage } from "@/lib/api-client";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/PageHeader";
import { buttonClass, cardClass } from "@/components/ui/styles";

// One form for both login and register; register just adds a name field and
// creates the account before signing in.
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setLoading(true);
    setError("");
    try {
      if (isRegister) await api("/api/register", { method: "POST", body: { name: form.get("name"), email, password } });
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) throw new Error("Invalid email or password");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-4xl font-bold text-emerald-800">StockBook</p>
          <p className="text-gray-700 mt-2">Buy, sell &amp; track your goods</p>
        </div>
        <div className={`${cardClass} p-6 sm:p-8`}>
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">{isRegister ? "Create account" : "Welcome back"}</h1>
          <Alert message={error} />
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && <Field label="Your name" name="name" autoComplete="name" />}
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Field
              label="Password"
              name="password"
              type="password"
              minLength={6}
              autoComplete={isRegister ? "new-password" : "current-password"}
              hint={isRegister ? "At least 6 characters" : undefined}
              required
            />
            <button type="submit" disabled={loading} className={`${buttonClass.primary} w-full`}>
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-700">
            {isRegister ? "Already have an account? " : "No account? "}
            <Link href={isRegister ? "/login" : "/register"} className="text-emerald-800 font-semibold underline">
              {isRegister ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
