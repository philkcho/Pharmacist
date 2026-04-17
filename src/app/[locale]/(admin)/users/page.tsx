import { listUsers } from "@/lib/actions/users";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="mt-2 text-muted-foreground">
          Manage admin access. Grant or revoke pharmacist (admin) role for
          registered users.
        </p>
      </div>
      <UsersClient initialUsers={users} />
    </div>
  );
}
