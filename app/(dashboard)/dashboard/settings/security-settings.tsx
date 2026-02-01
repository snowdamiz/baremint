"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetupDialog } from "@/components/two-factor/setup-dialog";
import { Shield, ShieldCheck } from "lucide-react";

interface SecuritySettingsProps {
  twoFactorEnabled: boolean;
  hasPassword: boolean;
}

export function SecuritySettings({
  twoFactorEnabled,
  hasPassword,
}: SecuritySettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {twoFactorEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using a TOTP
          authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {twoFactorEnabled ? (
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            >
              Enabled
            </Badge>
            <p className="text-sm text-muted-foreground">
              Your account is protected with two-factor authentication.
            </p>
          </div>
        ) : hasPassword ? (
          <SetupDialog
            trigger={
              <Button>Enable Two-Factor Authentication</Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You signed in with a social provider and don&apos;t have a password
              set. To enable two-factor authentication, you need to set a
              password first.
            </p>
            <Button variant="outline" disabled>
              Set Password (Coming Soon)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
