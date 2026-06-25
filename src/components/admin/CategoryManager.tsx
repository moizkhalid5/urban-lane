"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCategory, deleteCategory } from "@/app/actions/admin-categories";

export type CatItem = { id: string; name: string; level: number; parentId: string | null; showInNav: boolean; isActive: boolean };

export function CategoryManager({ categories }: { categories: CatItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<CatItem | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [showInNav, setShowInNav] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function resetForm() {
    setEditing(null);
    setName("");
    setParentId("");
    setShowInNav(true);
  }

  function startEdit(c: CatItem) {
    setEditing(c);
    setName(c.name);
    setParentId(c.parentId ?? "");
    setShowInNav(c.showInNav);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const res = await saveCategory(
        { name, parentId: parentId || null, showInNav, isActive: true, position: 0 },
        editing?.id,
      );
      if (res.ok) {
        resetForm();
        router.refresh();
      } else setMsg(res.message ?? "Error");
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this category?")) return;
    start(async () => {
      const res = await deleteCategory(id);
      if (!res.ok) setMsg(res.message ?? "Error");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card">
        <div className="border-b border-line p-4"><h2 className="font-medium">Category tree</h2></div>
        <ul className="max-h-[32rem] divide-y divide-line-soft overflow-y-auto">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-2 text-sm" style={{ paddingLeft: 8 + c.level * 16 }}>
              <span className={c.level === 0 ? "font-medium" : "text-ink-soft"}>
                {c.name}
                {!c.showInNav && <span className="ml-2 text-xs text-ink-muted">(hidden)</span>}
              </span>
              <span className="flex gap-3 pr-2 text-xs">
                <button onClick={() => startEdit(c)} className="text-ink-muted hover:text-ink">Edit</button>
                <button onClick={() => remove(c.id)} className="text-sale hover:underline">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card h-fit space-y-3 p-5">
        <h2 className="font-medium">{editing ? "Edit category" : "Add category"}</h2>
        {msg && <p className="text-sm text-sale">{msg}</p>}
        <div>
          <label className="label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Parent</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input">
            <option value="">— Top level —</option>
            {categories
              .filter((c) => c.id !== editing?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>{" ".repeat(c.level * 2)}{c.name}</option>
              ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} className="h-4 w-4 accent-ink" />
          Show in navigation
        </label>
        <div className="flex gap-2">
          <button onClick={submit} disabled={pending || !name.trim()} className="btn-primary flex-1">
            {pending ? "Saving…" : editing ? "Update" : "Add"}
          </button>
          {editing && <button onClick={resetForm} className="btn-ghost">Cancel</button>}
        </div>
      </div>
    </div>
  );
}
