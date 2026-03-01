"use client";

import { useState, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Settings,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Lesson {
  id: string;
  title: string;
  sort_order: number;
  lesson_content_blocks?: { id: string }[];
}

interface Module {
  id: string;
  title: string;
  sort_order: number;
  challenge_lessons: Lesson[];
}

interface Challenge {
  id: string;
  title: string;
  status: string;
  challenge_modules: Module[];
}

interface CourseOutlineProps {
  challenge: Challenge;
  activeLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onSelectSettings: () => void;
  onDataChange: () => void;
}

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
    setNodeRef: ReturnType<typeof useSortable>["setNodeRef"];
    style: React.CSSProperties;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>{children({ listeners, attributes, setNodeRef, style, isDragging })}</>
  );
}

export function CourseOutline({
  challenge,
  activeLessonId,
  onSelectLesson,
  onSelectSettings,
  onDataChange,
}: CourseOutlineProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(challenge.challenge_modules.map((m) => m.id))
  );
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const debouncedPatch = useCallback(
    (url: string, body: Record<string, unknown>, key: string) => {
      if (debounceTimers.current[key])
        clearTimeout(debounceTimers.current[key]);
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {}
      }, 500);
    },
    []
  );

  // --- Module actions ---

  async function addModule() {
    try {
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.id,
          title: "New Module",
          sort_order: challenge.challenge_modules.length,
        }),
      });
      if (res.ok) {
        const mod = await res.json();
        setExpandedModules((prev) => new Set(prev).add(mod.id));
        onDataChange();
      }
    } catch {}
  }

  async function deleteModule(moduleId: string) {
    if (!confirm("Delete this module and all its lessons?")) return;
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}`, {
        method: "DELETE",
      });
      if (res.ok) onDataChange();
    } catch {}
  }

  async function duplicateModule(mod: Module) {
    try {
      const res = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.id,
          title: `${mod.title} (Copy)`,
          sort_order: challenge.challenge_modules.length,
        }),
      });
      if (!res.ok) return;
      const newMod = await res.json();
      for (const lesson of mod.challenge_lessons) {
        await fetch("/api/admin/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module_id: newMod.id,
            title: lesson.title,
            sort_order: lesson.sort_order,
          }),
        });
      }
      onDataChange();
    } catch {}
  }

  function startEditingTitle(mod: Module) {
    setEditingModuleId(mod.id);
    setEditingTitle(mod.title);
  }

  function commitEditingTitle() {
    if (editingModuleId && editingTitle.trim()) {
      debouncedPatch(
        `/api/admin/modules/${editingModuleId}`,
        { title: editingTitle.trim() },
        `mod-title-${editingModuleId}`
      );
    }
    setEditingModuleId(null);
  }

  // --- Lesson actions ---

  async function addLesson(moduleId: string, lessonCount: number) {
    try {
      const res = await fetch("/api/admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: moduleId,
          title: "New Lesson",
          sort_order: lessonCount,
        }),
      });
      if (res.ok) onDataChange();
    } catch {}
  }

  // --- DND handlers ---

  async function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = challenge.challenge_modules.findIndex(
      (m) => m.id === active.id
    );
    const newIndex = challenge.challenge_modules.findIndex(
      (m) => m.id === over.id
    );
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(challenge.challenge_modules, oldIndex, newIndex);
    try {
      await fetch("/api/admin/modules/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.id,
          ordered_ids: reordered.map((m) => m.id),
        }),
      });
      onDataChange();
    } catch {}
  }

  async function handleLessonDragEnd(moduleId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const mod = challenge.challenge_modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const oldIndex = mod.challenge_lessons.findIndex(
      (l) => l.id === active.id
    );
    const newIndex = mod.challenge_lessons.findIndex(
      (l) => l.id === over.id
    );
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(mod.challenge_lessons, oldIndex, newIndex);
    try {
      await fetch("/api/admin/lessons/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: moduleId,
          ordered_ids: reordered.map((l) => l.id),
        }),
      });
      onDataChange();
    } catch {}
  }

  const sortedModules = [...challenge.challenge_modules].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-cyan-400/20">
        <h2 className="font-semibold text-white truncate">{challenge.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-slate-400 hover:text-white"
          onClick={onSelectSettings}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Add Module */}
      <div className="px-3 py-2 border-b border-cyan-400/20">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={addModule}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto">
        {sortedModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <BookOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">No modules yet</p>
          </div>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleModuleDragEnd}
          >
            <SortableContext
              items={sortedModules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedModules.map((mod) => {
                const isExpanded = expandedModules.has(mod.id);
                const sortedLessons = [...mod.challenge_lessons].sort(
                  (a, b) => a.sort_order - b.sort_order
                );

                return (
                  <SortableItem key={mod.id} id={mod.id}>
                    {({ listeners, attributes, setNodeRef, style }) => (
                      <div ref={setNodeRef} style={style}>
                        {/* Module header */}
                        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800 hover:bg-slate-800/50 group">
                          <button
                            className="touch-none text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing"
                            {...listeners}
                            {...attributes}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>

                          <button
                            className="p-0.5 text-slate-400 hover:text-white"
                            onClick={() => toggleModule(mod.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {editingModuleId === mod.id ? (
                            <input
                              className="flex-1 min-w-0 bg-slate-800 border border-cyan-400/30 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-cyan-400"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={commitEditingTitle}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEditingTitle();
                                if (e.key === "Escape") setEditingModuleId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="flex-1 min-w-0 truncate text-xs font-medium text-slate-200 cursor-pointer"
                              onDoubleClick={() => startEditingTitle(mod)}
                              onClick={() => toggleModule(mod.id)}
                            >
                              {mod.title}
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white"
                              >
                                <span className="text-xs leading-none">⋯</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={() => duplicateModule(mod)}
                              >
                                <Copy className="h-3.5 w-3.5 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-400"
                                onClick={() => deleteModule(mod.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Lessons */}
                        {isExpanded && (
                          <div className="bg-slate-900/50">
                            <DndContext
                              collisionDetection={closestCenter}
                              onDragEnd={(e) =>
                                handleLessonDragEnd(mod.id, e)
                              }
                            >
                              <SortableContext
                                items={sortedLessons.map((l) => l.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {sortedLessons.map((lesson) => {
                                  const blockCount =
                                    lesson.lesson_content_blocks?.length ?? 0;
                                  const isActive =
                                    activeLessonId === lesson.id;

                                  return (
                                    <SortableItem
                                      key={lesson.id}
                                      id={lesson.id}
                                    >
                                      {({
                                        listeners: lListeners,
                                        attributes: lAttributes,
                                        setNodeRef: lSetNodeRef,
                                        style: lStyle,
                                      }) => (
                                        <div
                                          ref={lSetNodeRef}
                                          style={lStyle}
                                          className={`flex items-center gap-1.5 pl-7 pr-2 py-1.5 cursor-pointer hover:bg-slate-800/60 group ${
                                            isActive
                                              ? "border-l-2 border-cyan-400 bg-cyan-400/5"
                                              : "border-l-2 border-transparent"
                                          }`}
                                          onClick={() =>
                                            onSelectLesson(lesson.id)
                                          }
                                        >
                                          <button
                                            className="touch-none text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing"
                                            onClick={(e) => e.stopPropagation()}
                                            {...lListeners}
                                            {...lAttributes}
                                          >
                                            <GripVertical className="h-3 w-3" />
                                          </button>
                                          <span
                                            className={`flex-1 min-w-0 truncate text-xs ${
                                              isActive
                                                ? "text-cyan-400 font-medium"
                                                : "text-slate-300"
                                            }`}
                                          >
                                            {lesson.title}
                                          </span>
                                          {blockCount > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="h-4 px-1 text-[10px] leading-none border-slate-700 text-slate-500"
                                            >
                                              {blockCount}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </SortableItem>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>

                            {/* Add Lesson */}
                            <button
                              className="flex items-center gap-1.5 pl-7 pr-2 py-1.5 w-full text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 text-xs"
                              onClick={() =>
                                addLesson(
                                  mod.id,
                                  mod.challenge_lessons.length
                                )
                              }
                            >
                              <Plus className="h-3 w-3" />
                              Add Lesson
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
