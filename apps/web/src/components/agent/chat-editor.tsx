import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension, type JSONContent } from "@tiptap/core";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { MentionList, type MentionListRef } from "./mention-list";
import { buildMentionMarkup, type MentionData } from "@/lib/mention-markup";
import type { NodeCategory, PipelineNode } from "@/lib/types";

const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      category: {
        default: "source",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-category") ?? "source",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-category": attrs.category }),
      },
      sourceFileId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-sfid"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.sourceFileId ? { "data-sfid": attrs.sourceFileId } : {},
      },
    };
  },
});

function serializeContent(doc: JSONContent): string {
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "mention") {
      parts.push(
        buildMentionMarkup({
          id: node.attrs?.id ?? "",
          label: node.attrs?.label ?? "",
          category: (node.attrs?.category ?? "source") as NodeCategory,
          sourceFileId: node.attrs?.sourceFileId ?? undefined,
        }),
      );
      return;
    }
    if (node.type === "text") {
      parts.push(node.text ?? "");
      return;
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    if (node.content) {
      node.content.forEach(walk);
    }
    if (node.type === "paragraph" && parts.length > 0) {
      parts.push("\n");
    }
  }

  walk(doc);
  return parts.join("").trim();
}

function updatePopupPosition(popup: HTMLElement, props: SuggestionProps) {
  const rect = props.clientRect?.();
  if (!rect) return;
  popup.style.left = `${rect.left}px`;
  popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
}

export interface ChatEditorHandle {
  focus(): void;
  clear(): void;
  insertMention(data: MentionData): void;
  setContent(text: string): void;
  getSerializedContent(): string;
}

interface ChatEditorProps {
  onSend: (text: string) => void;
  onEmptyChange?: (isEmpty: boolean) => void;
  pipelineNodes: PipelineNode[];
  placeholder?: string;
  disabled?: boolean;
}

export const ChatEditor = forwardRef<ChatEditorHandle, ChatEditorProps>(
  ({ onSend, onEmptyChange, pipelineNodes, placeholder, disabled }, ref) => {
    const nodesRef = useRef(pipelineNodes);
    nodesRef.current = pipelineNodes;

    const onSendRef = useRef(onSend);
    onSendRef.current = onSend;

    const suggestionOpenRef = useRef(false);

    const chatKeymap = useMemo(
      () =>
        Extension.create({
          name: "chatKeymap",
          addKeyboardShortcuts() {
            return {
              Enter: ({ editor }) => {
                if (suggestionOpenRef.current) return false;
                const text = serializeContent(editor.getJSON());
                if (text.trim()) {
                  onSendRef.current(text);
                  editor.commands.clearContent();
                }
                return true;
              },
            };
          },
        }),
      [],
    );

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: placeholder ?? "Ask anything about your data... (@ to mention a node)",
        }),
        CustomMention.configure({
          HTMLAttributes: { class: "mention" },
          renderLabel({ node }) {
            return `@${node.attrs.label ?? node.attrs.id}`;
          },
          suggestion: {
            char: "@",
            items: ({ query }: { query: string }) => {
              const q = query.toLowerCase();
              return nodesRef.current
                .filter((n) => n.data.label.toLowerCase().includes(q))
                .slice(0, 8);
            },
            render: () => {
              let component: ReactRenderer<MentionListRef>;
              let popup: HTMLDivElement;

              return {
                onStart: (props: SuggestionProps) => {
                  suggestionOpenRef.current = true;
                  component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                  });

                  popup = document.createElement("div");
                  popup.style.position = "fixed";
                  popup.style.zIndex = "9999";
                  document.body.appendChild(popup);
                  popup.appendChild(component.element);
                  updatePopupPosition(popup, props);
                },
                onUpdate: (props: SuggestionProps) => {
                  component?.updateProps(props);
                  if (popup) updatePopupPosition(popup, props);
                },
                onKeyDown: (props: SuggestionKeyDownProps) => {
                  if (props.event.key === "Escape") {
                    popup?.remove();
                    component?.destroy();
                    suggestionOpenRef.current = false;
                    return true;
                  }
                  return component?.ref?.onKeyDown(props) ?? false;
                },
                onExit: () => {
                  popup?.remove();
                  component?.destroy();
                  suggestionOpenRef.current = false;
                },
              };
            },
          },
        }),
        chatKeymap,
      ],
      editorProps: {
        attributes: {
          class:
            "outline-none text-xs leading-relaxed max-h-[160px] overflow-y-auto px-3 py-2.5 [&_p]:m-0",
        },
      },
      onUpdate: ({ editor: e }) => {
        onEmptyChange?.(e.isEmpty);
      },
      editable: !disabled,
    });

    useEffect(() => {
      if (editor && editor.isEditable === !!disabled) {
        editor.setEditable(!disabled);
      }
    }, [editor, disabled]);

    useImperativeHandle(ref, () => ({
      focus() {
        editor?.commands.focus();
      },
      clear() {
        editor?.commands.clearContent();
      },
      insertMention(data: MentionData) {
        if (!editor) return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "mention",
            attrs: {
              id: data.id,
              label: data.label,
              category: data.category,
              sourceFileId: data.sourceFileId ?? null,
            },
          })
          .insertContent(" ")
          .run();
      },
      setContent(text: string) {
        if (!editor) return;
        editor.commands.setContent(`<p>${text}</p>`);
        editor.commands.focus("end");
      },
      getSerializedContent() {
        if (!editor) return "";
        return serializeContent(editor.getJSON());
      },
    }));

    return (
      <>
        <style>{`
          .chat-editor .tiptap p { margin: 0; }
          .chat-editor .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: var(--cm-text-tertiary, #94a3b8);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .chat-editor .mention {
            border-radius: 6px;
            padding: 1px 6px;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
            box-decoration-break: clone;
          }
          .chat-editor .mention[data-category="source"] { background: #eff6ff; color: #1d4ed8; }
          .chat-editor .mention[data-category="transform"] { background: #f5f3ff; color: #6d28d9; }
          .chat-editor .mention[data-category="harmonize"] { background: #ecfeff; color: #0e7490; }
          .chat-editor .mention[data-category="quality"] { background: #fffbeb; color: #b45309; }
          .chat-editor .mention[data-category="sink"] { background: #ecfdf5; color: #047857; }
          .chat-editor .tiptap::-webkit-scrollbar { width: 4px; }
          .chat-editor .tiptap::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
          .chat-editor .tiptap::-webkit-scrollbar-track { background: transparent; }
        `}</style>
        <EditorContent editor={editor} className="chat-editor w-full" />
      </>
    );
  },
);

ChatEditor.displayName = "ChatEditor";
