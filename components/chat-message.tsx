"use client";
import React, { memo, useEffect, useRef, useState } from "react";
import { Button } from "@base-ui-components/react/button";
import { Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatIcon } from "./chat-icon";
import { ChatArtifact } from "./chat-artifact";
import type { Artifact } from "@/lib/room-artifacts";
import type { Message } from "@/lib/domain";
function MessageView({
  message,
  onOpenArtifact,
  artifacts,
  unlocked,
  onArtifactsChanged,
  repeatedArtifactIds = [],
}: {
  message: Message;
  repeatedArtifactIds?: string[];
  onOpenArtifact?: (id: string) => void;
  artifacts: Artifact[];
  unlocked: boolean;
  onArtifactsChanged: () => void;
}) {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyError(false);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <article className={`message ${message.role}`}>
      <span>{message.role === "user" ? "You" : "Archicova"}</span>
      <div className="messageBody">
        {!!message.photoIds?.length && (
          <div className="roomPhotos">
            {message.photoIds.map((id) => (
              <a
                key={id}
                href={`/api/photos/${id}`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={`/api/photos/${id}`}
                  alt="Uploaded room photo"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        {message.role === "assistant" ? (
          <div className="formattedReply">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                img: () => null,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="userText">{message.content}</p>
        )}
        {message.artifactIds?.map((id) => (
          <ChatArtifact
            key={id}
            id={id}
            view={message.artifactViews?.[id]}
            legacyComparison={repeatedArtifactIds.includes(id)}
            artifact={artifacts.find((a) => a.id === id)}
            unlocked={unlocked}
            onOpen={onOpenArtifact}
            onChanged={onArtifactsChanged}
          />
        ))}
        {message.status === "failed" && (
          <small className="replyState">
            Reply interrupted. You can send your message again.
          </small>
        )}
        {!!message.content && message.status !== "running" && (
          <div className="messageActions">
            <Button
              aria-label={copied ? "Copied message" : "Copy message"}
              title={copied ? "Copied" : "Copy message"}
              onClick={() => void copy()}
            >
              {copied ? (
                <Check size={16} />
              ) : (
                <ChatIcon name="copy" size={16} />
              )}
            </Button>
            <span role="status">
              {copied
                ? "Copied"
                : copyError
                  ? "Copy unavailable in this browser."
                  : ""}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

export const ChatMessage = memo(MessageView);
