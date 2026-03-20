"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface TemplateEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export default function TemplateEditor({ value, onChange }: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. on load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>Bold</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>Italic</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={btn(editor.isActive("link"))}
        >
          Link
        </button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Unlink</button>
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]"
      />
    </div>
  );
}
