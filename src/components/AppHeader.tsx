import type { SessionUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-gray-300 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <p className="text-lg font-bold text-gray-900">ApparelFlow ERP</p>
          <p className="text-sm text-gray-700">
            {user.fullName} · <span className="font-medium">{ROLE_LABEL[user.role]}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <LogoutButton label="Switch role" />
        </div>
      </div>
    </header>
  );
}
