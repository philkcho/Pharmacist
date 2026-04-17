"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Mail,
  Clock,
  Loader2,
} from "lucide-react";
import {
  grantPharmacistRole,
  revokePharmacistRole,
  inviteAdmin,
  type UserRow,
} from "@/lib/actions/users";

interface UsersClientProps {
  initialUsers: UserRow[];
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  function handleGrant(userId: string) {
    startTransition(async () => {
      setError(null);
      const res = await grantPharmacistRole(userId);
      if (!res.ok) setError(res.error ?? "Failed");
      router.refresh();
    });
  }

  function handleRevoke(userId: string) {
    if (!confirm("Remove admin access for this user?")) return;
    startTransition(async () => {
      setError(null);
      const res = await revokePharmacistRole(userId);
      if (!res.ok) setError(res.error ?? "Failed");
      router.refresh();
    });
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      setError(null);
      const res = await inviteAdmin(inviteEmail.trim());
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setInviteEmail("");
        setShowInvite(false);
      }
      router.refresh();
    });
  }

  const admins = initialUsers.filter((u) => u.isPharmacist);
  const regularUsers = initialUsers.filter((u) => !u.isPharmacist);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Invite new admin */}
      <div className="flex items-center gap-3">
        {showInvite ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="email"
              placeholder="Enter email address..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={isPending || !inviteEmail.trim()}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-1 h-4 w-4" />
              )}
              Add Admin
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInvite(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-1 h-4 w-4" />
            Add Admin
          </Button>
        )}
      </div>

      {/* Admins (pharmacists) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Admins
          <Badge variant="secondary">{admins.length}</Badge>
        </h2>
        <div className="space-y-2">
          {admins.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onRevoke={() => handleRevoke(user.id)}
              isPending={isPending}
            />
          ))}
          {admins.length === 0 && (
            <p className="text-sm text-muted-foreground">No admins yet.</p>
          )}
        </div>
      </section>

      {/* Regular users */}
      {regularUsers.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            Users
            <Badge variant="secondary">{regularUsers.length}</Badge>
          </h2>
          <div className="space-y-2">
            {regularUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onGrant={() => handleGrant(user.id)}
                isPending={isPending}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UserCard({
  user,
  onGrant,
  onRevoke,
  isPending,
}: {
  user: UserRow;
  onGrant?: () => void;
  onRevoke?: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/30">
      {/* Avatar / initial */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {user.email.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{user.email}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {user.provider}
          </Badge>
          {user.isPharmacist && (
            <Badge className="shrink-0 text-[10px]">Admin</Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            Joined {new Date(user.createdAt).toLocaleDateString()}
          </span>
          {user.lastSignIn && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last login{" "}
              {new Date(user.lastSignIn).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {onGrant && (
          <Button
            size="sm"
            variant="outline"
            onClick={onGrant}
            disabled={isPending}
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Make Admin
          </Button>
        )}
        {onRevoke && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRevoke}
            disabled={isPending}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <ShieldOff className="mr-1 h-3.5 w-3.5" />
            Remove Admin
          </Button>
        )}
      </div>
    </div>
  );
}
