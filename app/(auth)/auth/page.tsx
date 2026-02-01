import { AuthForm } from "@/components/auth/auth-form";

export default function AuthPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-center items-center px-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Baremint</h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            The creator token platform. Build your economy, grow your community,
            and let your audience invest in your success.
          </p>
          <div className="pt-4 space-y-3 text-sm text-primary-foreground/60">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/40" />
              <span>Launch your own creator token</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/40" />
              <span>Built-in custodial wallet -- no crypto knowledge needed</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/40" />
              <span>Fair pricing powered by bonding curves</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center items-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center">
            <h1 className="text-2xl font-bold tracking-tight">Baremint</h1>
            <p className="text-sm text-muted-foreground mt-1">
              The creator token platform
            </p>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your email to sign in or create an account
            </p>
          </div>

          <AuthForm />
        </div>
      </div>
    </div>
  );
}
