import { LoginForm } from "@/features/auth/login-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </div>
  );
}
