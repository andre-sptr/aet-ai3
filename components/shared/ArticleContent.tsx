import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ArticleContent({ content }: { content: string }) {
  // Preserve the existing editorial newline handling.
  const processedContent = content
    ? content.replace(/(\r\n|\n|\r)/gm, "\n\n")
    : "";
  return (
    <div className="article-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) =>
            src ? (
              <Image
                src={String(src)}
                alt={alt || ""}
                width={1200}
                height={675}
                unoptimized
                className="article-inline-image"
              />
            ) : null,
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
