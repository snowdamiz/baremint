import { VerifyForm } from "@/components/two-factor/verify-form";

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-center items-center px-12">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Baremint</h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Your account is protected with two-factor authentication. Enter the
            code from your authenticator app to continue.
          </p>
        </div>
      </div>

      {/* Right side - 2FA form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center items-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center">
            <h1 className="text-2xl font-bold tracking-tight">Baremint</h1>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <VerifyForm />
        </div>
      </div>
    </div>
  );
}
