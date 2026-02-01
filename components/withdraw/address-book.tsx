"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Trash2 } from "lucide-react";
import { deleteAddress } from "@/app/(dashboard)/dashboard/withdraw/actions";

interface SavedAddress {
  id: string;
  address: string;
  label: string;
}

interface AddressBookProps {
  addresses: SavedAddress[];
  onSelect: (address: string) => void;
}

export function AddressBook({ addresses, onSelect }: AddressBookProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm("Remove this address from your address book?")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteAddress(id);
      setDeletingId(null);
      router.refresh();
    });
  }

  if (addresses.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Address Book
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="flex items-center gap-2 rounded-md border p-2 text-sm"
          >
            <button
              type="button"
              className="flex-1 text-left hover:text-primary transition-colors min-w-0"
              onClick={() => onSelect(addr.address)}
            >
              <p className="font-medium truncate">{addr.label}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {addr.address}
              </p>
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(addr.id)}
              disabled={isPending && deletingId === addr.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
