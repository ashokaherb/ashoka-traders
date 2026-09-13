import { useAuth } from "../context/AuthContext";

// Simple read-only profile page - there's only ever one admin account (created via
// backend/seed/seedAdmin.js), so there's nothing to edit here beyond what that seed
// script sets. Exists mainly so the top bar's "Profile" dropdown link goes somewhere.
export default function AdminProfile() {
  const { user } = useAuth();

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
          {user?.name?.charAt(0).toUpperCase() || "A"}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
          <p className="text-gray-800 font-medium">{user?.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
          <p className="text-gray-800 font-medium">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Role</p>
          <p className="text-gray-800 font-medium">Administrator</p>
        </div>
        <p className="text-xs text-gray-400 pt-2 border-t">
          To change the admin email/password, update <code>ADMIN_EMAIL</code>/
          <code>ADMIN_PASSWORD</code> in the backend's <code>.env</code> and re-run{" "}
          <code>npm run seed:admin</code>.
        </p>
      </div>
    </div>
  );
}
