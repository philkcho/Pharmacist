"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ArticleEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function ArticleEditor({
  initialValue = "",
  onChange,
  readOnly = false,
  className,
}: ArticleEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [activeTab, setActiveTab] = useState<string>("write");

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  if (readOnly) {
    return (
      <div
        className={cn(
          "prose prose-neutral max-w-none dark:prose-invert",
          className
        )}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
      />
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className}>
      <TabsList>
        <TabsTrigger value="write">Write</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="write">
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write your article content in Markdown..."
          className="min-h-[400px] font-mono text-sm"
          rows={20}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Supports Markdown formatting: **bold**, *italic*, ## headings, - lists, etc.
        </p>
      </TabsContent>
      <TabsContent value="preview">
        <div
          className="min-h-[400px] rounded-md border bg-background p-4 prose prose-neutral max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
        />
      </TabsContent>
    </Tabs>
  );
}

// Simple markdown to HTML converter (will be replaced with proper parser later)
function markdownToHtml(markdown: string): string {
  if (!markdown) return "<p></p>";

  let html = markdown
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Line breaks -> paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraphs
  html = `<p>${html}</p>`;

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");

  return html;
}
