import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { ArrowUp, Paperclip, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentInputProps {
  placeholder: string;
  onSend: (text: string) => void;
}

export interface AgentInputHandle {
  setDraft: (text: string) => void;
}

export const AgentInput = forwardRef<AgentInputHandle, AgentInputProps>(
  function AgentInput({ placeholder, onSend }, ref) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const canSend = value.trim().length > 0;

    useImperativeHandle(ref, () => ({
      setDraft(text: string) {
        setValue(text);
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
    }));

    function handleSubmit() {
      if (!canSend) return;
      onSend(value.trim());
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }, [value]);

    return (
      <div className="rounded-xl border border-cm-border-primary bg-white shadow-sm">
        <div className="px-3 pt-2.5 pb-1.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-cm-text-primary outline-none placeholder:text-cm-text-tertiary leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between px-2.5 pb-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-secondary"
              title="Attach file"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-secondary"
              title="Attach image"
            >
              <Image className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={!canSend}
            onClick={handleSubmit}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
              canSend
                ? "bg-cm-accent text-white hover:bg-cm-accent-hover"
                : "bg-cm-bg-elevated text-cm-text-tertiary"
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
);
