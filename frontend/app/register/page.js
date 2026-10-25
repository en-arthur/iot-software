import AuthShell from "@/components/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Claim your first ESP32 extension board in under a minute."
    >
      <RegisterForm />
    </AuthShell>
  );
}
