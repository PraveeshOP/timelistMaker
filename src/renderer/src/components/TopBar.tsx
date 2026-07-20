import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface TopBarProps {
  onHome: () => void;
}

export function TopBar({ onHome }: TopBarProps): React.JSX.Element {
  const { user, signOut, updateFullName } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setEditingName(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function startEditing(): void {
    setNameDraft(user?.fullName ?? "");
    setError(null);
    setEditingName(true);
  }

  async function handleSaveName(): Promise<void> {
    if (!nameDraft.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateFullName(nameDraft.trim());
    setSaving(false);
    if (result.error) setError(result.error);
    else {
      setEditingName(false);
      setMenuOpen(false);
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative flex items-center justify-start border-b border-slate-200 bg-white px-6 py-2"
    >
      <button
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute left-6 top-11 z-20 w-64 rounded-lg border border-slate-200 bg-white py-2 text-xs text-slate-600 shadow-lg">
          <button
            className="block w-full px-4 py-2 text-left hover:bg-slate-50"
            onClick={() => {
              onHome();
              setMenuOpen(false);
            }}
          >
            🏠 Home
          </button>

          <div className="border-t border-slate-100 px-4 py-2">
            {editingName ? (
              <div className="space-y-2">
                <Input
                  className="py-1 text-xs"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={handleSaveName}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <button
                    className="hover:underline"
                    onClick={() => setEditingName(false)}
                  >
                    Cancel
                  </button>
                </div>
                {error && <p className="text-red-500">{error}</p>}
              </div>
            ) : (
              <button
                className="text-left hover:underline"
                onClick={startEditing}
              >
                {user?.fullName
                  ? `Edit name (${user.fullName})`
                  : "Add your name"}
              </button>
            )}
          </div>

          <button
            className="block w-full border-t border-slate-100 px-4 py-2 text-left hover:bg-slate-50"
            onClick={() => {
              signOut();
              setMenuOpen(false);
            }}
          >
            Sign out ({user?.email})
          </button>
        </div>
      )}
    </div>
  );
}
