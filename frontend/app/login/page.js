import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import { AuthFormSkeleton } from "@/components/Skeletons";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your board and switch relays."
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
